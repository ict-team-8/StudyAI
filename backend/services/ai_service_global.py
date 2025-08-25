"""
AI 공용 유틸 (정제/분할/임베딩/LLM/프롬프트/CRAG 검증)

- 이 모듈은 업로드/인덱싱(document_service)과 요약(summary_service)에서 공통 사용됩니다.
- 임베딩 모델은 최초 import 시 로드(캐시됨). 최초 1회만 다운로드되며 다음부터는 로컬 캐시 사용.
"""

import os, re, uuid
from bs4 import BeautifulSoup
from typing import List, Tuple
import warnings, logging

from bs4 import BeautifulSoup

# LangChain core types
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

# ----- Embeddings (HuggingFace) -----
# sentence-transformers/all-mpnet-base-v2 를 사용 (768차원)
from langchain_huggingface import HuggingFaceEmbeddings

# ----- Google Generative AI (LLM) -----
# langchain-google-genai 어댑터로 Gemini를 LangChain LLM처럼 사용

# 프롬프트 / 체인
from langchain.prompts import PromptTemplate

# CRAG 구조화 응답 검증용
from pydantic import BaseModel, Field

import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI

# 노이즈 억제 (한국어 문장분리 경고 등)
warnings.filterwarnings("ignore", category=RuntimeWarning, module="pecab._tokenizer")
logging.getLogger("Kss").setLevel(logging.ERROR)

# ==============================
#  환경변수 (필수)
# ==============================
# .env에 GOOGLE_API_KEY="..." 를 넣어두세요.
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    # 키가 없으면 나중에 LLM 호출 시 오류가 나므로, 여기서 명확히 알림
    # (서버는 떠도, 요약/QA API 호출 시 401 발생)
    logging.warning("[ai_service_global] GOOGLE_API_KEY is not set. Set it in your .env")
else:
    genai.configure(api_key=GOOGLE_API_KEY)

# ---- 임베딩 (전역 1회만 로드) ----

_EMBEDDINGS = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={'device': 'cpu'}
)

# ---- LLM 인스턴스 (Gemini) ----
# 요약/QA 등 생성용.
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.4,
    google_api_key=GOOGLE_API_KEY,
)

# ---- 텍스트 정리 ----
def clean_text(t: str) -> str:
    t = BeautifulSoup(t, "html.parser").get_text(" ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

# ---- 청크 분할 ----
def split_to_chunks(plain: List[str], chunk_size: int = 512, chunk_overlap: int = 50) -> List[Document]:
    docs = [Document(page_content=clean_text(x)) for x in plain if x and x.strip()]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    return splitter.split_documents(docs)

# ==============================
#  프롬프트
# ==============================
# (요약) – Summary 서비스에서 RetrievalQA의 prompt 로 사용
summary_prompt = PromptTemplate.from_template(
    """
    당신은 시험 코치입니다.
    다음 컨텍스트만을 바탕으로 시험 대비용 요약본을 작성하세요.

    형식:
    1) 핵심 개념 (불릿, 간결하게)
    2) 자주 나오는 함정/오개념
    3) 주요 개념 영역별 요약 (예: 정의, 원리, 응용, 장단점 등 큰 주제 단위별 구분)
    4) 3줄 최종 요약

    질문(주제/요청): {question}
    컨텍스트:
    {context}

    규칙:
    - 컨텍스트에 없는 내용은 추측하지 마세요.
    - 학습자가 바로 암기할 수 있게 간결하게 작성해주세요.
    """
)

# QA 프롬프트 – 필요 시 다른 서비스에서도 활용 가능
question_prompt = PromptTemplate(
    input_variables=["context", "question"],
    template=
    """
    From the given context, answer the question concisely.
    Use inline citation markers like [1], , etc., to indicate which context passages support your answer.
    **Important: Use ONLY the provided citation numbers shown in the context.** Do NOT invent or change citation numbers.
    If no exact answer exists, reply 'No answer'.

    Context with labels:
    {context}

    Question:
    {question}

    Answer (with [n] markers):
    """
)

# ==============================
#  CRAG: 요약 정합성 검증
# ==============================
class SummaryGrade(BaseModel):
    ok: bool = Field(description="요약이 컨텍스트에 충실하면 true, 아니면 false")
    reason: str = Field(description="왜 그렇게 판단했는지 1~2문장")

def grade_summary(llm: ChatGoogleGenerativeAI, retrieved_docs: List[Document], summary_text: str) -> SummaryGrade:
    """
    요약문이 컨텍스트에 충실한지 LLM이 판정.
    LangChain의 structured output으로 JSON을 안정적으로 파싱.
    """
    ctx = "\n\n".join(d.page_content for d in retrieved_docs[:6])
    grader_prompt = f"""
    당신은 요약의 정합성을 평가하는 심사위원입니다.
    아래 컨텍스트와 요약이 사실적으로 일치하는지 평가하세요.

    컨텍스트:
    {ctx}

    요약:
    {summary_text}

    JSON 형식으로만 답변하세요: {{ "ok": true/false, "reason": "<간단 사유>" }}
    """
    structured = llm.with_structured_output(SummaryGrade)
    return structured.invoke(grader_prompt)

def refine_with_crag(summary_chain, llm: ChatGoogleGenerativeAI, retriever, topic: str, max_iters: int = 2, verbose: bool = True) -> Tuple[str, bool, str]:
    """
    1) 요약 생성
    2) grade_summary로 정합성 검사
    3) 불합격이면 사유를 포함해 재요약 (max_iters 회)
    4) (summary_text, ok, reason) 반환
    """
    summary_out = summary_chain.run(topic)
    for it in range(max_iters + 1):
        docs_for_grade = retriever.get_relevant_documents(topic)
        grade = grade_summary(llm, docs_for_grade, summary_out)
        if grade.ok:
            if verbose:
                logging.info(f"[CRAG] ✅ 통과(iter {it}): {grade.reason}")
            return summary_out, True, grade.reason
        if it == max_iters:
            if verbose:
                logging.warning(f"[CRAG] ⚠️ 최대 재시도 도달. 마지막 사유: {grade.reason}")
            return summary_out, False, grade.reason
        if verbose:
            logging.info(f"[CRAG] ❌ 실패(iter {it}): {grade.reason} → 재요약")
        fix_prompt = f"{summary_out}\n\n위 요약의 문제: {grade.reason}\n→ 문제를 반영하여 다시 요약하세요."
        summary_out = summary_chain.run(fix_prompt)
