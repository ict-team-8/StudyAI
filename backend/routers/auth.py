import os
import uuid
from typing import AsyncGenerator, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_users import FastAPIUsers
from fastapi_users import schemas as fa_schemas
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.password import PasswordHelper

from sqlalchemy import String, Boolean, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 1) 환경변수
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET = os.getenv("SECRET", "change-me")

# 2) SQLAlchemy Base / User 테이블
class Base(DeclarativeBase):
    pass

class UserTable(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

# 3) Async 엔진/세션
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

# 4) fastapi-users DB 어댑터
async def get_user_db(session: AsyncSession = Depends(get_session)) -> AsyncGenerator[SQLAlchemyUserDatabase, None]:
    yield SQLAlchemyUserDatabase(session, UserTable)

# 5) 유저 매니저
class UserManager(UUIDIDMixin, BaseUserManager[UserTable, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

async def get_user_manager(user_db=Depends(get_user_db)) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)

# 6) JWT 인증
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")
def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=60 * 60 * 24)

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# 7) fastapi-users 인스턴스 & 현재 유저 의존성
fastapi_users = FastAPIUsers[UserTable, uuid.UUID](get_user_manager, [auth_backend])
current_active_user = fastapi_users.current_user(active=True)
current_active_superuser = fastapi_users.current_user(active=True, superuser=True)

# 8) Pydantic 스키마
class UserRead(fa_schemas.BaseUser[uuid.UUID]): ...
class UserCreate(fa_schemas.BaseUserCreate): ...
class UserUpdateMe(fa_schemas.BaseUserUpdate): ...   # (필요시 /me PATCH에 쓸 수 있음)
# 관리자용 업데이트 스키마 (id 대상)
from pydantic import BaseModel, EmailStr
class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    is_verified: Optional[bool] = None

pwd_helper = PasswordHelper()

# 9) 라우터 시작
router = APIRouter()

# (1) 로그인/로그아웃만 유지
router.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

# (2) 회원가입만 유지
router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

# (3) 기본 users 라우터는 "포함하지 않는다"

# ========= 우리가 필요한 최소 엔드포인트만 커스텀 구현 =========

from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

# A) 현재 로그인 사용자 조회
@router.get("/users/me", response_model=UserRead)
async def get_me(
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme)):
    # fastapi-users가 토큰으로 user를 주입해줌
    return UserRead(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        is_verified=user.is_verified,
    )


# 10) 개발 편의: 테이블 자동 생성
# @router.on_event("startup")
# async def on_startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)
