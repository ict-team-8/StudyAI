# models/quiz_domain.py
import uuid
from datetime import datetime
from typing import TypedDict, Optional

from sqlalchemy import (
    String, Integer, ForeignKey, Enum as SAEnum, Text, Float, DateTime, Boolean
)
# from sqlalchemy.dialects.postgresql import JSONB  # PostgreSQL
from sqlalchemy import JSON  # 추가

from sqlalchemy.orm import Mapped, mapped_column, relationship

from routers.auth import Base, UserTable  # 재사용


# -------------------- Enum 정의 --------------------
DifficultyEnum = SAEnum("easy", "medium", "hard", name="quiz_difficulty")
QuizTypeEnum   = SAEnum("multiple_choice", "true_false", "short_answer", name="quiz_type")
QuizStatusEnum = SAEnum("creating", "ready", "error", name="quiz_status")

QuestionTypeEnum = SAEnum("multiple_choice", "short_answer", name="question_type")

# 등급(A~F 등) – 필요 시 조정
GradeEnum = SAEnum("A", "B", "C", "D", "E", "F", name="quiz_grade")


# -------------------- JSON 스키마(TypedDict) --------------------
class QuizSettings(TypedDict, total=False):
    # ERD: type / 제한모드 / 문항수 / time_limit_sec / null 허용 등
    type: str  # "fixed" | "adaptive" 등 자유롭게
    mode: str  # "제한모드" 등
    item_count: int  # 제한 문항 수
    time_limit_sec: int | None  # 제한 시간이 없으면 null
    allow_skip: bool


class OptionsPayload(TypedDict):
    # 객관식 선택지: {"A": "text...", "B": "..."} 등
    # short_answer의 경우 빈 객체 또는 None
    __root__: dict


class CitationSpan(TypedDict):
    # 예: {"chunk_id": 123, "page": 5, "span": [50, 80]}
    chunk_id: int
    page: int
    span: list[int]  # [start, end]


# -------------------- 테이블 --------------------
class QuizTable(Base):
    """
    퀴즈(문서 단위 생성 요청) – 상단 ERD의 quizzes
    """
    __tablename__ = "quizzes"

    quiz_id:         Mapped[int]        = mapped_column(primary_key=True, autoincrement=True)
    user_id:         Mapped[uuid.UUID]  = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)
    subject_id:      Mapped[int]        = mapped_column(index=True, nullable=False)

    title:           Mapped[str]        = mapped_column(String(255), nullable=False)
    requested_count: Mapped[int]        = mapped_column(Integer, default=0, nullable=False)
    difficulty:      Mapped[str]        = mapped_column(DifficultyEnum, nullable=False)
    type:            Mapped[str]        = mapped_column(QuizTypeEnum, nullable=False)

    # ERD: settings JSONB (예: {"type":"fixed","mode":"문항수","time_limit_sec":...})
    settings    = mapped_column(JSON, nullable=True)
    options     = mapped_column(JSON, nullable=True)
    citations   = mapped_column(JSON, nullable=True)

    # 관계
    questions: Mapped[list["QuestionBankTable"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )
    attempts: Mapped[list["QuizAttemptTable"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )


class QuestionBankTable(Base):
    """
    생성된 문제 1개 – ERD의 question_banks
    """
    __tablename__ = "question_banks"

    question_bank_id: Mapped[int]       = mapped_column(primary_key=True, autoincrement=True)
    quiz_id:          Mapped[int]       = mapped_column(
        ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), index=True, nullable=False
    )

    qtype:            Mapped[str]       = mapped_column(QuestionTypeEnum, nullable=False)
    difficulty:       Mapped[str]       = mapped_column(DifficultyEnum, nullable=False)

    stem:             Mapped[str]       = mapped_column(Text, nullable=False)        # 문제 지문
    options:          Mapped[dict | None]= mapped_column(JSON, nullable=True)       # 객관식 선택지
    correct_text:     Mapped[str]       = mapped_column(Text, nullable=False)        # 정답(텍스트)
    explanation:      Mapped[str | None]= mapped_column(Text, nullable=True)         # 해설

    # ERD: citations JSONB (예: {"chunk_id":123,"page":5,"span":[50,80],...} 의 배열도 가능)
    citations:        Mapped[dict | list[dict] | None] = mapped_column(JSON, nullable=True)

    created_at:       Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # 관계
    quiz: Mapped["QuizTable"] = relationship(back_populates="questions")
    attempt_items: Mapped[list["AttemptItemTable"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", passive_deletes=True
    )


class QuizAttemptTable(Base):
    """
    한 사용자가 퀴즈를 '한 번' 푼 기록 – ERD의 quiz_attempt
    (집계/상단 데이터)
    """
    __tablename__ = "quiz_attempt"

    quiz_attempt_id: Mapped[int]        = mapped_column(primary_key=True, autoincrement=True)
    quiz_id:         Mapped[int]        = mapped_column(
        ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id:         Mapped[uuid.UUID]  = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)

    started_at:      Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at:     Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    correct_count:   Mapped[int]        = mapped_column(Integer, default=0, nullable=False)  # 정답 개수
    accuracy:        Mapped[float]      = mapped_column(Float, default=0.0, nullable=False)  # 정확도(0~1 또는 0~100)
    score_total:     Mapped[float]      = mapped_column(Float, default=0.0, nullable=False)  # 총점(옵션)
    grade:           Mapped[str | None] = mapped_column(GradeEnum, nullable=True)            # 등급(A~F 등)

    created_at:      Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # 관계
    quiz: Mapped["QuizTable"] = relationship(back_populates="attempts")
    items: Mapped[list["AttemptItemTable"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", passive_deletes=True
    )


class AttemptItemTable(Base):
    """
    사용자의 문항별 풀이 로그 – ERD의 attempt_item
    (문항 단위 상세 기록)
    """
    __tablename__ = "attempt_item"

    attempt_item_id:  Mapped[int]       = mapped_column(primary_key=True, autoincrement=True)
    quiz_attempt_id:  Mapped[int]       = mapped_column(
        ForeignKey("quiz_attempt.quiz_attempt_id", ondelete="CASCADE"), index=True, nullable=False
    )
    question_bank_id: Mapped[int]       = mapped_column(
        ForeignKey("question_banks.question_bank_id", ondelete="CASCADE"), index=True, nullable=False
    )

    user_answer:      Mapped[str | None]= mapped_column(Text, nullable=True)   # 사용자가 제출한 답
    is_correct:       Mapped[bool]      = mapped_column(Boolean, default=False, nullable=False)  # 정답 여부
    score:            Mapped[float]     = mapped_column(Float, default=0.0, nullable=False)      # 문항 점수(옵션)
    time_ms:          Mapped[int]       = mapped_column(Integer, default=0, nullable=False)      # 풀이 소요 시간(ms)

    created_at:       Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # 관계
    attempt:  Mapped["QuizAttemptTable"]  = relationship(back_populates="items")
    question: Mapped["QuestionBankTable"] = relationship(back_populates="attempt_items")
