"""数据模型层：SQLAlchemy ORM 模型定义。

导入所有模型，确保 Base.metadata 能注册全部表。
"""

from app.models.option import Option
from app.models.question import Question
from app.models.quiz_session import QuizSession, QuizSessionQuestion
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.answer import AnswerRecord

__all__ = [
    "Teacher",
    "Student",
    "Question",
    "Option",
    "QuizSession",
    "QuizSessionQuestion",
    "AnswerRecord",
]
