"""认证路由：教师端与学生端登录。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import success
from app.db.session import get_db
from app.schemas.auth import (
    StudentLoginRequest,
    StudentOut,
    TeacherLoginRequest,
    TeacherOut,
)
from app.services.auth_service import student_login, teacher_login

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/teacher/login")
def login_teacher(payload: TeacherLoginRequest, db: Session = Depends(get_db)) -> dict:
    """教师登录：仅凭账号（预录入数据库）。"""
    teacher = teacher_login(db, payload.username)
    return success(data=TeacherOut.model_validate(teacher), message="教师登录成功")


@router.post("/student/login")
def login_student(payload: StudentLoginRequest, db: Session = Depends(get_db)) -> dict:
    """学生登录：学号不存在则自动创建，已存在则直接登录。"""
    student = student_login(db, payload.student_id, payload.name)
    return success(data=StudentOut.model_validate(student), message="学生登录成功")
