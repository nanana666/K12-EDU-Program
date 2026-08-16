"""系统信息路由：供教师端展示学生端连接地址。"""

from fastapi import APIRouter

from app.core.config import settings
from app.core.net import get_lan_ip
from app.core.response import success

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
def system_info() -> dict:
    """返回本机局域网地址与端口，教师端据此告知学生端填写连接地址。"""
    lan_ip = get_lan_ip() or "127.0.0.1"
    return success(
        data={
            "app_name": settings.app_name,
            "version": settings.app_version,
            "lan_ip": lan_ip,
            "port": settings.port,
            "server_base": f"http://{lan_ip}:{settings.port}",
            "status": "running",
        }
    )
