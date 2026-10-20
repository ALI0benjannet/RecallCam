"""Deliberate first-administrator bootstrap. No seeded or fallback credentials."""

import argparse
import getpass
import sys

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from recallcam_backend.routes.users import lock_user_administration
from recallcam_backend.security import hash_password
from recallcam_backend.services.audit import record_audit
from recallcam_shared.contracts.access import Role
from recallcam_shared.contracts.accounts import UserCreate
from recallcam_shared.database.connection import create_database_engine, create_session_factory
from recallcam_shared.database.models import User
from recallcam_shared.settings import Settings


def main() -> int:
    parser = argparse.ArgumentParser(description="RecallCam account administration")
    commands = parser.add_subparsers(dest="command", required=True)
    bootstrap = commands.add_parser("create-admin", help="Create the first administrator only")
    bootstrap.add_argument("--email", required=True)
    bootstrap.add_argument("--display-name", required=True)
    args = parser.parse_args()
    if not sys.stdin.isatty():
        print("Run this command in an interactive terminal to enter a hidden password.", file=sys.stderr)
        return 2
    password = getpass.getpass("Administrator password (12–128 characters): ")
    confirmation = getpass.getpass("Confirm administrator password: ")
    if password != confirmation:
        print("Passwords do not match. No account was created.", file=sys.stderr)
        return 2
    try:
        account = UserCreate(
            email=args.email,
            display_name=args.display_name,
            password=password,
            role=Role.ADMINISTRATOR,
        )
    except ValidationError as error:
        # Never stringify the full validation exception: its input may contain the password.
        for item in error.errors(include_input=False):
            print(f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}", file=sys.stderr)
        return 2
    engine = create_database_engine(Settings())
    try:
        with create_session_factory(engine)() as session:
            lock_user_administration(session)
            if session.scalar(select(func.count()).select_from(User)):
                print(
                    "Bootstrap is available only for an empty user table. Use an existing admin.",
                    file=sys.stderr,
                )
                return 2
            user = User(
                email=str(account.email).lower(),
                display_name=account.display_name,
                password_hash=hash_password(account.password.get_secret_value()),
                role=Role.ADMINISTRATOR.value,
            )
            session.add(user)
            session.flush()
            record_audit(
                session,
                actor_id=user.user_id,
                action="user.bootstrap_created",
                resource_type="user",
                resource_id=user.user_id,
            )
            session.commit()
        print("First administrator created. Sign in through the application.")
        return 0
    except SQLAlchemyError:
        print(
            "Database unavailable or schema missing. Start PostgreSQL and run alembic upgrade head.",
            file=sys.stderr,
        )
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
