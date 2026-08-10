"""学生账号模型。"""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Student(Base):
    """学生账号：学号即 UUID 主键，首次登录时自动创建。"""

    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="学号（UUID）")
    name: Mapped[str] = mapped_column(String(64), default="", comment="学生姓名/昵称")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="首次登录时间"
    )
