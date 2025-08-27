# services/summary_service.py
from typing import Tuple
from datetime import datetime
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA

from models.summary_domain import SummaryTable, SummaryType
from models.vector_domain import VectorIndexTable  # (이미 만들었던 vector_indexes 테이블)
from services.ai_service_global import (
    _EMBEDDINGS,
    llm,
    summary_prompt,
    refine_with_crag,
)

async def _get_vector_index(session: AsyncSession, user_id: uuid.UUID, subject_id: int) -> VectorIndexTable:
    """user+subject 에 해당하는 인덱스 1행을 가져온다(없으면 404)."""
    q = await session.execute(
        select(VectorIndexTable).where(
            VectorIndexTable.user_id == user_id,
            VectorIndexTable.subject_id == subject_id
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        # 업로드/인덱싱이 아직 안 된 과목
        raise HTTPException(404, "No vector index for this subject. Upload materials first.")
    return row

def _load_chroma(index_row: VectorIndexTable) -> Chroma:
    """
    RDB에 저장된 컬렉션 식별자(이름/경로)로 Chroma를 로드한다.
    실제 임베딩/검색은 디스크의 persist_dir에서 일어난다.
    """
    return Chroma(
        collection_name=index_row.collection_name,
        persist_directory=index_row.persist_dir,
        embedding_function=_EMBEDDINGS,
    )

async def create_subject_summary(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    subject_id: int,
    topic: str,
    type_: SummaryType,
) -> dict:
    """
    1) (user, subject) 인덱스 조회 → Chroma 로드
    2) retriever = vectordb.as_retriever(k=8)
    3) RetrievalQA 체인 구성(prompt=summary_prompt)
    4) refine_with_crag로 검증/재시도
    5) summaries INSERT
    """
    # 1. 인덱스 로드
    vindex = await _get_vector_index(session, user_id, subject_id)
    vectordb = _load_chroma(vindex)

    # 2. 리트리버
    retriever = vectordb.as_retriever(search_kwargs={"k": 8})

    # 3. 체인 구성
    summary_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        chain_type="stuff",
        chain_type_kwargs={"prompt": summary_prompt},
    )

    # 4. CRAG
    summary_text, ok, reason = refine_with_crag(
        summary_chain, llm, retriever, topic, max_iters=2, verbose=False
    )

    # 5. DB 기록
    row = SummaryTable(
        user_id=user_id,
        subject_id=subject_id,
      #   document_id=None,          # 과목 전체 요약이므로 None
        type=type_.value if hasattr(type_, "value") else str(type_),
        topic=topic,
        content_md=summary_text,
        model="gemini-2.5-flash",
    )
    session.add(row)
    await session.flush()   # summary_id 확보
    await session.commit()

    return {
        "summary_id": row.summary_id,
        "ok": ok,
        "reason": reason,
        "summary": summary_text,
    }
