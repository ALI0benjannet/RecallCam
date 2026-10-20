# RecallCam product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operators investigate recorded footage, ask questions, view answers and evidence clips, and submit feedback. Supervisors inherit those features and can export evidence, inspect audit logs, and manage standing queries when Stage 2 is implemented. Administrators have all features and manage users/roles, cameras/videos, processing, retention and model versions.

## Product Purpose

RecallCam searches video archives and answers investigation questions with timestamped evidence. Supported investigation types and acceptance criteria come from the [cahier des charges](docs/RecallCam_Cahier_des_Charges.md). A plausible answer without supporting footage is not successful behavior.

## Operating Context

Administrators create user accounts. Login issues a signed expiring JWT; there are no server-side authentication sessions or refresh tokens. Uploading footage and selecting Process are separate actions. One indexing job runs at a time, sequentially by model stage. Recording date/time and camera context establish evidence timestamps; upload time is not recording time.

The team develops on different platforms. Service URLs, model names, credentials and processing device choices are configured, not hard-coded. FastAPI serves application and query logic; a separate worker indexes videos; VLM/LLM inference uses external HTTP services.

Frontend, backend, worker and infrastructure are packaged in Docker Compose. Only LLM/VLM serving stays native/outside Docker. The current worker container is explicitly standby until queue consumption is implemented; packaging is not a claim of completed indexing.

## Capabilities and Constraints

The authoritative requirements cover multilingual English/French/Arabic questions, cited answers, counting from structured events, retention/deletion, access controls and audit, activity-based indexing and resumable processing. Full details live in the specification and supplemental architecture documents; this context does not reduce their scope.

The current implementation slice is authentication, administrator-created accounts, camera metadata management and administrative audit. Uploads, indexing and investigation answers must remain visibly unavailable until connected. No invented footage, metrics, job progress or working search results belong in the interface.

## Brand Commitments

The name is RecallCam. The user delegated the color palette and visual direction, requested Tailwind CSS and shadcn/ui where appropriate, and required action notifications throughout the app. Avoid purple AI-style pages. Use direct, factual product language and evidence terminology.

The user requested a richer logo with recognizable camera/surveillance imagery and an AI cue. The current identity uses a CCTV camera with integrated circuit nodes, retaining the forest-green/amber palette. Preserve this recognizable camera-and-AI direction in future brand changes.

Visual choices and reusable UI rules belong in [DESIGN.md](DESIGN.md). The generated logo and app icon are in `front/public/brand/`, with provenance recorded beside them.

## Evidence on Hand

The repository has the source specification, supplemental architecture/pipeline documents and a development scaffold. No customer testimonials, production adoption claims, or new processing-throughput measurements have been supplied.

## Product Principles

- Preserve the connection from every result to original footage and its timeline.
- Make permission, processing, error and availability states understandable.
- Distinguish uploaded footage from footage ready for indexed investigation.
- Keep application behavior portable through configuration.
- Preserve privacy, licence and deletion requirements from the source specification.
