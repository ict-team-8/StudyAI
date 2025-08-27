# routers/i18n.py
# 번역 api 2개

# GET api - 번역가능한 언어 리스트 
# POST api - 번역하기

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from fastapi.security import HTTPBearer
from fastapi import Security
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import current_active_user, get_session, UserTable
from services.translation_service import get_supported_langs, translate_text

router = APIRouter()
bearer_scheme = HTTPBearer()

#### DTO ####
class TranslateIn(BaseModel):
    text: str = Field(..., description="원문(한국어)")
    target_lang: str = Field(..., description="ISO 코드 예: en, ja, fr, zh-CN")

class TranslateOut(BaseModel):
    target_lang: str
    text: str

### Controller ###

@router.get("/i18n/languages", summary="번역 가능한 언어 리스트 조회")
async def list_languages(
    user: UserTable = Depends(current_active_user),   # 동일 보안 정책 유지
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    return get_supported_langs()  # { 'en': 'english', 'ko':'korean', ... }


@router.post("/i18n/translate", response_model=TranslateOut, summary="실제 번역 기능")
async def do_translate(
    body: TranslateIn,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    # 지원하지 않는 언어 코드 에러 처리
    langs = get_supported_langs()
    if body.target_lang not in langs:
        raise HTTPException(422, f"Unsupported language code: {body.target_lang}")
    
    result = translate_text(body.text, body.target_lang)
    
    return {"target_lang": body.target_lang, "text": result}

