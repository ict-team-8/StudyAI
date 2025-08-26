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
from routers.quiz import router as quiz_router
from routers.analytics import router as analytic_router

app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(subject_router, prefix="/api", tags=["subject"])
app.include_router(document_router, prefix="/api", tags=["document"])
app.include_router(summary_router, prefix="/api", tags=["summaries"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(quiz_router, prefix="/api/quiz",tags=["quiz"] )
app.include_router(analytic_router, prefix="/api", tags=["analytic"])

from routers.auth import Base, engine

# === 통합 Startup: 스키마 생성/초기화 ===
@app.on_event("startup")
async def on_startup_schema():
    """
    DB_RESET 동작:
      - (없음/기본) : create_all (없는 테이블만 생성)
      - drop-create : drop_all -> create_all (개발용: 싹 초기화)
      - truncate    : 모든 테이블 데이터 TRUNCATE (스키마 유지, MySQL 기준)
    """
    mode = os.getenv("DB_RESET", "").strip().lower()

    async with engine.begin() as conn:
        if mode == "drop-create":
            # ⚠️ 운영에서 절대 사용 금지
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        elif mode == "truncate":
            # MySQL 기준 TRUNCATE (FK 고려). 다른 DB면 로직 조정 필요.
            await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            # sorted_tables: FK 고려된 순서 (reversed 필요 X, TRUNCATE는 자체적으로 안전)
            for table in Base.metadata.sorted_tables:
                # DB/스키마에 따라 백틱/따옴표가 필요할 수 있음
                await conn.execute(text(f"TRUNCATE TABLE `{table.name}`;"))
            await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

        else:
            # 기본: 없는 테이블만 생성
            await conn.run_sync(Base.metadata.create_all)

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