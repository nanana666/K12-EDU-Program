"""业务异常与统一异常处理。"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .response import error


class AppError(Exception):
    """业务异常基类，携带业务错误码与 HTTP 状态码。"""

    def __init__(self, message: str, code: int = 1, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class NotFoundError(AppError):
    def __init__(self, message: str = "资源不存在"):
        super().__init__(message, code=404, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str = "资源冲突"):
        super().__init__(message, code=409, status_code=409)


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器，保证所有响应都符合统一 JSON 格式。"""

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        message = first.get("msg", "请求参数校验失败")
        detail = f"{field}: {message}" if field else message
        return JSONResponse(
            status_code=422,
            content=error(code=422, message=f"请求参数校验失败：{detail}"),
        )

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=error(code=exc.code, message=exc.message),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        # 兜底：避免向客户端泄露内部堆栈
        return JSONResponse(
            status_code=500,
            content=error(code=500, message="服务器内部错误，请稍后重试"),
        )
