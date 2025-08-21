# models/summary_domain.py
import uuid
from datetime import datetime
import enum

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

# Base, UserTable 재사용 (routers/auth.py 에서 정의)
from routers.auth import Base, UserTable

class SummaryType(str, enum.Enum):
    overall = "overall" # 핵심 개념
    traps = "traps" # 자주 나오는 함정/오개념
    concept_areas = "concept_areas" # 주요 개념 영역별 요약
    three_lines = "three_lines" # 3줄 최종 요약

class SummaryTable(Base):
    """
    과목 단위 요약(= 여러 문서를 RAG로 묶은 결과)
    - 보관용/이력용으로 적합하도록 최소 필드만 둠
    """
    __tablename__ = "summaries"

    summary_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 누가/어떤 과목에 대해 만든 요약인지
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.subject_id"), index=True, nullable=False)

    # (옵션) 특정 문서 한 개 기준의 요약을 저장하고 싶다면 nullable 참조로도 가능 >> 없앰!
    # document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.document_id"), nullable=True)

    type: Mapped[str] = mapped_column(String(32), default="overall", nullable=False)   # SummaryType 값
    topic: Mapped[str] = mapped_column(String(500), default="전체 시험 대비 요약", nullable=False)

    content_md: Mapped[str] = mapped_column(Text, nullable=False)  # 마크다운 본문
    model: Mapped[str] = mapped_column(String(100), default="gemini-2.5-flash", nullable=False)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
