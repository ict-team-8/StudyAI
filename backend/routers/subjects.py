# routers/subjects.py
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import String, select, func, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession
from models.document_domain import DocumentTable  


from services.subject_service import get_or_create_subject, list_subjects

# auth 라우터에서 쓰는 Base/세션/유저/엔진 재사용
from routers.auth import Base, UserTable, get_session, current_active_user, engine

router = APIRouter()

from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

# =======================
# Pydantic Schemas
# 일종의 DTO, 요청 바디와 응답 JSON 형태를 정의하고 검증까지 담당합니다.
# =======================
class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

class SubjectRead(BaseModel):
    subject_id: int
    name: str
    class Config:
        from_attributes = True  # pydantic v2


# =======================
# Controllers
# =======================

## 과목 생성 API
@router.post("/subjects", response_model=SubjectRead, summary="과목 생성(있으면 재사용)")
async def create_subject(
    body: SubjectCreate, # request_body
    user: UserTable = Depends(current_active_user), # 현재 로그인한 사용자를 fastapi-users가 JWT 토큰으로 해석해 주입
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    subject = await get_or_create_subject(session, user.id, body.name)
    await session.commit() # 트랜잭션 커밋
    return subject

## 과목 조회 API
@router.get("/subjects", response_model=list[SubjectRead], summary="내 과목 목록/검색")
async def get_subjects(
    q: Optional[str] = Query(None, description="검색어"), # query string
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    subjects = await list_subjects(session, user.id, q)
    return subjects

@router.get("/subjects/{subject_id}/documents")
async def list_documents(subject_id: int, session: AsyncSession = Depends(get_session)):
    q = await session.execute(
        select(DocumentTable).where(DocumentTable.subject_id == subject_id)
    )
    docs = [{"id": row.document_id, "title": row.title} for row in q.scalars().all()]
    return docs

# # 초기 개발 편의: 테이블 자동 생성
# @router.on_event("startup")
# async def on_startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)
