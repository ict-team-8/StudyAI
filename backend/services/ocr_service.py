# OCR 전처리 -> Tesseract -> (선택)LLM 라이트 정정 + 짧은 미리보기 제공

from PIL import Image, ImageOps, ImageFilter
from io import BytesIO
import pytesseract, re, textwrap
from services.ai_service_global import clean_text, llm
from difflib import SequenceMatcher
from typing import Dict

# OCR 전처리
# 컬러 -> 그레이스케일 -> 자동대비 -> 샤프닝으로 OCR 친화 이미지로 변환
def _preprocess(img: Image.Image) -> Image.Image:
    """
    OCR 정확도 향상을 위한 가벼운 전처리:
    - 그레이스케일 변환
    - 자동 대비 보정
    - 가벼운 샤프닝
    (무거운 OpenCV 의존성 없이 PIL만 사용)
    """
    if img.mode != "L":
        img = ImageOps.grayscale(img)
    img = ImageOps.autocontrast(img)
    img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))
    return img

# 실제 OCR 처리 (Tesseract)
# "--oem 3(LSTM) + --psm 3(자동 레이아웃) 설정으로, Tesseract 실행 -> 문자열 반환
def ocr_image_bytes(b: bytes, lang: str = "kor+eng") -> str:
    im = Image.open(BytesIO(b))
    im = _preprocess(im)
    txt = pytesseract.image_to_string(im, lang=lang, config="--oem 3 --psm 3")
    return clean_text(txt or "")

# LLM 기반 '가벼운' OCR 텍스트 정정기
def llm_light_fix(text: str) -> str:
    """
    한 덩어리 텍스트에 대해 철자/띄어쓰기/문장부호 위주의 경미한 정정만 수행.
    - 의미/사실 추가 금지
    - 번역 금지
    - 수식/전문용어 보존
    - 반환은 '정정된 텍스트'만
    """
    if not text.strip():
        return text
    prompt = f"""
You are an OCR post-processor. Lightly fix obvious OCR errors only (spacing, punctuation, homoglyphs like l/1/I and 0/O).
DO NOT add or translate. Preserve formulas. Return ONLY the corrected text.

[OCR text]
{text}
""".strip()
    resp = llm.invoke(prompt)
    return clean_text(resp.content or "")

# 짧은 미리보기(발표·디버그용)
def _short(s: str, width: int = 88, lines: int = 3) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    wrapped = textwrap.wrap(s, width=width)
    shown = "\n".join(wrapped[:lines])
    rest = max(0, len(s) - sum(len(w) for w in wrapped[:lines]))
    return shown + (f"\n… [+{rest} chars]" if rest > 0 else "")

def build_preview(raw: str, fixed: str) -> Dict:
    chg = 1.0 - SequenceMatcher(None, raw or "", fixed or "").ratio()
    return {
        "raw_chars": len(raw),
        "fixed_chars": len(fixed),
        "changed_ratio": chg,         # 0.0 ~ 1.0
        "raw_preview": _short(raw),
        "fixed_preview": _short(fixed),
    }