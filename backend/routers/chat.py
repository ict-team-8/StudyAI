# 설명: 스마트 Q&A 라우터 (세션 생성 / 질문 / 기록 조회)
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPBearer
from fastapi import Security

from routers.auth import (
    Base, UserTable, get_session, current_active_user, engine
)
from models.chat_domain import ChatSessionTable, QATurnTable
from services.chat_service import ask_and_store

router = APIRouter()
bearer_scheme = HTTPBearer()

# ---------- DTO ----------
class SessionCreate(BaseModel):
    subject_id: int
    title: str | None = None

class SessionOut(BaseModel):
    chat_session_id: int

class AskIn(BaseModel):
    chat_session_id: int = Field(..., description="생성된 Q&A 세션 ID")
    subject_id: int
    question: str = Field(..., min_length=1)

class TurnOut(BaseModel):
    qa_turn_id: int
    question: str
    answer: str
    citations: list[str] | None

# ---------- 엔드포인트 ----------
@router.post("/chat/sessions", response_model=SessionOut,  summary="사용자가 QA 세션 생성")
async def create_session(
    body: SessionCreate,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    row = ChatSessionTable(user_id=user.id, subject_id=body.subject_id, title=body.title)
    session.add(row)
    await session.flush()
    await session.commit()
    return SessionOut(chat_session_id=row.chat_session_id)

@router.post("/chat/ask", response_model=TurnOut, summary="chat_session내에서 ai QA 생성")
async def ask(
    body: AskIn,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    db: AsyncSession = Depends(get_session),
):
    # 세션 유효성 확인(내 세션인지)
    sess = await db.get(ChatSessionTable, body.chat_session_id)
    if not sess or sess.user_id != user.id:
        raise HTTPException(404, "Chat session not found.")

    turn = await ask_and_store(
        db, user_id=user.id,
        chat_session_id=body.chat_session_id,
        subject_id=body.subject_id,
        question=body.question
    )
    return TurnOut(
        qa_turn_id=turn.qa_turn_id,
        question=turn.question,
        answer=turn.answer,
        citations=turn.citations or [],
    )

@router.get("/chat/sessions/{chat_session_id}/turns", response_model=list[TurnOut],
            summary="대화기록 조회")
async def list_turns(
    chat_session_id: int,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    db: AsyncSession = Depends(get_session),
):
    sess = await db.get(ChatSessionTable, chat_session_id)
    if not sess or sess.user_id != user.id:
        raise HTTPException(404, "Chat session not found.")

    rows = (await db.execute(
        # 최신 순 말고 오래된 순으로 보여줌
        QATurnTable.__table__.select()
        .where(QATurnTable.chat_session_id == chat_session_id)
        .order_by(QATurnTable.qa_turn_id.asc())
    )).mappings().all()

    return [
        TurnOut(
            qa_turn_id=r["qa_turn_id"],
            question=r["question"],
            answer=r["answer"],
            citations=r["citations"] or [],
        )
        for r in rows
    ]

# 개발 편의: 테이블 자동 생성
@router.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
