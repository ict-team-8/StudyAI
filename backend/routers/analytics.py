# routers/analytics.py
from __future__ import annotations
from typing import Optional, Literal, List
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPBearer
from fastapi import Security

from routers.auth import current_active_user, get_session, UserTable, Base, engine
from services.analytics_service import get_overview_metrics, get_subject_history

router = APIRouter()
bearer_scheme = HTTPBearer()

# ===== Pydantic 응답 스키마 =====
class OverviewCard(BaseModel):
    overall_accuracy: float # 전체 정답률
    grade: str # 등급 (A ~ F)
    total_questions_answered: int # 총 문제수
    weekly_delta_percent: float # 이번주 문제푼 퍼센드
    total_correct: int # 정답 개수
    total_study_minutes: int # 총 학습시간
    streak_days: int # n일 연속
    weekly_avg_minutes: int # 주간 평균 n분
    status: str # 학습상태

# ai 요약
class SummaryBrief(BaseModel):
    summary_id: int
    type: Literal["overall","traps","concept_areas","three_lines"]
    topic: str
    excerpt: str
    model: str | None = None
    created_at: datetime

# ai QA
class QASessionBrief(BaseModel):
    chat_session_id: int
    title: str
    last_question: str | None = None
    last_answer_preview: str | None = None
    last_turn_at: datetime | None = None
    turn_count: int

# ai 문제세트
class QuizSetBrief(BaseModel):
    quizset_id: int
 #   status: Literal["creating","ready","error"]
    requested_count: int
    difficulty: Literal["easy","medium","hard"]
    types: List[str]
    created_at: datetime

# ai 풀이기록
class QuizAttemptBrief(BaseModel):
    attempt_id: int
    quizset_id: int
    submitted_at: datetime | None = None
    correct_count: int
    accuracy: float
    grade: str

# 과목별 히스토리 요약 Response 
class SubjectHistoryResponse(BaseModel):
    summaries: List[SummaryBrief]
    qa_sessions: List[QASessionBrief]
    quiz_sets: List[QuizSetBrief]
    quiz_attempts: List[QuizAttemptBrief]

# ====== Endpoints ======

@router.get("/analytics/overview", response_model=OverviewCard, summary="학습분석: 상단 1행 메트릭")
async def analytics_overview(
    subject_id: int | None = Query(None, description="특정 과목 필터(옵션)"),
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    db: AsyncSession = Depends(get_session),
):
    data = await get_overview_metrics(db, user_id=user.id, subject_id=subject_id)
    return OverviewCard(**data)

@router.get("/analytics/subject/{subject_id}/history",
            response_model=SubjectHistoryResponse,
            summary="과목별 히스토리(요약/QA/문제세트/풀이)")
async def analytics_subject_history(
    subject_id: int,
    limit: int = Query(20, ge=1, le=100),
    user: UserTable = Depends(current_active_user),
    token: str = Security(bearer_scheme),
    db: AsyncSession = Depends(get_session),
):
    data = await get_subject_history(db, user_id=user.id, subject_id=subject_id, limit=limit)
    return SubjectHistoryResponse(
        summaries=[SummaryBrief(**x) for x in data["summaries"]],
        qa_sessions=[QASessionBrief(**x) for x in data["qa_sessions"]],
        quiz_sets=[QuizSetBrief(**x) for x in data["quiz_sets"]],
        quiz_attempts=[QuizAttemptBrief(**x) for x in data["quiz_attempts"]],
    )

# (개발용) 자동 생성
# @router.on_event("startup")
# async def on_startup():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)
