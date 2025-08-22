# routers/summaries.py
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import (
    Base, UserTable, get_session, current_active_user, engine
)
from services.summary_service import create_subject_summary
from models.summary_domain import SummaryType

from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

router = APIRouter()

# ======== Pydantic Schemas (요청/응답 DTO) ========
class SummaryCreate(BaseModel):
    subject_id: int = Field(..., description="요약할 과목 ID")
    topic: str = Field(..., min_length=1, description="요약 주제(프롬프트)")
    type: Literal["overall", "traps", "concept_areas", "three_lines"] = "overall"

class SummaryOut(BaseModel):
    summary_id: int
    ok: bool
    reason: str
    summary: str

# ======== Controller ========
@router.post("/summaries", response_model=SummaryOut, summary="과목 단위 RAG 요약 생성")
async def make_summary(
    body: SummaryCreate,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    result = await create_subject_summary(
        session,
        user_id=user.id,
        subject_id=body.subject_id,
        topic=body.topic,
        type_=SummaryType(body.type),
    )
    return result

# 개발 편의: 테이블 자동 생성
@router.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
