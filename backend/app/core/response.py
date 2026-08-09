"""统一 JSON 响应格式。

约定格式：{"code": 0, "message": "ok", "data": <payload>}
- code = 0 表示成功；非 0 表示业务错误码。
- message 为人类可读的提示信息。
- data 为具体业务数据，失败时为 None。
"""

from typing import Any


def success(data: Any = None, message: str = "ok") -> dict:
    return {"code": 0, "message": message, "data": data}


def error(code: int, message: str, data: Any = None) -> dict:
    return {"code": code, "message": message, "data": data}
