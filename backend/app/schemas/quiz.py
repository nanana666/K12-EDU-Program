"""答题活动相关请求/响应模型。"""

from datetime import datetime

from pydantic import BaseModel, Field


class QuizSessionCreate(BaseModel):
    """教师创建答题活动：标题 + 题目 ID 列表。"""

    title: str = Field(min_length=1, max_length=128, description="活动标题")
    question_ids: list[int] = Field(min_length=1, description="打包的题目 ID 列表")


class QuizSessionOut(BaseModel):
    """答题活动概要（教师端列表/详情）。"""

    id: int
    title: str
    status: str
    question_count: int
    created_at: datetime


class ActiveOptionOut(BaseModel):
    """学生端可见选项：不暴露正确答案。"""

    id: int
    text: str


class ActiveQuestionOut(BaseModel):
    """学生端可见题目：不暴露正确答案。"""

    id: int
    text: str
    options: list[ActiveOptionOut]
    correct_count: int = Field(
        default=1, description="正确答案数量（>1 表示多选题，不泄露具体选项）"
    )


class ActiveQuizOut(BaseModel):
    """学生端获取的活跃活动。"""

    id: int
    title: str
    status: str
    questions: list[ActiveQuestionOut]


class AnswerItemIn(BaseModel):
    """单题答案：支持单选与多选。

    兼容两种写法：
    - 多选/统一格式：{"question_id": 1, "option_ids": [2, 3]}
    - 旧格式单选：{"question_id": 1, "option_id": 2}
    """

    question_id: int
    option_ids: list[int] | None = None
    option_id: int | None = None


class AnswerSubmitIn(BaseModel):
    """学生提交答案：学号 + 所选答案列表。"""

    student_id: str = Field(min_length=1, max_length=64)
    answers: list[AnswerItemIn] = Field(min_length=1)


class StudentBriefOut(BaseModel):
    """学生简要信息（统计用）。"""

    student_id: str
    name: str


class QuestionStatOut(BaseModel):
    """题目维度统计。"""

    question_id: int
    question_text: str = ""
    correct_count: int
    wrong_count: int
    correct_students: list[StudentBriefOut]
    wrong_students: list[StudentBriefOut]


class StudentStatOut(BaseModel):
    """学生维度统计。"""

    student_id: str
    name: str
    correct_count: int
    wrong_count: int
    correct_question_ids: list[int]
    wrong_question_ids: list[int]


class QuizStatsOut(BaseModel):
    """教师端统计看板数据。"""

    session_id: int
    title: str
    status: str
    participant_count: int
    question_stats: list[QuestionStatOut]
    student_stats: list[StudentStatOut]
