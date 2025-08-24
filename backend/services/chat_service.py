# 설명: 스마트 Q&A 도메인 로직(벡터 검색 → 재정렬 → LLM 답변 생성 → [n] 인라인 인용 → ERD 저장용 citation 텍스트 구성)
from __future__ import annotations
from typing import List, Tuple
import uuid, re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from langchain_community.vectorstores import Chroma
from sentence_transformers import CrossEncoder

from models.chat_domain import ChatSessionTable, QATurnTable
from models.vector_domain import VectorIndexTable
from services.ai_service_global import _EMBEDDINGS, llm, question_prompt  # 이미 있는 공용 모듈

# Colab 예제와 동일한 재정렬 모델(빠르고 가벼움)
_reranker = CrossEncoder("BAAI/bge-reranker-base")

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
    vectordb = Chroma(
        collection_name=index_row.collection_name,
        persist_directory=index_row.persist_dir,
        embedding_function=_EMBEDDINGS,
    )
        # 🔎 디버깅: 컬렉션 문서 수를 확인
    try:
        count = vectordb._collection.count()
        if not count:
            # 여기서 바로 예외를 내주면 프론트가 원인 파악 쉬움
            raise HTTPException(409, "Vector index is empty. Re-run indexing for this subject.")
    except Exception:
        # 일부 버전에서 _collection 접근이 달라질 수 있음 → 검색으로도 체크
        pass
    return vectordb

# def _load_chroma(vindex: VectorIndexTable) -> Chroma:
#     """RDB에 저장된 (collection_name, persist_dir)로 Chroma 연결"""
#     return Chroma(
#         collection_name=vindex.collection_name,
#         persist_directory=vindex.persist_dir,
#         embedding_function=_EMBEDDINGS,
#     )

# async def _get_vector_index(session: AsyncSession, user_id: uuid.UUID, subject_id: int) -> VectorIndexTable:
#     """user+subject 조합의 인덱스 1행을 로드. 없으면 아직 업로드/인덱싱 전이므로 404."""
#     q = await session.execute(
#         select(VectorIndexTable).where(
#             VectorIndexTable.user_id == user_id,
#             VectorIndexTable.subject_id == subject_id
#         )
#     )
#     row = q.scalar_one_or_none()
#     if not row:
#         raise HTTPException(404, "No vector index for this subject. Upload materials first.")
#     return row

def _format_source(doc) -> str:
    """프론트에 바로 뿌릴 ‘근거 텍스트’로 정리 (문서명 + 페이지 or 스니펫)"""
    src = doc.metadata.get("source", "Unknown")
    page = doc.metadata.get("page")
    if page is not None:
        return f"{src}, p.{page}"
    snippet = doc.page_content[:70].replace("\n", " ")
    return f"{src}: \"{snippet}...\""

def _label_with_numbers(docs) -> tuple[str, dict[str, str]]:
    """
    컨텍스트 문단에 [1][2]… 라벨을 부여해 LLM이 그대로 인용하도록 함.
    반환: (라벨이 붙은 컨텍스트 문자열, { "1": "문서명 p.x", ... })
    """
    parts, idx2src = [], {}
    for i, d in enumerate(docs, start=1):
        parts.append(f"[{i}] {d.page_content}")
        idx2src[str(i)] = _format_source(d)
    return "\n\n".join(parts), idx2src

def _extract_used_citations(answer: str, idx2src: dict[str, str]) -> list[str]:
    """답변 내 [n]을 찾아 실제 근거 텍스트로 매핑"""
    nums = sorted(set(re.findall(r"\[(\d+)\]", answer)))
    return [f"[{n}] {idx2src[n]}" for n in nums if n in idx2src]

async def ask_and_store(
    db: AsyncSession,
    *, user_id: uuid.UUID, chat_session_id: int, subject_id: int, question: str
) -> QATurnTable:
    """
    1) user+subject 인덱스 로드 → vectordb 검색(k=8)
    2) reranker로 상위 5개 정렬
    3) 컨텍스트에 [n] 붙여 question_prompt로 LLM 호출
    4) 답변 + citations JSON을 qa_turns에 저장 후 반환
    """
    vindex = await _get_vector_index(db, user_id, subject_id)
    vectordb = _load_chroma(vindex)

    retriever = vectordb.as_retriever(search_kwargs={"k": 8})
    #cands = await retriever.abatch([question])  # async-friendly; 1개 질의
    # docs = cands[0] if cands else []
    # AFTER: 한 건 비동기 검색
    docs = await retriever.ainvoke(question) 
    
    # 재정렬
    pairs = [[question, d.page_content] for d in docs]
    scores = _reranker.predict(pairs)
    reranked = [d for d, _ in sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)[:5]]

    labeled_ctx, idx2src = _label_with_numbers(reranked)
    prompt = question_prompt.format(context=labeled_ctx, question=question)
    resp = llm.invoke(prompt)  # LangChain LLM 인터페이스

    answer = (getattr(resp, "content", None) or str(resp)).strip()
    used = _extract_used_citations(answer, idx2src)

    turn = QATurnTable(
        chat_session_id=chat_session_id,
        user_id=user_id,
        question=question,
        answer=answer,
        has_answer=(answer.lower() != "no answer"),
        citations=used
    )
    db.add(turn)
    await db.flush()    # qa_turn_id 부여
    await db.commit()
    await db.refresh(turn)
    return turn
