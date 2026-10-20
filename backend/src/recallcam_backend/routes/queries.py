from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from recallcam_backend.security import require_permission
from recallcam_shared.contracts.access import Permission

router = APIRouter(tags=["queries"])


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)


@router.post("/queries", status_code=501)
@require_permission(Permission.QUERIES_CREATE)
def ask_question(request: QueryRequest) -> None:
    raise HTTPException(status_code=501, detail="Query workflow is not implemented yet.")
