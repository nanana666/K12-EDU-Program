"""题目管理路由。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import success
from app.db.session import get_db
from app.schemas.question import QuestionIn, QuestionOut
from app.services.question_service import (
    create_question,
    delete_question,
    list_questions,
)

router = APIRouter(prefix="/questions", tags=["questions"])


@router.post("")
def create(payload: QuestionIn, db: Session = Depends(get_db)) -> dict:
    """新增题目。"""
    question = create_question(db, payload)
    return success(data=QuestionOut.model_validate(question), message="题目创建成功")


@router.get("")
def list_all(db: Session = Depends(get_db)) -> dict:
    """题目列表。"""
    questions = list_questions(db)
    return success(data=[QuestionOut.model_validate(q) for q in questions])


@router.delete("/{question_id}")
def remove(question_id: int, db: Session = Depends(get_db)) -> dict:
    """删除题目。"""
    delete_question(db, question_id)
    return success(message="题目已删除")
