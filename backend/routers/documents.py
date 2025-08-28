# routers/documents.py
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import current_active_user, get_session, UserTable, engine, Base
from services.document_service import handle_upload

from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

router = APIRouter()

@router.post("/documents/upload", summary="문서 업로드(PDF/긴 텍스트/OCR 이미지)")
async def upload_document(
    subject_id: int = Form(...),
    file: UploadFile | None = File(None),
    text: Optional[str] = Form(None),
    # OCR로 인한 parse_mode 추가
    parse_mode: str = Form("auto"),            # auto|pdf|text|ocr
    debug_preview: bool = Form(False),         # OCR 미리보기 포함 여부
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    """
    - subject_id 필수
    - file(멀티파트) 또는 text(긴 텍스트) 중 하나 필수
    """
    return await handle_upload(
        session,
        user_id=user.id,
        subject_id=subject_id,
        file=file,
        text=text,
        parse_mode=parse_mode,
        debug_preview=debug_preview, 
    )

# (개발용) 테이블 생성
# @router.on_event("startup")
# async def on_startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)
