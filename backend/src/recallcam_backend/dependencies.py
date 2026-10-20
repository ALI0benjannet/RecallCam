from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from recallcam_backend.security import Principal


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def get_principal(request: Request) -> Principal:
    return request.state.user


DatabaseSession = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[Principal, Depends(get_principal)]
