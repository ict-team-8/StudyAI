# routers/quiz.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from routers.auth import get_session, Base, engine 
from services.quiz_service import generate_quiz_for_subject

from models.quiz_domain import QuizTable, QuestionBankTable, QuizAttemptTable, AttemptItemTable;

router = APIRouter()

class QuizRequest(BaseModel):
    subject_id: int
    qtype: list[str]
    difficulty: str
    num_questions: int = 5

@router.post("/generate")
async def generate_quiz_api(req: QuizRequest, session: AsyncSession = Depends(get_session)):
    try:
        quiz = await generate_quiz_for_subject(
            session,
            subject_id=req.subject_id,
            qtype=req.qtype,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
        )
        return quiz.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"잘못된 요청: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")

# 초기 개발 편의: 테이블 자동 생성 (팀원 스타일)
@router.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
