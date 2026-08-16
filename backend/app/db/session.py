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
    # 局域网多设备并发访问：适当放大连接池，避免高峰期排队等连接
    pool_size=20,
    max_overflow=30,
)

@event.listens_for(engine, "connect")
def _configure_sqlite(dbapi_connection, connection_record):
    """每个连接建立时应用 SQLite 并发/完整性 PRAGMA。

    - journal_mode=WAL：读写并行，大幅降低多设备同时提交时的锁冲突；
    - synchronous=NORMAL：WAL 模式下在吞吐与安全之间取平衡；
    - busy_timeout=10000：写锁被占用时最多等待 10 秒，避免立刻抛
      "database is locked"；
    - foreign_keys=ON：SQLite 默认不启用外键约束，这里强制开启。
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=10000")
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
