"""认证相关请求/响应模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TeacherLoginRequest(BaseModel):
    """教师登录：仅账号，无密码（按需求暂不验证）。"""

    username: str = Field(min_length=1, max_length=64, description="教师账号")


class TeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    created_at: datetime


class StudentLoginRequest(BaseModel):
    """学生登录：学号必填，姓名可选。"""

    student_id: str = Field(min_length=1, max_length=64, description="学号（UUID）")
    name: str = Field(default="", max_length=64, description="学生姓名/昵称（可选）")


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime
