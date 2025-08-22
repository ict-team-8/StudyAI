# models/vector_domain.py
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, String, Integer, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from routers.auth import Base  # 재사용

Provider = SAEnum("chroma", "faiss", name="vector_provider")
VDocStatus = SAEnum("queued", "embedding", "done", "failed", name="vector_doc_status")

## vector_indexes 테이블 생성 ## 
class VectorIndexTable(Base):
    __tablename__ = "vector_indexes"

    vector_index_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id:    Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    subject_id: Mapped[int] = mapped_column(index=True, nullable=False)

    provider:   Mapped[str] = mapped_column(Provider, default="chroma", nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(200), default="sentence-transformers/all-mpnet-base-v2")
    collection_name: Mapped[str] = mapped_column(String(200), nullable=False)
    persist_dir:     Mapped[str] = mapped_column(String(300), nullable=False)

    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    doc_count:   Mapped[int] = mapped_column(Integer, default=0)
    created_at:  Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at:  Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "subject_id", name="uq_vector_user_subject"),
    )

## vector_docs 테이블 생성 ## 
class VectorDocTable(Base):
    __tablename__ = "vector_docs"

    vector_doc_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vector_index_id: Mapped[int] = mapped_column(ForeignKey(VectorIndexTable.vector_index_id), index=True, nullable=False)
    document_id:    Mapped[int] = mapped_column(index=True, nullable=False)
    chunk_count:    Mapped[int] = mapped_column(Integer, default=0)
    status:         Mapped[str] = mapped_column(VDocStatus, default="queued", nullable=False)
    created_at:     Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at:     Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
