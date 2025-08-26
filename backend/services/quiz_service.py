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


from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from models.document_domain import DocumentTable    # 문서 테이블
from models.quiz_domain import QuizTable, QuestionBankTable  # 퀴즈 및 문항 테이블

DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

try:
    from rank_bm25 import BM25Okapi
    _HAS_BM25 = True
except Exception:
    _HAS_BM25 = False


# ========= [1] 텍스트 로딩 유틸 =========
def _clean_text(t: str) -> str:
    """
    HTML 태그 및 불필요한 공백을 정리하여 텍스트를 깨끗하게 만듦
    """
    t = re.sub(r"<[^>]+>", " ", t)          # 태그 제거
    t = re.sub(r"\s+", " ", t).strip()
    return t

def _load_text_from_path_or_url(path_or_url: str) -> str:
    """
    문서 경로 또는 URL로부터 텍스트를 로드
    - .txt 파일: UTF-8로 읽기
    - .pdf 파일: PyPDF2로 텍스트 추출
    - http/https URL: requests로 가져오기
    """
    from PyPDF2 import PdfReader

    def _is_url(s: str) -> bool:
        return s.startswith("http://") or s.startswith("https://")

    # URL 처리
    if _is_url(path_or_url):
        r = requests.get(path_or_url, timeout=15)
        r.raise_for_status()
        if path_or_url.lower().endswith(".pdf"):
            # PDF URL → 페이지 텍스트 추출
            with io.BytesIO(r.content) as bio:
                reader = PdfReader(bio)
                pages = [p.extract_text() or "" for p in reader.pages]
                return _clean_text("\n\n".join(pages))
        else:
            return _clean_text(r.text)

    # 로컬 파일 처리
    if not os.path.exists(path_or_url):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {path_or_url}")

    lower = path_or_url.lower()
    if lower.endswith(".pdf"):
        with open(path_or_url, "rb") as f:
            reader = PdfReader(f)
            pages = [p.extract_text() or "" for p in reader.pages]
            return _clean_text("\n\n".join(pages))
    else:
        with open(path_or_url, "r", encoding="utf-8") as f:
            return _clean_text(f.read())


# ========= [2] 자료 레지스트리 =========
class QuizMaterialRegistry:
    """
    학습 자료(문서 텍스트)를 관리하는 클래스
    - 텍스트를 받아서 청크 단위로 쪼개고 캐싱
    - LLM 입력으로 활용
    """
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 60):
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        self._texts_by_name: Dict[str, List[str]] = {}
        self._chunks_by_name: Dict[str, List[str]] = {}

    def put_material(self, name: str, texts: List[str]) -> None:
        """
        자료명을 key로 하여 원문 텍스트를 등록
        - texts: 여러 문서의 텍스트 리스트
        """
        self._texts_by_name[name] = texts
        if name in self._chunks_by_name:
            del self._chunks_by_name[name]

    def list_materials(self) -> List[str]:
        """현재 등록된 자료명 리스트"""
        return list(self._texts_by_name.keys())

    def _ensure_chunks(self, name: str) -> None:
        """
        지정된 자료명에 대해 청크(split) 데이터 준비
        """
        if name in self._chunks_by_name:
            return
        texts = self._texts_by_name.get(name)
        if not texts:
            raise KeyError(f"'{name}' 자료를 찾을 수 없습니다.")
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._chunk_size,
            chunk_overlap=self._chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )
        merged = "\n\n".join(texts).strip()
        chunks = splitter.split_text(merged)
        # 공백 아닌 문자열만 저장
        self._chunks_by_name[name] = [c for c in chunks if isinstance(c, str) and c.strip()]

    def get_all_chunks(self, name: str) -> List[str]:
        """지정된 자료의 모든 청크 반환"""
        self._ensure_chunks(name)
        return self._chunks_by_name[name]


# ========= [3] 출력 스키마 =========
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


# ========= [4] 문제 생성기 =========
class QuizGenerator:
    """
    LLM(Gemini) 기반 문제 생성기
    - 입력: 자료 청크
    - 출력: QuizSet (문항 리스트)
    """
    def __init__(self, registry: QuizMaterialRegistry, llm: ChatGoogleGenerativeAI):
        self.registry = registry
        self.llm = llm

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

    # --- BM25 관련 ---
    @staticmethod
    def _build_bm25(chunks: List[str]) -> Optional["BM25Okapi"]:
        """BM25 인덱스 빌드"""
        if not _HAS_BM25:
            return None
        tokenized = [c.split() for c in chunks]
        return BM25Okapi(tokenized)

    @staticmethod
    def _bm25_max_score(bm25: Optional["BM25Okapi"], text: str) -> float:
        """문항과 정답이 자료에 잘 근거하는지 점수"""
        if bm25 is None:
            return 0.0
        q = text.split()
        scores = bm25.get_scores(q)
        return float(max(scores)) if scores else 0.0

    # --- LLM 한 문제 생성 ---
    def _gen_one(self, qid: int, qtype: str, difficulty: str, context: str, source: str) -> QuizQuestion:
        """
        LLM을 호출해 단일 문항 생성
        """
        structured = self.llm.with_structured_output(QuizQuestion)
        prompt = f"""
당신은 학습용 퀴즈 출제자입니다. 아래 CONTEXT에서만 문제를 만드세요.

- type: "{qtype}"
- difficulty: "{difficulty}"
- 객관식(type="객관식")일 때:
  * options는 정확히 4개
  * answer는 정답 보기 텍스트 그대로
  * explanation: 왜 정답인지, 나머지는 왜 틀렸는지
- 단답형/주관식일 때:
  * answer는 핵심 키워드/요점
  * explanation: 근거를 간단히 요약
- 절대 CONTEXT 밖 지식 포함 금지
- citations: {{ "source": "{source}" }}
- id에는 {qid} 입력

CONTEXT:
{context}
"""
        return structured.invoke(prompt)

    # --- 문제 세트 생성 ---
    def generate(
        self,
        material_name: str,
        user_type: Union[str, List[str]],
        user_difficulty: str,
        n_questions: int = 5,
        sample_span: int = 1,
        random_seed: Optional[int] = None,
    ) -> QuizSet:
        if random_seed is not None:
            random.seed(random_seed)

        chunks = self.registry.get_all_chunks(material_name)
        if not chunks:
            raise ValueError(f"선택한 자료 '{material_name}' 에서 사용할 청크가 없습니다.")

        bm25 = self._build_bm25(chunks)
        items: List[QuizQuestion] = []

        for qid in range(1, n_questions + 1):
            # 문제 유형 선택 (리스트면 라운드로빈)
            if isinstance(user_type, list):
                qtype = self._normalize_type(user_type[(qid - 1) % len(user_type)])
            else:
                qtype = self._normalize_type(user_type)

            # 앵커 청크 선택
            anchor = random.choice(chunks)

            # BM25로 관련 청크 뽑기
            if bm25 is not None:
                query_tokens = anchor.split()
                scores = bm25.get_scores(query_tokens)
                top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:max(1, sample_span)]
                picked = [chunks[i] for i in top_idx]
            else:
                picked = [anchor]

            context = "\n\n".join(picked)

            # 문제 생성
            item = self._gen_one(qid=qid, qtype=qtype, difficulty=user_difficulty, context=context, source=material_name)

            # 객관식 옵션 보정
            if qtype == "객관식":
                if not item.options or len(item.options) != 4:
                    item.options = None

            # citations 보강
            if not item.citations:
                item.citations = {"source": material_name}

            items.append(item)

        return QuizSet(source=material_name, items=items)


# ========= [5] 공개 서비스 API =========
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
    1) DocumentTable에서 문서 조회
    2) file_url 기반으로 텍스트 로드
    3) QuizGenerator를 통해 문제 세트 생성
    4) QuizTable/QuestionBankTable에 저장
    5) QuizSet(JSON) 반환
    """
    # 1) subject에 연결된 문서 조회
    stmt = select(DocumentTable).where(DocumentTable.subject_id == subject_id)
    result = await session.execute(stmt)
    docs = result.scalars().all()
    if not docs:
        raise ValueError("해당 과목에 업로드된 자료가 없습니다.")

    doc = docs[0]
    if not doc.file_url:
        raise ValueError("선택한 자료에 file_url이 없어 텍스트를 로딩할 수 없습니다.")

    # 2) 텍스트 로드
    text = _load_text_from_path_or_url(doc.file_url)
    if not text or len(text) < 20:
        raise ValueError("자료 텍스트가 비어있거나 너무 짧습니다.")

    # 3) 문제 유형 파싱 (문자열 → 리스트)
    if isinstance(qtype, str) and ("," in qtype):
        qtype_list = [t.strip() for t in qtype.split(",") if t.strip()]
    else:
        qtype_list = qtype

    # 4) 레지스트리 구성
    registry = QuizMaterialRegistry()
    registry.put_material(doc.title, [text])

    # 5) LLM 초기화 & 문제 생성
    use_model = model_name or DEFAULT_GEMINI_MODEL
    llm = ChatGoogleGenerativeAI(model=use_model)
    generator = QuizGenerator(registry=registry, llm=llm)
    quiz_set = generator.generate(
        material_name=doc.title,
        user_type=qtype_list,
        user_difficulty=difficulty,
        n_questions=num_questions,
    )

    # 6) DB 저장 (퀴즈 메타 + 문항들)
    new_quiz = QuizTable(
        user_id=user_id,
        subject_id=subject_id,
        title=f"{doc.title} 기반 퀴즈",
        requested_count=num_questions,
        difficulty=difficulty,
        type="multiple_choice" if "객관식" in str(qtype_list) else "short_answer",
        created_at=datetime.utcnow(),
    )
    session.add(new_quiz)
    await session.flush()  # quiz_id 확보

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

    await session.commit()
    await session.refresh(new_quiz)

    # 7) JSON 형태로 반환
    return quiz_set.model_dump()
