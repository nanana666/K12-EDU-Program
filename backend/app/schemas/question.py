"""题目相关请求/响应模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OptionIn(BaseModel):
    """创建题目的选项。"""

    text: str = Field(min_length=1, max_length=256, description="选项文本")
    is_correct: bool = Field(default=False, description="是否正确答案")


class QuestionIn(BaseModel):
    """创建题目：题干 + 选项列表。"""

    text: str = Field(min_length=1, max_length=2000, description="题目文本")
    options: list[OptionIn] = Field(min_length=2, max_length=8, description="选项列表")

    @field_validator("options")
    @classmethod
    def require_correct_option(cls, options: list[OptionIn]) -> list[OptionIn]:
        if not any(opt.is_correct for opt in options):
            raise ValueError("至少需要一个正确答案")
        return options


class OptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    is_correct: bool
    sort_order: int


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    created_at: datetime
    options: list[OptionOut]
