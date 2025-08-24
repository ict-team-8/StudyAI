# models/quiz_domain.py
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import JSON  # PostgreSQL 사용 시
from sqlalchemy.orm import Mapped, mapped_column, relationship
from routers.auth import Base, UserTable  # 재사용

# Enum 정의
DifficultyEnum = SAEnum("easy", "medium", "hard", name="quiz_difficulty")
QuizTypeEnum   = SAEnum("multiple_choice", "true_false", "short_answer", name="quiz_type")
QuizStatusEnum = SAEnum("pending", "active", "inactive", name="quiz_status")

QuestionTypeEnum = SAEnum("multiple_choice", "short_answer", name="question_type")


class QuizTable(Base):
    __tablename__ = "quizzes"

    quiz_id:          Mapped[int]       = mapped_column(primary_key=True, autoincrement=True)
    user_id:          Mapped[uuid.UUID] = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)
    subject_id:  Mapped[int] = mapped_column(index=True, nullable=False)

    title:            Mapped[str]       = mapped_column(String(255), nullable=False)
    requested_count:  Mapped[int]       = mapped_column(Integer, default=0, nullable=False)
    difficulty:       Mapped[str]       = mapped_column(DifficultyEnum, nullable=False)
    type:             Mapped[str]       = mapped_column(QuizTypeEnum, nullable=False)
    status:           Mapped[str]       = mapped_column(QuizStatusEnum, default="pending", nullable=False)

    created_at:       Mapped[datetime]  = mapped_column(default=datetime.utcnow, nullable=False)


class QuestionBankTable(Base):
    __tablename__ = "question_banks"

    question_id:  Mapped[int]      = mapped_column(primary_key=True, autoincrement=True)
    quiz_id:      Mapped[int]      = mapped_column(ForeignKey(QuizTable.quiz_id, ondelete="CASCADE"), index=True)

    qtype:        Mapped[str]      = mapped_column(QuestionTypeEnum, nullable=False)
    difficulty:   Mapped[str]      = mapped_column(DifficultyEnum, nullable=False)
    stem:         Mapped[str]      = mapped_column(Text, nullable=False)  # 문제 지문
    options:      Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 객관식 선택지 (JSON)
    correct_text: Mapped[str]      = mapped_column(Text, nullable=False)  # 정답
    explanation:  Mapped[str | None] = mapped_column(Text, nullable=True)  # 해설
    citations:    Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 출처 (JSON)
    created_at:   Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)

    # 관계 설정
    quiz = relationship("QuizTable", back_populates="questions")
