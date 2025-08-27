# services/translation_service.py
# 번역 ai 서비스 코드

from typing import Dict
from deep_translator import GoogleTranslator

# 한 번만 만든다
_LANGS: Dict[str, str] | None = None

def get_supported_langs() -> Dict[str, str]:
    """
    지원하는 언어 목록 확인
    {'en': 'english', 'ko': 'korean', ...} 형태
    """
    global _LANGS
    if _LANGS is None:
        # deep-translator는 name->code or code->name 두 포맷을 줘서 code->name으로 통일
        raw = GoogleTranslator(source="auto", target="en").get_supported_languages(as_dict=True)
        # raw: {'afrikaans': 'af', 'albanian': 'sq', ...}
        _LANGS = {code: name for name, code in raw.items()} # code -> name 뒤집어서 반환
    return _LANGS

def translate_text(text: str, target: str) -> str:
    """
    실제 번역 실행
    긴 텍스트도 안전하게 분할 번역(대략 4500자 단위)

    ai코드와의 차이점 : 긴 텍스트 안전분할해서, 연속 호출 후 합치기 -> 그러면, 브라우저에서 오는 긴 요약/QA 결과도 안전
    """
    if not text:
        return ""
    # 간단하게 \n 두 줄 기준으로 적당히 나눈 뒤, 너무 길면 추가 슬라이스
    parts = []
    current = []
    size = 0
    for block in text.split("\n\n"):
        b = (block + "\n\n")
        if size + len(b) > 4500 and current:
            parts.append("".join(current)); current, size = [], 0
        current.append(b); size += len(b)
    if current: parts.append("".join(current))

    out = []
    for p in parts:
        out.append(GoogleTranslator(source="auto", target=target).translate(p))
    return "".join(out)
