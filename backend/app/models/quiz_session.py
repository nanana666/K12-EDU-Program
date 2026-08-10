"""答题活动模型：教师打包题目并发布，学生参与答题。"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.answer import AnswerRecord
    from app.models.question import Question


class QuizSession(Base):
    """答题活动：一次出题的分发单元。"""

    __tablename__ = "quiz_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(128), comment="活动标题")
    status: Mapped[str] = mapped_column(
        String(16), default="active", index=True, comment="active=进行中 / finished=已结束"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="创建时间"
    )

    questions: Mapped[list["QuizSessionQuestion"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="QuizSessionQuestion.sort_order",
    )
    answers: Mapped[list["AnswerRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class QuizSessionQuestion(Base):
    """答题活动与题目的关联（携带顺序）。"""

    __tablename__ = "quiz_session_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE")
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="题目顺序")

    session: Mapped["QuizSession"] = relationship(back_populates="questions")
    question: Mapped["Question"] = relationship()
