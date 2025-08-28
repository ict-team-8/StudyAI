# services/quiz_service.py
from __future__ import annotations
from typing import List, Optional, Dict, Union
import io
import os
import random
import re
import requests
from pydantic import field_validator
import json
from datetime import datetime
from fastapi import HTTPException

from dateutil import parser
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from langchain_community.vectorstores import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI

from models.vector_domain import VectorIndexTable 
from models.document_domain import DocumentTable    # 문서 테이블
from models.quiz_domain import QuizTable, QuestionBankTable  # 퀴즈 및 문항 테이블
from models.quiz_domain import AttemptItemTable, QuizAttemptTable  # 문항별 풀이 로그 테이블
from services.ai_service_global import (
    _EMBEDDINGS,
    llm,
)

class NextRequest(BaseModel):
    quiz_attempt_id: int        # 세트 단위 시도 id
    question_bank_id: int       # 푼 문항 id (AttemptItemTable 기준)
    user_answer: str            # 사용자가 제출한 답
    time_ms: int                # 소요 시간 (ms 단위)

class CompleteRequest(BaseModel):
    quiz_attempt_id: int
    finished_at: str | None = None


DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    
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


# ========= [1] 출력 스키마 =========
class QuizQuestion(BaseModel):
    """
    생성된 문제 1개를 표현하는 모델
    """
    id: int
    type: str                      # 객관식 | 단답형 | 주관식
    difficulty: str
    question: str
    options: Optional[List[str]] = None
    answer: str
    explanation: Optional[str] = None          # 해설
    citations: Optional[Dict[str, str]] = None # 출처 (문서 정보)

    @field_validator("citations", mode="before")
    @classmethod
    def parse_citations(cls, v):
        # 문자열로 들어오면 dict로 변환
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {"source": v}
        return v

class QuizSet(BaseModel):
    """
    하나의 자료에서 생성된 문제 세트
    """
    source: str
    items: List[QuizQuestion]


# ========= [2] 문제 생성기 =========
class QuizGenerator:
    """
    현재 세션에서 생성한 '임베딩 벡터DB + 청크'를 기반으로 문제를 생성.
    - temp_vectordb 를 사용
    - CONTEXT는 retriever를 통해 유사 청크를 모아서 구성
    - LLM 구조화 출력으로 JSON 스키마 보장
    """
    def __init__(
        self,
        llm: ChatGoogleGenerativeAI,
        vectordb: Chroma,
        source_name: str,
        bm25_threshold: float = 2.0,
        retriever_k: int = 6,
        sample_span: int = 2,
    ):
        self.llm = llm
        self.vdb = vectordb
        self.source = source_name
        self.retriever = self.vdb.as_retriever(search_kwargs={"k": max(retriever_k, sample_span)})
        self.sample_span = max(1, sample_span)
        self.bm25_threshold = bm25_threshold

        self._bm25 = None

    # --- 문자열 정규화 ---
    @staticmethod
    def _normalize_type(t: Optional[str]) -> str:
        """문제 유형 문자열 표준화"""
        if not isinstance(t, str):
            return ""
        m = {
            "객관식": "객관식", "multiple": "객관식", "mcq": "객관식",
            "단답형": "단답형", "short": "단답형",
            "주관식": "주관식", "essay": "주관식", "subjective": "주관식",
        }
        return m.get(t.strip().lower(), t)

    @staticmethod
    def _normalize_diff(d: str) -> str:
        """난이도 문자열 표준화"""
        m = {
            "쉬움": "쉬움", "easy": "쉬움",
            "보통": "보통", "medium": "보통", "중간": "보통",
            "어려움": "어려움", "hard": "어려움", "difficult": "어려움",
        }
        return m.get((d or "").strip().lower(), d)

    # --- LLM 한 문제 생성 ---
    def _gen_one(self, qid: int, qtype: str, difficulty: str, context: str, source: str) -> QuizQuestion:
        """
        LLM을 호출해 단일 문항 생성
        """
        structured = self.llm.with_structured_output(QuizQuestion)
        prompt = f"""
당신은 학습용 퀴즈 출제자입니다. 아래 CONTEXT의 내용에서만 근거를 찾아 정확히 1개의 문제를 만드세요.    

- type은 "{qtype}" 로 설정합니다.
- difficulty는 "{difficulty}" 로 설정합니다.
- 객관식(type="객관식")일 때:
  * options는 정확히 4개를 만드세요.
  * 오직 하나만 정답이어야 합니다.
  * answer에는 보기 중 정답 '텍스트'를 그대로 쓰세요.
  * explanation에는 '왜 정답인지'와 '오답 배제 근거'를 간단히 쓰세요.
- 단답형일 때: answer는 한두 문장 또는 핵심 키워드.
- 주관식일 때: answer는 채점 포인트(핵심 요점).
- CONTEXT 밖 사실은 절대 포함하지 마세요.
- citations: {{ "source": "{source}" }}
- id에는 {qid} 입력

CONTEXT:
{context}
"""
        return structured.invoke(prompt)

    # --- 문제 세트 생성 ---
    def generate(
    self,
    user_type: Union[str, List[str]],
    user_difficulty: str,
    n_questions: int = 5,
    random_seed: Optional[int] = None,
) -> QuizSet:
        if random_seed is not None:
            random.seed(random_seed)

        # ✅ 여러 유형 허용
        if isinstance(user_type, str):
            qtypes = [self._normalize_type(user_type)]
        else:
            qtypes = [self._normalize_type(t) for t in user_type or []]
        diff = self._normalize_diff(user_difficulty)

        items: List[QuizQuestion] = []
        for qid in range(1, n_questions + 1):
            
            qtype = random.choice(qtypes)   # ✅ 여러 유형 중 랜덤 선택
            
            # retriever로 랜덤 시드 쿼리 (ex: "sample") → 임의 문서 가져오기
            seed_docs = self.retriever.get_relevant_documents("sample")
            if not seed_docs:
                raise HTTPException(500, "No documents found in vector index.")

            seed = random.choice(seed_docs)

            retrieved = self.retriever.get_relevant_documents(seed.page_content[:200])
            picked = (
                retrieved[:self.sample_span]
                if len(retrieved) >= self.sample_span
                else retrieved or [seed]
            )

            context = "\n\n".join(d.page_content for d in picked)

            # LLM 호출해서 문항 생성
            item = self._gen_one(
                qid=qid, qtype=qtype, difficulty=diff, context=context, source=self.source
            )

            # 객관식 옵션 검증
            if qtype == "객관식" and (not item.options or len(item.options) != 4):
                item = self._gen_one(
                    qid=qid, qtype=qtype, difficulty=diff, context=context, source=self.source
                )

            items.append(item)

        return QuizSet(source=self.source, items=items)


# ========= [3] 공개 서비스 API =========
async def generate_quiz_for_subject(
    session: AsyncSession,
    *,
    user_id: str,
    subject_id: int,
    qtype: Union[str, List[str]],
    difficulty: str,
    num_questions: int,
    model_name: str | None = None,
) -> Dict[str, any]:
    """
    주어진 과목(subject_id)에 대해 퀴즈를 생성하고 DB에 저장
    - QuizTable + QuestionBankTable + QuizAttemptTable 생성
    - QuizSet(JSON) + quiz_attempt_id 반환
    """
    # 1. 인덱스 로드
    vindex = await _get_vector_index(session, user_id, subject_id)
    temp_vectordb = _load_chroma(vindex)
        
    source_name = f"subject-{subject_id} ({vindex.collection_name})"

    # 3) LLM 초기화 & 문제 생성
    gen = QuizGenerator(
                llm=llm,
                vectordb=temp_vectordb,
                source_name=source_name,
                bm25_threshold=2.0,    # BM25 설치 시 가벼운 신뢰도 점검
                retriever_k=6,
                sample_span=2,
            )
    quiz_set = gen.generate(user_type=qtype, user_difficulty=difficulty, n_questions=num_questions)

    # 4) QuizTable 저장
    new_quiz = QuizTable(
        user_id=user_id,
        subject_id=subject_id,
        title=f"{source_name} 기반 퀴즈",
        requested_count=num_questions,
        difficulty=difficulty,
        type="multiple_choice" if (
            isinstance(qtype, list) and any(t == "객관식" for t in qtype)
            ) else "short_answer",
        created_at=datetime.utcnow(),
    )
    session.add(new_quiz)
    await session.flush()  # quiz_id 확보

    # 5) QuestionBankTable 저장
    for q in quiz_set.items:
        question_row = QuestionBankTable(
            quiz_id=new_quiz.quiz_id,
            qtype=q.type,
            difficulty=q.difficulty,
            stem=q.question,
            options={"choices": q.options} if q.options else None,
            correct_text=q.answer,
            explanation=q.explanation,
            citations=q.citations,
            created_at=datetime.utcnow(),
        )
        session.add(question_row)

    await session.flush()

    # 6) QuizAttemptTable 생성 (시작 로그)
    new_attempt = QuizAttemptTable(
        quiz_id=new_quiz.quiz_id,
        user_id=user_id,
        started_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    session.add(new_attempt)
    await session.flush()  # quiz_attempt_id 확보

    # 7) 커밋
    await session.commit()
    await session.refresh(new_attempt)

    # 7) JSON 형태로 반환
    return {
    "quiz_attempt_id": new_attempt.quiz_attempt_id,   # ✅ 새로 생성된 quiz_attempt_id
    "quiz": quiz_set.model_dump()
}





# 각 문제에 사용자의 응답 저장 API 
async def save_next_attempt(session: AsyncSession, req: NextRequest, user_id: str):
    # 1. 문제 존재 여부 확인
    q = await session.execute(
        select(QuestionBankTable).where(QuestionBankTable.question_bank_id == req.question_bank_id)
    )
    question = q.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="문항을 찾을 수 없습니다.")

    # 2. 채점 (단순 문자열 비교 — 필요하면 정규화/대소문자 무시 등 보강 가능)
    is_correct = (req.user_answer.strip() == (question.correct_text or "").strip())

    # 3. 점수 (객관식 1점 기준, 추후 확장 가능)
    score = 1.0 if is_correct else 0.0

    # 4. DB 저장
    attempt_item = AttemptItemTable(
        quiz_attempt_id=req.quiz_attempt_id,
        question_bank_id=req.question_bank_id,
        user_answer=req.user_answer,
        is_correct=is_correct,
        score=score,
        time_ms=req.time_ms,
        created_at=datetime.utcnow(),
    )
    session.add(attempt_item)
    await session.commit()
    await session.refresh(attempt_item)

    return {
        "attempt_item_id": attempt_item.attempt_item_id,
        "question_bank_id": attempt_item.question_bank_id,
        "user_answer": attempt_item.user_answer,
        "is_correct": attempt_item.is_correct,
        "score": attempt_item.score,
        "time_ms": attempt_item.time_ms,
    }
    
    
# 한 세트에 대한 사용자의 응답 저장 API
async def save_complete_attempt(session: AsyncSession, req: CompleteRequest, user_id: str):
    # 1. 시도 로그 가져오기
    q = await session.execute(
        select(QuizAttemptTable).where(
            QuizAttemptTable.quiz_attempt_id == req.quiz_attempt_id,
            QuizAttemptTable.user_id == user_id
        )
    )
    attempt = q.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="해당 퀴즈 시도를 찾을 수 없습니다.")

    # 2. 문항별 로그 집계
    q2 = await session.execute(
        select(
            func.count(AttemptItemTable.attempt_item_id),
            func.sum(func.ifnull(AttemptItemTable.is_correct, 0))
        ).where(AttemptItemTable.quiz_attempt_id == req.quiz_attempt_id)
    )
    total, correct = q2.one()
    total = total or 0
    correct = correct or 0

    # 3. 정답률/점수 계산
    accuracy = (correct / total * 100.0) if total > 0 else 0.0
    score = correct  # 일단 정답 개수 = 점수, 필요시 가중치 반영 가능

    # 4. QuizAttemptTable 업데이트
    attempt.finished_at = parser.isoparse(req.finished_at) if req.finished_at else datetime.utcnow()
    attempt.correct_count = correct
    attempt.total_count = total
    attempt.accuracy = accuracy
    attempt.score = score

    await session.commit()
    await session.refresh(attempt)

    # 5. 응답
    return {
        "quiz_attempt_id": attempt.quiz_attempt_id,
        "quiz_id": attempt.quiz_id,
        "user_id": attempt.user_id,
        "started_at": attempt.started_at,
        "finished_at": attempt.finished_at,
        "total_count": attempt.total_count,
        "correct_count": attempt.correct_count,
        "accuracy": attempt.accuracy,
        "score": attempt.score,
    }   