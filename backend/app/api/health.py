"""健康检查路由：用于验证服务与统一响应格式。"""

from fastapi import APIRouter

from app.core.config import settings
from app.core.response import success

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    return success(
        data={
            "app_name": settings.app_name,
            "version": settings.app_version,
            "status": "running",
        },
        message="服务运行正常",
    )
