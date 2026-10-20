"""Private S3-compatible storage; browser URLs use a separately configured endpoint."""

from contextlib import closing
from pathlib import Path

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from recallcam_shared.settings import Settings


class StorageUnavailable(Exception):
    """Safe boundary; never expose signed URLs or credential-bearing SDK exceptions."""


class S3Storage:
    def __init__(self, settings: Settings):
        if settings.storage_backend != "s3":
            raise StorageUnavailable("The recording library requires the S3 storage adapter.")
        config = Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=60,
            retries={"mode": "standard", "max_attempts": 3},
            s3={"addressing_style": "path"},
        )
        arguments = {
            "aws_access_key_id": settings.s3_access_key_id.get_secret_value(),
            "aws_secret_access_key": settings.s3_secret_access_key.get_secret_value(),
            "region_name": settings.s3_region,
            "config": config,
        }
        if not arguments["aws_access_key_id"] or not arguments["aws_secret_access_key"]:
            raise StorageUnavailable("Configure the private object-storage credentials.")
        self.client = boto3.client("s3", endpoint_url=str(settings.s3_endpoint_url), **arguments)
        self.signer = boto3.client(
            "s3", endpoint_url=str(settings.s3_public_endpoint_url), **arguments
        )
        self.transfer = TransferConfig(multipart_threshold=8 * 1024**2, max_concurrency=2)
        self.ttl = settings.media_url_ttl_seconds

    def upload(self, path: Path, bucket: str, key: str, content_type: str) -> None:
        try:
            self.client.upload_file(
                str(path),
                bucket,
                key,
                ExtraArgs={"ContentType": content_type},
                Config=self.transfer,
            )
        except (BotoCoreError, ClientError, OSError, boto3.exceptions.S3UploadFailedError) as error:
            raise StorageUnavailable(
                "Object storage could not save the recording. Try again."
            ) from error

    def delete_prefix(self, bucket: str, prefix: str) -> None:
        # Video-scoped generated prefixes only, never user-supplied object paths.
        try:
            pages = self.client.get_paginator("list_objects_v2").paginate(
                Bucket=bucket, Prefix=prefix
            )
            for page in pages:
                objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
                if objects:
                    result = self.client.delete_objects(
                        Bucket=bucket, Delete={"Objects": objects, "Quiet": True}
                    )
                    if result.get("Errors"):
                        raise StorageUnavailable(
                            "Some recording files could not be deleted. Retry deletion."
                        )
        except (BotoCoreError, ClientError) as error:
            raise StorageUnavailable(
                "Object storage could not delete the recording. Retry deletion."
            ) from error

    def download(self, bucket: str, key: str, destination: Path, max_bytes: int) -> None:
        """Bounded stream to worker scratch; never pass storage URLs to FFmpeg."""
        try:
            response = self.client.get_object(Bucket=bucket, Key=key)
            # StreamingBody.__enter__ returns the raw HTTP response, which has no
            # iter_chunks(). Keep the SDK wrapper and close it on every exit path.
            with closing(response["Body"]) as source:
                if response["ContentLength"] > max_bytes:
                    raise StorageUnavailable(
                        "The stored recording exceeds the preparation size limit."
                    )
                size = 0
                with destination.open("wb") as target:
                    for chunk in source.iter_chunks(chunk_size=1024**2):
                        size += len(chunk)
                        if size > max_bytes:
                            raise StorageUnavailable(
                                "The stored recording exceeds the preparation size limit."
                            )
                        target.write(chunk)
        except (BotoCoreError, ClientError, OSError) as error:
            raise StorageUnavailable(
                "Object storage could not read the original recording."
            ) from error

    def signed_read(self, bucket: str, key: str, content_type: str) -> str:
        try:
            return self.signer.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": bucket,
                    "Key": key,
                    "ResponseContentType": content_type,
                    "ResponseContentDisposition": "inline",
                    "ResponseCacheControl": "private, no-store",
                },
                ExpiresIn=self.ttl,
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageUnavailable("A private playback link could not be created.") from error
