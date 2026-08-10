"""题目业务逻辑：创建、列表、删除。"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundError
from app.models.option import Option
from app.models.question import Question
from app.schemas.question import QuestionIn


def create_question(db: Session, payload: QuestionIn) -> Question:
    """创建题目（含选项），按输入顺序写入 sort_order。"""
    question = Question(text=payload.text)
    for index, option_in in enumerate(payload.options):
        question.options.append(
            Option(
                text=option_in.text,
                is_correct=option_in.is_correct,
                sort_order=index,
            )
        )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def list_questions(db: Session) -> list[Question]:
    """按创建时间倒序返回全部题目（含选项）。"""
    stmt = (
        select(Question)
        .options(selectinload(Question.options))
        .order_by(Question.id.desc())
    )
    return list(db.scalars(stmt).unique())


def delete_question(db: Session, question_id: int) -> None:
    """删除题目（级联删除选项）。"""
    question = db.get(Question, question_id)
    if question is None:
        raise NotFoundError(f"题目不存在：{question_id}")
    db.delete(question)
    db.commit()
