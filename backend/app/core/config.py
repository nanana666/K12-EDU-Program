"""应用配置：集中管理环境变量与路径常量。"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 目录（config.py 位于 backend/app/core/）
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    """全局配置，可通过环境变量（前缀 K12_）或 backend/.env 覆盖。"""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_prefix="K12_",
        extra="ignore",
    )

    app_name: str = "K12 小学语文教育"
    app_version: str = "0.1.0"

    # 局域网服务监听配置（教师端主机启动）
    host: str = "0.0.0.0"
    port: int = 8000

    # SQLite 数据库文件
    database_url: str = f"sqlite:///{DATA_DIR / 'k12_edu.db'}"


settings = Settings()
