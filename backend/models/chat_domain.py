# 설명: ERD의 chat_sessions, qa_turns 테이블 정의 (SQLAlchemy 2.x)
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, Integer, Text, JSON, String, DateTime, UUID
from routers.auth import Base, UserTable  # 기존 Base 재사용


class ChatSessionTable(Base):
    __tablename__ = "chat_sessions"
    chat_session_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user_id:     Mapped[uuid.UUID] = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    turns: Mapped[list["QATurnTable"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

class QATurnTable(Base):
    __tablename__ = "qa_turns"
    qa_turn_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chat_session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.chat_session_id"), nullable=False) # 숫자 FK (칼럼 저장)
    # user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user_id:     Mapped[uuid.UUID] = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)

    # 질문/답변
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer:   Mapped[str] = mapped_column(Text, nullable=False, default="")
    has_answer: Mapped[bool] = mapped_column(nullable=False, default=False)

    # 근거(출처) – 문자열 목록을 JSON으로 저장 (예: ["문서명 p.3", "문서명 p.7"...])
    citations: Mapped[list[str] | None] = mapped_column(JSON)

    # 생성시각
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ChatSessionTable"] = relationship(back_populates="turns") # ORM 관계 필드 (객체 탐색)
