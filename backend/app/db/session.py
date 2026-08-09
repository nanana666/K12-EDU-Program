"""数据库连接与会话管理（SQLAlchemy 2.x）。"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import DATA_DIR, settings

# 确保数据目录存在
DATA_DIR.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite 多线程访问
)

# SQLite 默认不启用外键约束，这里强制开启以保证级联删除等行为正确
@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的公共基类。"""


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：为每个请求提供独立会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
