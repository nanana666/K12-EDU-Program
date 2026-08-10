"""数据库初始化：建表与种子数据。"""

from sqlalchemy import select

from app.db.session import Base, SessionLocal, engine
from app.models.teacher import Teacher


def init_db() -> None:
    """创建所有已注册模型对应的表。"""
    Base.metadata.create_all(bind=engine)
    migrate_schema()


def migrate_schema() -> None:
    """迁移 answer_records 表以支持多选题。

    旧表 selected_option_id 为 NOT NULL，SQLite 无法直接修改列约束，
    因此采用“重建表 + 复制数据”的标准迁移方式。
    """
    with engine.begin() as conn:
        info = {
            row[1]: row
            for row in conn.exec_driver_sql("PRAGMA table_info(answer_records)")
        }
        has_new_cols = "selected_option_ids" in info and "is_multi" in info
        id_not_null = bool(info.get("selected_option_id") and info["selected_option_id"][3] == 1)
        if has_new_cols and not id_not_null:
            return

        # 重建表：selected_option_id 改为可空，新增多选字段
        conn.exec_driver_sql("DROP TABLE IF EXISTS answer_records_backup")
        conn.exec_driver_sql(
            "ALTER TABLE answer_records RENAME TO answer_records_backup"
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE answer_records (
                id INTEGER NOT NULL PRIMARY KEY,
                session_id INTEGER NOT NULL,
                student_id VARCHAR(64) NOT NULL,
                question_id INTEGER NOT NULL,
                selected_option_id INTEGER,
                selected_option_ids TEXT,
                is_multi BOOLEAN DEFAULT 0,
                is_correct BOOLEAN DEFAULT 0,
                submitted_at DATETIME,
                CONSTRAINT uq_answer_record UNIQUE (session_id, student_id, question_id),
                FOREIGN KEY(session_id) REFERENCES quiz_sessions (id) ON DELETE CASCADE,
                FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE,
                FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE,
                FOREIGN KEY(selected_option_id) REFERENCES options (id) ON DELETE CASCADE
            )
            """
        )
        conn.exec_driver_sql(
            """
            INSERT INTO answer_records (
                id, session_id, student_id, question_id,
                selected_option_id, selected_option_ids, is_multi, is_correct, submitted_at
            )
            SELECT
                id, session_id, student_id, question_id,
                selected_option_id, selected_option_ids, is_multi, is_correct, submitted_at
            FROM answer_records_backup
            """
        )
        conn.exec_driver_sql("DROP TABLE answer_records_backup")
        conn.exec_driver_sql(
            "CREATE INDEX ix_answer_records_session_id ON answer_records (session_id)"
        )
        conn.exec_driver_sql(
            "CREATE INDEX ix_answer_records_student_id ON answer_records (student_id)"
        )


def seed_data() -> None:
    """写入基础种子数据：预置教师账号。"""
    db = SessionLocal()
    try:
        preset_teachers = [
            Teacher(username="admin", name="管理员"),
            Teacher(username="teacher1", name="王老师"),
            Teacher(username="teacher2", name="李老师"),
        ]
        for teacher in preset_teachers:
            exists = db.scalar(
                select(Teacher).where(Teacher.username == teacher.username)
            )
            if exists is None:
                db.add(teacher)
        db.commit()
    finally:
        db.close()
