# routers/summaries.py
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, Security
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import (
    Base, UserTable, get_session, current_active_user, engine
)
from services.summary_service import create_subject_summary
from models.summary_domain import SummaryType

from fastapi.security import HTTPBearer
from services.pdf_service import build_summary_pdf_bytes, _safe_filename
from models.summary_domain import SummaryTable
from models.subject_domain import SubjectTable
from sqlalchemy import select
from urllib.parse import quote

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

# PDF 다운로드 엔드포인트 추가
@router.get("/summaries/{summary_id}/pdf")
async def download_summary_pdf(
    summary_id: int,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    row = await session.get(SummaryTable, summary_id)
    if not row:
        raise HTTPException(404, "Summary not found.")
    if str(row.user_id) != str(user.id):
        raise HTTPException(403, "Forbidden.")
    
    # 과목명 조회 
    subject_title = (
        await session.execute(
            select(SubjectTable.name).where(SubjectTable.subject_id == row.subject_id)
        )
    ).scalar_one_or_none()

    # title = row.topic or "요약"
    body  = row.content_md or ""

    pdf_title = subject_title or row.topic or "요약"
    pdf_bytes = build_summary_pdf_bytes(title=pdf_title, body_md=body)

    filename = f"{_safe_filename(subject_title or row.topic or '요약')}_요약.pdf"
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        "Cache-Control": "no-store",
        # ⬇️ JS에서 Content-Disposition 읽을 수 있도록 CORS 노출
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


# # 개발 편의: 테이블 자동 생성
# @router.on_event("startup")
# async def on_startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)
