import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

#.env 파일에 있는 DB_URL, SECRET 같은 환경변수를 읽어옴
load_dotenv() 

# FastAPI 앱 객체 생성. title은 Swagger UI 문서화 상단에 뜨는 내용
app = FastAPI(title="FastAPI + React + MySQL")

# CORS 설정 - 리액트 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 헬스체크 엔드포인트
@app.get("/api/health")
def health():
    return {"ok": True}

# API 라우팅 분리
from routers.ai import router as ai_router
from routers.auth import router as auth_router
from routers.subjects import router as subject_router
from routers.documents import router as document_router
from routers.summaries import router as summary_router
from routers.chat import router as chat_router

app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(subject_router, prefix="/api", tags=["subject"])
app.include_router(document_router, prefix="/api", tags=["document"])
app.include_router(summary_router, prefix="/api", tags=["summaries"])
app.include_router(chat_router, prefix="/api", tags=["chat"])



# swagger ui에만 영향가는 코드 (신경쓰지 마세요)
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="API",
        routes=app.routes,
    )

    # 1) HTTPBearer 보안 스키마를 추가
    comps = openapi_schema.setdefault("components", {}).setdefault("securitySchemes", {})
    comps["HTTPBearer"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }

    # 2) OAuth2PasswordBearer 카드 제거
    comps.pop("OAuth2PasswordBearer", None)

    # 3) 각 operation의 security에서 OAuth2 항목 제거 (문서상 락 UI 정리)
    for path_item in openapi_schema.get("paths", {}).values():
        for op in path_item.values():
            if isinstance(op, dict) and "security" in op:
                op["security"] = [
                    sec for sec in op["security"] if "OAuth2PasswordBearer" not in sec
                ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi