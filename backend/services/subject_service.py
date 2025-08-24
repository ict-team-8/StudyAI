import uuid
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.subject_domain import SubjectTable

async def get_or_create_subject(
    session: AsyncSession, user_id: uuid.UUID, name: str
) -> SubjectTable:
    # 단순 정규화: 공백 트림
    norm = name.strip()
    if not norm:
        raise HTTPException(422, "name is empty")

    # 같은 유저 + 같은 이름(대/소문자 무시) 이미 있으면 그걸 반환
    q = await session.execute(
        select(SubjectTable).where(
            SubjectTable.user_id == user_id,
            func.lower(SubjectTable.name) == norm.lower(),
        )
    )
    row = q.scalar_one_or_none()
    if row:
        return row

    # 없다면 생성 (여기서는 flush만 해서 PK 확보, commit은 컨트롤러에서)
    row = SubjectTable(user_id=user_id, name=norm)
    session.add(row)
    await session.flush()  # subject_id 확보
    return row

async def list_subjects(
    session: AsyncSession, user_id: uuid.UUID, keyword: Optional[str]
) -> List[SubjectTable]:
    stmt = select(SubjectTable).where(SubjectTable.user_id == user_id)
    if keyword:
        like = f"%{keyword.lower().strip()}%"
        stmt = stmt.where(func.lower(SubjectTable.name).like(like))
    stmt = stmt.order_by(SubjectTable.created_at.desc())
    res = await session.execute(stmt)
    return list(res.scalars().all())
