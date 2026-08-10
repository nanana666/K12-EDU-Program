"""答题活动路由：创建、分发、提交、统计。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import success
from app.db.session import get_db
from app.schemas.quiz import (
    ActiveQuizOut,
    AnswerSubmitIn,
    QuizSessionCreate,
    QuizSessionOut,
    QuizStatsOut,
)
from app.services.quiz_service import (
    create_quiz_session,
    finish_session,
    get_active_session,
    get_stats,
    list_quiz_sessions,
    submit_answers,
)

router = APIRouter(prefix="/quiz-sessions", tags=["quiz-sessions"])


def _session_out(session) -> dict:
    return {
        "id": session.id,
        "title": session.title,
        "status": session.status,
        "question_count": len(session.questions),
        "created_at": session.created_at,
    }


@router.post("")
def create(payload: QuizSessionCreate, db: Session = Depends(get_db)) -> dict:
    """教师创建答题活动（打包题目并立即进入进行中状态）。"""
    session = create_quiz_session(db, payload.title, payload.question_ids)
    return success(data=_session_out(session), message="答题活动已创建")


@router.get("")
def list_all(db: Session = Depends(get_db)) -> dict:
    """答题活动列表（教师端）。"""
    sessions = list_quiz_sessions(db)
    return success(data=[_session_out(s) for s in sessions])


@router.get("/active")
def active(db: Session = Depends(get_db)) -> dict:
    """学生端轮询：获取当前进行中的活动（不含正确答案）。"""
    session = get_active_session(db)
    if session is None:
        return success(data=None, message="当前没有进行中的答题活动")
    data = {
        "id": session.id,
        "title": session.title,
        "status": session.status,
        "questions": [
            {
                "id": sq.question.id,
                "text": sq.question.text,
                "options": [
                    {"id": opt.id, "text": opt.text}
                    for opt in sq.question.options
                ],
                # 只告诉学生端正确答案数量（用于判断是否多选），不泄露具体选项
                "correct_count": sum(1 for opt in sq.question.options if opt.is_correct),
            }
            for sq in session.questions
        ],
    }
    return success(data=data)


@router.post("/{session_id}/finish")
def finish(session_id: int, db: Session = Depends(get_db)) -> dict:
    """教师结束答题活动。"""
    session = finish_session(db, session_id)
    return success(data=_session_out(session), message="答题活动已结束")


@router.post("/{session_id}/submit")
def submit(
    session_id: int, payload: AnswerSubmitIn, db: Session = Depends(get_db)
) -> dict:
    """学生提交答案（学号 + 所选答案列表）。"""
    submit_answers(
        db,
        session_id,
        payload.student_id,
        [item.model_dump() for item in payload.answers],
    )
    return success(message="答案提交成功")


@router.get("/{session_id}/stats")
def stats(session_id: int, db: Session = Depends(get_db)) -> dict:
    """教师端统计看板数据。"""
    result = get_stats(db, session_id)
    return success(data=QuizStatsOut.model_validate(result).model_dump())
