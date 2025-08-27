# services/analytics_service.py
from __future__ import annotations
from typing import Optional, List
from datetime import datetime, timedelta, timezone, date
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case

from models.summary_domain import SummaryTable
from models.chat_domain import ChatSessionTable, QATurnTable
from models.quiz_domain import QuizTable, QuizAttemptTable, AttemptItemTable, QuestionBankTable

# ---------------- 공통 규칙 ----------------
def letter_grade(acc: float) -> str:
    if acc >= 0.90: return "A"
    if acc >= 0.80: return "B"
    if acc >= 0.70: return "C"
    if acc >= 0.60: return "D"
    return "F"

def learning_status(acc: float) -> str:
    if acc >= 0.90: return "최우수"
    if acc >= 0.80: return "우수"
    if acc >= 0.65: return "보통"
    return "노력 필요"

# ---------------- 상단 메트릭 ----------------
async def get_overview_metrics(
    db: AsyncSession, *, user_id: uuid.UUID, subject_id: Optional[int] = None
) -> dict:
    """
    MySQL 기준 계산:
      - 전체 정답수/문항수: AttemptItemTable join QuizAttemptTable(user/과목) 합계
      - 이번주/저번주 문제수: a.finished_at 주간 범위로 필터 후 item count
      - 총 학습시간(분): AttemptItemTable.time_ms 합
      - 주간 평균(분): 이번주 time_ms 합 / 7
      - streak: AttemptItemTable.created_at을 날짜로 묶어 최근부터 연속>0 계산 (연속 n일)
    """

    # 과목 필터를 attempt 쿼리에 주기 위한 공통 서브쿼리
    if subject_id is not None:
        quiz_id_subq = select(QuizTable.quiz_id).where(
            QuizTable.user_id == user_id, QuizTable.subject_id == subject_id
        )
    else:
        quiz_id_subq = select(QuizTable.quiz_id).where(QuizTable.user_id == user_id)

    # ----- 전체 정답/총문항 -----
    # MySQL 호환: SUM(CASE WHEN ... THEN 1 ELSE 0 END)
    q_total = (
        select(
            func.coalesce(func.sum(case((AttemptItemTable.is_correct == True, 1), else_=0)), 0),
            func.coalesce(func.count(AttemptItemTable.attempt_item_id), 0),
        )
        .select_from(AttemptItemTable)
        .join(QuizAttemptTable, AttemptItemTable.quiz_attempt_id == QuizAttemptTable.quiz_attempt_id)
        .where(
            QuizAttemptTable.user_id == user_id,
            QuizAttemptTable.quiz_id.in_(quiz_id_subq),
        )
    )
    total_correct, total_questions = (await db.execute(q_total)).one()
    total_correct = int(total_correct or 0)
    total_questions = int(total_questions or 0)
    acc = (total_correct / total_questions) if total_questions else 0.0

    # ----- 이번주/지난주 범위 -----
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())   # 월요일(UTC 기준)
    week_end   = week_start + timedelta(days=7)
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end   = week_start

    async def _weekly_item_count(start_day: date, end_day: date) -> int:
        stmt = (
            select(func.coalesce(func.count(AttemptItemTable.attempt_item_id), 0))
            .select_from(AttemptItemTable)
            .join(QuizAttemptTable, AttemptItemTable.quiz_attempt_id == QuizAttemptTable.quiz_attempt_id)
            .where(
                QuizAttemptTable.user_id == user_id,
                QuizAttemptTable.quiz_id.in_(quiz_id_subq),
                # finished_at이 없으면 created_at으로 바꾸는 것도 가능
                QuizAttemptTable.finished_at >= datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc),
                QuizAttemptTable.finished_at <  datetime.combine(end_day,   datetime.min.time(), tzinfo=timezone.utc),
            )
        )
        return int((await db.execute(stmt)).scalar() or 0)

    week_q      = await _weekly_item_count(week_start, week_end)
    prev_week_q = await _weekly_item_count(prev_week_start, prev_week_end)
    weekly_delta_percent = ((week_q - prev_week_q) / prev_week_q * 100.0) if prev_week_q else (100.0 if week_q > 0 else 0.0)

    # ----- 총 학습시간(분), 주간 평균(분) -----
    q_time_total = (
        select(func.coalesce(func.sum(AttemptItemTable.time_ms), 0))
        .select_from(AttemptItemTable)
        .join(QuizAttemptTable, AttemptItemTable.quiz_attempt_id == QuizAttemptTable.quiz_attempt_id)
        .where(
            QuizAttemptTable.user_id == user_id,
            QuizAttemptTable.quiz_id.in_(quiz_id_subq),
        )
    )
    total_ms = int((await db.execute(q_time_total)).scalar() or 0)
    total_study_minutes = total_ms // 60000

    q_time_week = (
        select(func.coalesce(func.sum(AttemptItemTable.time_ms), 0))
        .select_from(AttemptItemTable)
        .join(QuizAttemptTable, AttemptItemTable.quiz_attempt_id == QuizAttemptTable.quiz_attempt_id)
        .where(
            QuizAttemptTable.user_id == user_id,
            QuizAttemptTable.quiz_id.in_(quiz_id_subq),
            QuizAttemptTable.finished_at >= datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc),
            QuizAttemptTable.finished_at <  datetime.combine(week_end,   datetime.min.time(), tzinfo=timezone.utc),
        )
    )
    week_ms = int((await db.execute(q_time_week)).scalar() or 0)
    weekly_avg_minutes = (week_ms // 60000) // 7

    # ----- streak(연속 n일) -----
    q_days = (
        select(func.date(AttemptItemTable.created_at), func.coalesce(func.sum(AttemptItemTable.time_ms), 0))
        .select_from(AttemptItemTable)
        .join(QuizAttemptTable, AttemptItemTable.quiz_attempt_id == QuizAttemptTable.quiz_attempt_id)
        .where(
            QuizAttemptTable.user_id == user_id,
            QuizAttemptTable.quiz_id.in_(quiz_id_subq),
        )
        .group_by(func.date(AttemptItemTable.created_at))
    )
    rows = (await db.execute(q_days)).all()
    by_day = {d: int(ms) for d, ms in rows}
    streak = 0
    cur = today
    while by_day.get(cur, 0) > 0:
        streak += 1
        cur = cur - timedelta(days=1)

    return dict(
        overall_accuracy=acc,
        grade=letter_grade(acc),
        total_questions_answered=total_questions,
        weekly_delta_percent=weekly_delta_percent,
        total_correct=total_correct,
        total_study_minutes=total_study_minutes,
        streak_days=streak,
        weekly_avg_minutes=weekly_avg_minutes,
        status=learning_status(acc),
    )

# ---------------- 과목별 히스토리 ----------------
async def get_subject_history(
    db: AsyncSession, *, user_id: uuid.UUID, subject_id: int, limit: int = 20
) -> dict:

    # (1) Summaries
    rs = await db.execute(
        select(
            SummaryTable.summary_id,
            SummaryTable.type,
            SummaryTable.topic,
            SummaryTable.content_md,
            SummaryTable.model,
            SummaryTable.created_at,
        )
        .where(SummaryTable.user_id == user_id, SummaryTable.subject_id == subject_id)
        .order_by(SummaryTable.created_at.desc())
        .limit(limit)
    )
    summaries = [
        dict(
            summary_id=r.summary_id,
            type=r.type,
            topic=r.topic,
            excerpt=(r.content_md or "")[:220],
            model=r.model,
            created_at=r.created_at,
        )
        for r in rs.all()
    ]

    # (2) QA 세션 (세션 목록 + 마지막 턴 프리뷰)
    q_sess = await db.execute(
        select(ChatSessionTable)
        .where(ChatSessionTable.user_id == user_id, ChatSessionTable.subject_id == subject_id)
        .order_by(ChatSessionTable.created_at.desc())
        .limit(limit)
    )
    sessions: List[ChatSessionTable] = list(q_sess.scalars().all())

    qa_sessions = []
    for s in sessions:
        last = await db.execute(
            select(QATurnTable.question, QATurnTable.answer, QATurnTable.created_at)
            .where(QATurnTable.chat_session_id == s.chat_session_id)
            .order_by(desc(QATurnTable.created_at))
            .limit(1)
        )
        last_row = last.first()
        cnt = await db.execute(
            select(func.count()).where(QATurnTable.chat_session_id == s.chat_session_id)
        )
        qa_sessions.append(dict(
            chat_session_id=s.chat_session_id,
            title=s.title or "스마트 Q&A",
            last_question=(last_row[0] if last_row else None),
            last_answer_preview=((last_row[1] or "")[:200] if last_row else None),
            last_turn_at=(last_row[2] if last_row else None),
            turn_count=int(cnt.scalar() or 0),
        ))

    # (3) Quiz sets
    # ⚠️ QuizTable.created_at 생겼으니, 파싱테이블 없어도 됨
    # QuizTable.difficulty는 "쉬움/보통/어려움" → API 스키마는 "easy/medium/hard" 이므로 변환해서 반환!
    DIFF_KO2EN = {"쉬움": "easy", "보통": "medium", "어려움": "hard"}

    qs = await db.execute(
        select(
            QuizTable.quiz_id,
            QuizTable.requested_count,
            QuizTable.difficulty,   # "쉬움/보통/어려움"
            QuizTable.type,         # "multiple_choice" 등
            QuizTable.created_at,   # 이제 직접 사용
        )
        .where(QuizTable.user_id == user_id, QuizTable.subject_id == subject_id)
        .order_by(desc(QuizTable.created_at))
        .limit(limit)
    )

    quiz_sets = [
        dict(
            quizset_id=r.quiz_id,
            requested_count=r.requested_count,
            difficulty=DIFF_KO2EN.get(r.difficulty, "medium"),  # ← 표준화
            types=[r.type],
            created_at=r.created_at,  # 파생 생성시각
        )
        for r in qs.all()
    ]

    # (4) Attempts
    qa = await db.execute(
        select(
            QuizAttemptTable.quiz_attempt_id,
            QuizAttemptTable.quiz_id,
            QuizAttemptTable.finished_at,
            QuizAttemptTable.correct_count,
            QuizAttemptTable.accuracy,
            QuizAttemptTable.created_at,  # finished_at이 없을 때 대체용
        )
        .where(
            QuizAttemptTable.user_id == user_id,
            QuizAttemptTable.quiz_id.in_(
                select(QuizTable.quiz_id).where(
                    QuizTable.user_id == user_id, QuizTable.subject_id == subject_id
                )
            ),
        )
        .order_by(desc(QuizAttemptTable.finished_at), desc(QuizAttemptTable.created_at))
        .limit(limit)
    )
    attempts = []
    for r in qa.all():
        acc_val = float(r.accuracy or 0.0)
        attempts.append(dict(
            attempt_id=r.quiz_attempt_id,
            quizset_id=r.quiz_id,
            submitted_at=(r.finished_at or r.created_at),
            correct_count=int(r.correct_count or 0),
            accuracy=acc_val,
            grade=letter_grade(acc_val),
        ))

    return dict(
        summaries=summaries,
        qa_sessions=qa_sessions,
        quiz_sets=quiz_sets,
        quiz_attempts=attempts,
    )
