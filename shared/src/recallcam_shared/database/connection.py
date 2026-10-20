"""PostgreSQL connections shared by API and future workers; never create tables implicitly."""

from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session, sessionmaker

from recallcam_shared.settings import Settings


def database_url(settings: Settings) -> URL:
    url = make_url(settings.database_url.get_secret_value())
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL must use PostgreSQL with the psycopg driver.")
    return url


def create_database_engine(settings: Settings) -> Engine:
    return create_engine(
        database_url(settings),
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args={"connect_timeout": 5},
    )


def create_session_factory(engine: Engine | Connection) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)
