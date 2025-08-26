# routers/quiz.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import get_session, Base, engine, current_active_user, UserTable 
from services.quiz_service import generate_quiz_for_subject

router = APIRouter()

from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

class QuizRequest(BaseModel):
    subject_id: int
    qtype: list[str]
    difficulty: str
    num_questions: int = 5

@router.post("/generate")
async def generate_quiz_api(
    req: QuizRequest,
    user: UserTable | None = Depends(current_active_user),  # (바꾼 부분) optional로 허용
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    try:
        if user is None:  # (바꾼 부분) 인증 실패 시 직접 메시지 처리
            raise HTTPException(status_code=401, detail="로그인이 필요합니다. Authorization: Bearer <token> 헤더를 추가하세요.")

        quiz = await generate_quiz_for_subject(
            session=session,
            user_id=user.id,   # (바꾼 부분 없음) 인증 성공 시 user.id 사용
            subject_id=req.subject_id,
            qtype=req.qtype,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
        )
        return quiz
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"잘못된 요청: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")

# 초기 개발 편의: 테이블 자동 생성 
@router.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
