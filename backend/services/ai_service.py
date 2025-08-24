# 최소버전 테스트용 

import os, io, re, requests
import google.generativeai as genai
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader

from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI

def clean_text(t: str) -> str:
    t = BeautifulSoup(t, "html.parser").get_text(" ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

def load_text_from_url(url: str) -> str:
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return clean_text(r.text)

def load_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    with io.BytesIO(pdf_bytes) as f:
        reader = PdfReader(f)
        pages = [page.extract_text() or "" for page in reader.pages]
    return clean_text("\n".join(pages))

def _get_llm():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-1.5-flash")

def summarize_text(text: str, question: str | None = None) -> str:
    model = _get_llm()
    if question:
        prompt = f"다음 컨텍스트로만 답하세요.\n컨텍스트:\n{text[:120000]}\n\n질문:{question}"
    else:
        prompt = f"시험 대비 요약: 핵심개념/함정/3줄요약\n텍스트:\n{text[:120000]}"
    resp = model.generate_content(prompt)
    return resp.text.strip()
