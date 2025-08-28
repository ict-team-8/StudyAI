# routers/quiz.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import get_session, Base, engine, current_active_user, UserTable 
from services.quiz_service import generate_quiz_for_subject, save_next_attempt, save_complete_attempt

router = APIRouter()

from fastapi.security import HTTPBearer
from fastapi import Security

bearer_scheme = HTTPBearer()

class QuizRequest(BaseModel):
    subject_id: int
    qtype: list[str]
    difficulty: str
    num_questions: int = 5
    
class NextRequest(BaseModel):
    quiz_attempt_id: int        # 세트 단위 시도 id
    question_bank_id: int       # 푼 문항 id (AttemptItemTable 기준)
    user_answer: str            # 사용자가 제출한 답
    time_ms: int                # 소요 시간 (ms 단위)
    
class CompleteRequest(BaseModel):
    quiz_attempt_id: int
    finished_at: str | None = None

# 퀴즈 생성 API
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

# 퀴즈 한문항을 풀었을때, 결과 저장 API
@router.post("/next")
async def quiz_next_api(
    req: NextRequest,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    result = await save_next_attempt(session, req, user.id)
    return {"status": "success", "data": result}

# 퀴즈 한세트를 다 풀고 제출했을때, 로그 저장 API
@router.post("/complete")
async def quiz_complete_api(
    req: CompleteRequest,
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    result = await save_complete_attempt(session, req, user.id)
    return {"status": "success", "data": result}


# # 초기 개발 편의: 테이블 자동 생성 
# @router.on_event("startup")
# async def on_startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)