from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["queries"])


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)


@router.post("/queries", status_code=501)
def ask_question(request: QueryRequest) -> None:
    raise HTTPException(status_code=501, detail="Query workflow is not implemented yet.")
