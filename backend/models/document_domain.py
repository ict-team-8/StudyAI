# models/document_domain.py
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from routers.auth import Base, UserTable  # 재사용

SourceType = SAEnum("PDF", "TEXT", "OCR", name="source_type")
DocStatus  = SAEnum("uploaded", "parsed", "indexed", name="document_status")

class DocumentTable(Base):
    __tablename__ = "documents"

    document_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id:     Mapped[uuid.UUID] = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)
    subject_id:  Mapped[int] = mapped_column(index=True, nullable=False)  # FK(subjects.subject_id)로 마이그레이션 권장
    title:       Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(SourceType, nullable=False)  # 'PDF' | 'TEXT'
    file_url:    Mapped[str | None] = mapped_column(Text, nullable=True)  # 저장경로(옵션)
    text_hash:   Mapped[str | None] = mapped_column(String(64), nullable=True)
    status:      Mapped[str] = mapped_column(DocStatus, default="uploaded", nullable=False)
    created_at:  Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
