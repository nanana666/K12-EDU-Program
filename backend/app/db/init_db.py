"""数据库初始化：建表与种子数据。"""

from sqlalchemy import select

from app.db.session import Base, SessionLocal, engine
from app.models.teacher import Teacher


def init_db() -> None:
    """创建所有已注册模型对应的表。"""
    Base.metadata.create_all(bind=engine)


def seed_data() -> None:
    """写入基础种子数据：预置教师账号。"""
    db = SessionLocal()
    try:
        preset_teachers = [
            Teacher(username="admin", name="管理员"),
            Teacher(username="teacher1", name="王老师"),
            Teacher(username="teacher2", name="李老师"),
        ]
        for teacher in preset_teachers:
            exists = db.scalar(
                select(Teacher).where(Teacher.username == teacher.username)
            )
            if exists is None:
                db.add(teacher)
        db.commit()
    finally:
        db.close()
