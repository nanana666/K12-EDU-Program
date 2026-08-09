"""学生答题记录模型。"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class AnswerRecord(Base):
    """单个学生针对单个题目的答题结果。"""

    __tablename__ = "answer_records"
    __table_args__ = (
        UniqueConstraint(
            "session_id", "student_id", "question_id", name="uq_answer_record"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[str] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE")
    )
    selected_option_id: Mapped[int] = mapped_column(
        ForeignKey("options.id", ondelete="CASCADE"), comment="所选选项 ID"
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否答对")
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="提交时间"
    )

    session: Mapped["QuizSession"] = relationship(back_populates="answers")
    student: Mapped["Student"] = relationship()
