"""题目选项模型。"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.question import Question


class Option(Base):
    """选择题选项：文本 + 是否正确。"""

    __tablename__ = "options"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(String(256), comment="选项文本")
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否正确答案")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="展示顺序")

    question: Mapped["Question"] = relationship(back_populates="options")
