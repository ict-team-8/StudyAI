# services/quiz_service.py

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from models.quiz_domain import QuizTable, QuestionBankTable
from routers.auth import UserTable
from quiz_generator_module import QuizGenerator, QuizMaterialRegistry  # 방금 만든 코드 모듈

async def generate_quiz_for_subject(
    session: AsyncSession,
    user_id: uuid.UUID,
    subject_id: int,
    qtype: str,
    difficulty: str,
    num_questions: int,
    settings: dict | None = None,
) -> QuizTable:
    """
    선택한 자료에서 퀴즈를 생성하고 DB에 저장

    Args:
        session: AsyncSession
        user_id: 생성 사용자
        subject_id: 과목 ID
        qtype: 문제 유형 ("객관식"|"단답형"|"주관식")
        difficulty: 난이도 ("쉬움"|"보통"|"어려움")
        num_questions: 생성할 문제 개수
        settings: 추가 퀴즈 설정 (time_limit 등)

    Returns:
        QuizTable 객체 (questions 포함)
    """
    # 1) 자료 레지스트리에서 자료 불러오기
    registry = QuizMaterialRegistry()
    registry.refresh_from_global()
    names = registry.list_materials()
    if not names:
        raise ValueError("사용 가능한 학습 자료가 없습니다.")

    # (여기서는 하나만 받는다고 가정. 여러 개라면 리스트 인자로 확장 가능)
    material_name = names[0]

    # 2) 퀴즈 생성
    generator = QuizGenerator(registry=registry)
    quiz_set = generator.generate(
        material_name=material_name,
        user_type=qtype,
        user_difficulty=difficulty,
        n_questions=num_questions,
    )

    # 3) DB 저장 (QuizTable 생성)
    new_quiz = QuizTable(
        user_id=user_id,
        subject_id=subject_id,
        title=f"{material_name} 기반 퀴즈",
        requested_count=num_questions,
        difficulty=difficulty,
        type="multiple_choice" if qtype == "객관식" else "short_answer",  # DB Enum과 매핑
        settings=settings,
        status="ready",
        created_at=datetime.utcnow(),
    )
    session.add(new_quiz)
    await session.flush()  # quiz_id 확보

    # 4) 각 문항 저장 (QuestionBankTable)
    for q in quiz_set.items:
        question_row = QuestionBankTable(
            quiz_id=new_quiz.quiz_id,
            qtype="multiple_choice" if q.type == "객관식" else "short_answer",
            difficulty=q.difficulty,
            stem=q.question,
            options={"choices": q.options} if q.options else None,
            correct_text=q.answer,
            explanation=q.explanation,
            citations={"source": quiz_set.source},  # 최소 출처 기록
            created_at=datetime.utcnow(),
        )
        session.add(question_row)

    await session.commit()
    await session.refresh(new_quiz)

    return new_quiz
