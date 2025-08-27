# PDF 다운로드 서비스 로직
# 핵심 : 마크다운 요약문 -> PDF 바이트(bytes)로 만든ㄹ어 내려주고, 
# 한글을 깨짐 없이 찍기 위해, 프로젝트에 동봉한 TTF 폰트 (나눔고딕)를 등록해서 씁니다.

# services/pdf_service.py
from __future__ import annotations
from fpdf import FPDF
from pathlib import Path
import re

# 프로젝트에 폰트 동봉: assets/fonts/NanumGothic*.ttf
FONT_DIR = Path(__file__).resolve().parents[1] / "assets" / "fonts" 
    # __file__ : 현재 이 파일(services/pdf_service.py)의 경로
FONT_REG = FONT_DIR / "NanumGothic.ttf" # 글씨체 '보통' 파일 경로 객체 
FONT_BOLD = FONT_DIR / "NanumGothicBold.ttf" # 글씨체 '볼드' 파일 경로 객체

# 마크다운 -> 텍스트 정리
# 눈에 거슬리는 마크다운 기호들만 간단히 벗겨서 평문으로 만든다.
def _md_to_text(md: str) -> str:
    """마크다운 대충 정리해서 텍스트로 (FPDF는 md를 그대로 못 그려서)."""
    t = md or ""
    t = re.sub(r"\*\*(.*?)\*\*", r"\1", t)      # **bold** → bold
    t = re.sub(r"`([^`]+)`", r"\1", t)          # `code` → code
    t = re.sub(r"^#{1,6}\s*", "", t, flags=re.M) # # 헤더 제거
    t = re.sub(r"^\s*[-*]\s+", "• ", t, flags=re.M)  # 불릿 통일
    return t.strip()

# PDF 생성 로직
def build_summary_pdf_bytes(title: str, body_md: str) -> bytes:
    """요약 텍스트(MD)를 PDF 바이트로 생성하여 반환."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15) # 페어지 넘어가면, 자동으로 새 페이지
    pdf.set_margins(15, 15, 15) # 좌/상/우 여백
    pdf.add_page()

    # 한글 폰트 등록(유니코드)
    pdf.add_font("NG", "", FONT_REG.as_posix(), uni=True)
    if FONT_BOLD.exists():
        pdf.add_font("NG", "B", FONT_BOLD.as_posix(), uni=True)

    # 제목
    pdf.set_font("NG", "B" if FONT_BOLD.exists() else "", 16)
    pdf.cell(0, 10, f"{title} 요약", ln=1)
    pdf.ln(2)

    # 본문
    pdf.set_font("NG", "", 12)
    pdf.multi_cell(0, 7, _md_to_text(body_md)) # 본문은 _md_to_text로 다듬은 평문

    
    out = pdf.output(dest="S")
    return bytes(out) if isinstance(out, (bytes, bytearray)) else out.encode("latin-1")

# 파일명
def _safe_filename(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", s)  # OS 예약문자 제거
    return s[:120]  # 너무 길면 자르기