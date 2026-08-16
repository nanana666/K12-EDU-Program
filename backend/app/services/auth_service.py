"""认证业务逻辑：教师/学生登录。"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.student import Student
from app.models.teacher import Teacher


def teacher_login(db: Session, username: str) -> Teacher:
    """教师登录：校验账号是否已录入，未录入则报错。"""
    teacher = db.scalar(select(Teacher).where(Teacher.username == username))
    if teacher is None:
        raise NotFoundError(f"教师账号不存在：{username}")
    return teacher


def student_login(db: Session, student_id: str, name: str = "") -> Student:
    """学生登录：学号不存在则自动创建，已存在则直接登录。

    首次登录时姓名为空则生成默认昵称；后续登录可更新姓名。
    """
    student = db.get(Student, student_id)
    if student is None:
        student = Student(
            id=student_id,
            name=name or f"学生-{student_id[:8]}",
        )
        db.add(student)
        try:
            db.commit()
            db.refresh(student)
        except IntegrityError:
            # 并发首次登录撞主键：回滚后取已由其他请求创建的学生
            db.rollback()
            student = db.get(Student, student_id)
            if student is None:
                raise
    else:
        if name and name != student.name:
            student.name = name
            db.commit()
            db.refresh(student)
    return student
