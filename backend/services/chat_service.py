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
import asyncio # 추가
from langchain.schema import Document  # 추가 


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


# ---------- helpers: Colab의 label & citation 추출을 서버용으로 그대로 ----------
def _format_source(doc: Document) -> str:
    src = doc.metadata.get("source", "Unknown")
    page = doc.metadata.get("page")
    if page is not None:
        return f"{src}, p.{page}"
    snippet = doc.page_content[:70].replace("\n", " ")
    return f"{src}: \"{snippet}...\""

def _label_and_map_documents_multi(docs_lists: List[List[Document]]) -> tuple[str, List[Document], dict]:
    all_docs: List[Document] = []
    labeled_parts: List[str] = []
    idx2src: dict[str, str] = {}

    counter = 1  # ✅ 항상 1부터 시작 (Colab 동일)
    for docs in docs_lists:
        for d in docs:
            all_docs.append(d)
            labeled_parts.append(f"[{counter}] {d.page_content}")
            idx2src[str(counter)] = _format_source(d)
            counter += 1

    return "\n\n".join(labeled_parts), all_docs, idx2src

def _filter_used_sources_list(answer_text: str, idx2src: dict[str, str]) -> list[str]:
    nums = sorted(set(re.findall(r"\[(\d+)\]", answer_text)))
    return [f"[{n}] {idx2src[n]}" for n in nums if n in idx2src]


# ---------- 핵심: Colab QA 스텝만 수행 ----------
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
    # 0) 인덱스/Chroma 로드
    vindex = await _get_vector_index(db, user_id, subject_id)
    vectordb = _load_chroma(vindex)

    # 1) retrieval (Colab: retriever.get_relevant_documents)
    retriever = vectordb.as_retriever(search_kwargs={"k": 8})
    # retriever.get_relevant_documents 는 sync → 스레드로 돌려 비동기화
    loop = asyncio.get_running_loop()
    docs: List[Document] = await loop.run_in_executor(
        None, retriever.get_relevant_documents, question
    )
    
    # 2) rerank (Colab : CrossEncoder.predict)
    pairs = [[question, d.page_content] for d in docs]
    scores = await loop.run_in_executor(None, _reranker.predict, pairs)
    reranked = [d for d, _ in sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)[:5]]

    # 3) 컨텍스트에 [n] 라벨 부여 (Colab과 동일)
    labeled_ctx, _all_docs, idx2src = _label_and_map_documents_multi([reranked])
    
    # 4) LLM 호출 (Colab 동일 프롬포트)
    prompt = question_prompt.format(context=labeled_ctx, question=question)
    resp = llm.invoke(prompt)  # langchain-google-genai ChatGoogleGenerativeAI
    answer = (getattr(resp, "content", None) or str(resp)).strip()

    answer = (getattr(resp, "content", None) or str(resp)).strip()
    
    # 5) 답변 속 [n] → 인용 텍스트 매핑 (Colab 동일)
    used_citations = _filter_used_sources_list(answer, idx2src)  # ["[1] 소스...", "[2] ..."]

    if not used_citations and idx2src:
        used = [f"[1] {idx2src['1']}"]
        answer = answer + " [1]"

    # 6) 저장
    turn = QATurnTable(
        chat_session_id=chat_session_id,
        user_id=user_id,
        question=question,
        answer=answer,
        has_answer=(answer.lower() != "no answer"),
        citations=used_citations,
    )
    db.add(turn)
    await db.flush()    # qa_turn_id 부여
    await db.commit()
    await db.refresh(turn)
    return turn
