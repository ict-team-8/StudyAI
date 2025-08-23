from typing import List, Optional, Dict
import random
from pydantic import BaseModel, Field
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI

try:
    from rank_bm25 import BM25Okapi
    _HAS_BM25 = True
except Exception:
    _HAS_BM25 = False


# ------------------------------- 자료 레지스트리 -------------------------------
class QuizMaterialRegistry:
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 60):
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        self._texts_by_name: Dict[str, List[str]] = {}
        self._chunks_by_name: Dict[str, List[str]] = {}

    def refresh_from_global(self) -> None:
        """전역 MATERIALS_PLAIN_BY_NAME에서 자료 로드"""
        global MATERIALS_PLAIN_BY_NAME
        if "MATERIALS_PLAIN_BY_NAME" not in globals():
            raise RuntimeError("MATERIALS_PLAIN_BY_NAME 전역이 없습니다. 자료를 먼저 등록하세요.")
        self._texts_by_name = dict(MATERIALS_PLAIN_BY_NAME)
        self._chunks_by_name.clear()

    def list_materials(self) -> List[str]:
        return list(self._texts_by_name.keys())

    def _ensure_chunks(self, name: str) -> None:
        if name in self._chunks_by_name:
            return
        texts = self._texts_by_name.get(name)
        if not texts:
            raise KeyError(f"'{name}' 자료를 찾을 수 없습니다.")
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._chunk_size,
            chunk_overlap=self._chunk_overlap,
            separators=["\n\n", "\n", " ", ""]
        )
        merged = "\n\n".join(texts).strip()
        chunks = splitter.split_text(merged)
        self._chunks_by_name[name] = [c for c in chunks if isinstance(c, str) and c.strip()]

    def get_all_chunks(self, name: str) -> List[str]:
        self._ensure_chunks(name)
        return self._chunks_by_name[name]


# ------------------------------- 출력 스키마 -------------------------------
class QuizQuestion(BaseModel):
    id: int = Field(..., description="문항 번호(1부터)")
    type: str = Field(..., description="객관식|단답형|주관식 중 하나")
    difficulty: str = Field(..., description="쉬움|보통|어려움")
    question: str = Field(..., description="문항 본문")
    options: Optional[List[str]] = Field(default=None, description="객관식일 때 보기 4개")
    answer: str = Field(..., description="정답 또는 채점 포인트")


class QuizSet(BaseModel):
    source: str = Field(..., description="사용한 자료명(파일명)")
    items: List[QuizQuestion]


# ------------------------------- 문제 생성기 -------------------------------
class QuizGenerator:
    def __init__(self, registry: QuizMaterialRegistry, llm: ChatGoogleGenerativeAI):
        self.registry = registry
        self.llm = llm

    # ---------- 내부 유틸: 입력 정규화 ----------
    @staticmethod
    def _normalize_type(t: str) -> str:
        m = {
            "객관식": "객관식", "multiple": "객관식", "mcq": "객관식",
            "단답형": "단답형", "short": "단답형",
            "주관식": "주관식", "essay": "주관식", "subjective": "주관식",
        }
        return m.get((t or "").strip().lower(), t)

    @staticmethod
    def _normalize_diff(d: str) -> str:
        m = {
            "쉬움": "쉬움", "easy": "쉬움",
            "보통": "보통", "medium": "보통", "중간": "보통",
            "어려움": "어려움", "hard": "어려움", "difficult": "어려움",
        }
        return m.get((d or "").strip().lower(), d)

    # ---------- BM25 ----------
    @staticmethod
    def _build_bm25(chunks: List[str]) -> Optional["BM25Okapi"]:
        if not _HAS_BM25:
            return None
        tokenized = [c.split() for c in chunks]
        return BM25Okapi(tokenized)

    @staticmethod
    def _bm25_max_score(bm25: Optional["BM25Okapi"], text: str) -> float:
        if bm25 is None:
            return 0.0
        q = text.split()
        scores = bm25.get_scores(q)
        return float(max(scores)) if scores else 0.0

    # ---------- 단일 문항 생성 ----------
    def _gen_one(self, qid: int, qtype: str, difficulty: str, context: str) -> QuizQuestion:
        structured = self.llm.with_structured_output(QuizQuestion)
        prompt = f"""
당신은 학습용 퀴즈 출제자입니다. 아래 CONTEXT의 내용에서만 근거를 찾아 정확히 1개의 문제를 만드세요.
- type은 "{qtype}" 로 설정합니다.
- difficulty는 "{difficulty}" 로 설정합니다.
- 객관식(type="객관식")일 때:
  * options는 정확히 4개를 만드세요.
  * 오직 하나만 정답이어야 합니다.
  * answer에는 보기 중 정답 '텍스트'를 그대로 쓰세요.
- 단답형(type="단답형")일 때: answer는 핵심 키워드 위주로 간결히.
- 주관식(type="주관식")일 때: answer는 채점 포인트(핵심 요점)를 간결히 정리.
- CONTEXT 밖의 사실/숫자/정의는 절대 추가하지 마세요.

반환은 QuizQuestion(JSON) 형식이며, id에는 {qid} 를 넣으세요.

CONTEXT:
{context}
"""
        return structured.invoke(prompt)

    # ---------- 공개 API ----------
    def generate(
        self,
        material_name: str,
        user_type: str,
        user_difficulty: str,
        n_questions: int = 5,
        sample_span: int = 1,
        random_seed: Optional[int] = None,
        bm25_threshold: float = 2.0,
    ) -> QuizSet:
        if random_seed is not None:
            random.seed(random_seed)

        qtype = self._normalize_type(user_type)
        diff = self._normalize_diff(user_difficulty)

        chunks = self.registry.get_all_chunks(material_name)
        if not chunks:
            raise ValueError(f"선택한 자료 '{material_name}' 에서 사용할 청크가 없습니다.")

        bm25 = self._build_bm25(chunks)
        items: List[QuizQuestion] = []

        for qid in range(1, n_questions + 1):
            picked = random.sample(chunks, k=min(max(1, sample_span), len(chunks)))
            context = "\n\n".join(picked)

            item = self._gen_one(qid=qid, qtype=qtype, difficulty=diff, context=context)

            # 객관식 보장 처리
            if qtype == "객관식" and (not item.options or len(item.options) != 4):
                item = self._gen_one(qid=qid, qtype=qtype, difficulty=diff, context=context)

            # BM25 점검
            if bm25 is not None:
                probe = f"{item.question}\n정답: {item.answer or ''}".strip()
                score = self._bm25_max_score(bm25, probe)
                if score < bm25_threshold:
                    item = self._gen_one(qid=qid, qtype=qtype, difficulty=diff, context=context)

            items.append(item)

        return QuizSet(source=material_name, items=items)
