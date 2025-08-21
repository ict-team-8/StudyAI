# models/subject.py
import uuid
from datetime import datetime

from sqlalchemy import String, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

# Base, UserTable은 이미 routers/auth.py 에 정의되어 있으니 재사용
from routers.auth import Base, UserTable


# =======================
# SQLAlchemy Model
# - Base를 상속받아, DB에 실제로 만들어진 테이블과 칼럼들을 정의
# =======================
class SubjectTable(Base):
    __tablename__ = "subjects"

    subject_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(UserTable.id), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # 과목명
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)

    # 유저별 과목명 유니크
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_subject_user_name"),
    )