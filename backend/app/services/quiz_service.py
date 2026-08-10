"""答题活动业务逻辑：创建、分发、提交、统计。"""

import json
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import AppError, NotFoundError
from app.models.answer import AnswerRecord
from app.models.option import Option
from app.models.question import Question
from app.models.quiz_session import QuizSession, QuizSessionQuestion
from app.models.student import Student
from app.schemas.quiz import (
    QuestionStatOut,
    QuizStatsOut,
    StudentBriefOut,
    StudentStatOut,
)


def _get_session(db: Session, session_id: int) -> QuizSession:
    session = db.scalar(
        select(QuizSession)
        .where(QuizSession.id == session_id)
        .options(
            selectinload(QuizSession.questions).selectinload(
                QuizSessionQuestion.question
            ),
            selectinload(QuizSession.answers),
        )
    )
    if session is None:
        raise NotFoundError(f"答题活动不存在：{session_id}")
    return session


def create_quiz_session(
    db: Session, title: str, question_ids: list[int]
) -> QuizSession:
    """创建答题活动：校验题目存在并打包。"""
    questions = list(
        db.scalars(select(Question).where(Question.id.in_(question_ids)))
    )
    found_ids = {q.id for q in questions}
    missing = [qid for qid in question_ids if qid not in found_ids]
    if missing:
        raise NotFoundError(f"以下题目不存在：{missing}")

    session = QuizSession(title=title, status="active")
    for index, question_id in enumerate(question_ids):
        session.questions.append(
            QuizSessionQuestion(question_id=question_id, sort_order=index)
        )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_quiz_sessions(db: Session) -> list[QuizSession]:
    """返回全部答题活动（按创建时间倒序）。"""
    stmt = (
        select(QuizSession)
        .options(selectinload(QuizSession.questions))
        .order_by(QuizSession.id.desc())
    )
    return list(db.scalars(stmt).unique())


def get_active_session(db: Session) -> QuizSession | None:
    """获取当前进行中的活动（学生端轮询）。"""
    return db.scalar(
        select(QuizSession)
        .where(QuizSession.status == "active")
        .options(
            selectinload(QuizSession.questions).selectinload(
                QuizSessionQuestion.question
            )
        )
        .order_by(QuizSession.id.desc())
    )


def finish_session(db: Session, session_id: int) -> QuizSession:
    """结束答题活动。"""
    session = _get_session(db, session_id)
    session.status = "finished"
    db.commit()
    db.refresh(session)
    return session


def submit_answers(
    db: Session, session_id: int, student_id: str, answers: list[dict]
) -> QuizSession:
    """学生提交答案：校验后写入（同一题重复提交则覆盖）。"""
    session = _get_session(db, session_id)
    if session.status != "active":
        raise AppError("该答题活动已结束，无法提交", code=409, status_code=409)

    # 学号不存在则自动创建学生
    student = db.get(Student, student_id)
    if student is None:
        student = Student(id=student_id, name=f"学生-{student_id[:8]}")
        db.add(student)

    allowed_questions = {sq.question_id for sq in session.questions}

    for item in answers:
        question_id = item["question_id"]
        if question_id not in allowed_questions:
            raise AppError(
                f"题目 {question_id} 不属于该答题活动", code=400, status_code=400
            )

        # 兼容旧格式 option_id，统一转为 option_ids
        option_ids = item.get("option_ids")
        if option_ids is None:
            single = item.get("option_id")
            if single is None:
                raise AppError(
                    "答案缺少所选选项", code=400, status_code=400
                )
            option_ids = [single]
        option_ids = [int(oid) for oid in option_ids]
        if not option_ids:
            raise AppError(
                "答案不能为空选项列表", code=400, status_code=400
            )

        # 校验所有选项都属于该题
        options = list(
            db.scalars(
                select(Option).where(
                    Option.id.in_(option_ids), Option.question_id == question_id
                )
            )
        )
        if len(options) != len(set(option_ids)):
            raise AppError(
                f"部分选项不属于题目 {question_id}",
                code=400,
                status_code=400,
            )

        # 判分：多选题须恰好选全所有正确答案，否则判错
        correct_option_ids = {
            opt.id
            for opt in db.scalars(
                select(Option).where(
                    Option.question_id == question_id, Option.is_correct.is_(True)
                )
            )
        }
        is_multi = len(correct_option_ids) > 1
        is_correct = set(option_ids) == correct_option_ids

        record = db.scalar(
            select(AnswerRecord).where(
                AnswerRecord.session_id == session_id,
                AnswerRecord.student_id == student_id,
                AnswerRecord.question_id == question_id,
            )
        )
        if record is None:
            record = AnswerRecord(
                session_id=session_id,
                student_id=student_id,
                question_id=question_id,
                selected_option_ids=json.dumps(option_ids, ensure_ascii=False),
                selected_option_id=option_ids[0] if not is_multi else None,
                is_multi=is_multi,
                is_correct=is_correct,
            )
            db.add(record)
        else:
            record.selected_option_ids = json.dumps(option_ids, ensure_ascii=False)
            record.selected_option_id = option_ids[0] if not is_multi else None
            record.is_multi = is_multi
            record.is_correct = is_correct

    db.commit()
    return session


def get_stats(db: Session, session_id: int) -> QuizStatsOut:
    """生成教师端统计看板数据。"""
    session = _get_session(db, session_id)
    answers = session.answers

    # 学生姓名映射
    student_ids = {a.student_id for a in answers}
    name_map: dict[str, str] = {}
    if student_ids:
        students = db.scalars(select(Student).where(Student.id.in_(student_ids)))
        name_map = {s.id: s.name for s in students}

    # 题目维度统计
    question_stats: list[QuestionStatOut] = []
    for sq in session.questions:
        qid = sq.question_id
        records = [a for a in answers if a.question_id == qid]
        correct = [a for a in records if a.is_correct]
        wrong = [a for a in records if not a.is_correct]
        question_stats.append(
            QuestionStatOut(
                question_id=qid,
                question_text=sq.question.text,
                correct_count=len(correct),
                wrong_count=len(wrong),
                correct_students=[
                    StudentBriefOut(student_id=a.student_id, name=name_map.get(a.student_id, ""))
                    for a in correct
                ],
                wrong_students=[
                    StudentBriefOut(student_id=a.student_id, name=name_map.get(a.student_id, ""))
                    for a in wrong
                ],
            )
        )

    # 学生维度统计
    by_student: dict[str, list[AnswerRecord]] = defaultdict(list)
    for a in answers:
        by_student[a.student_id].append(a)

    student_stats = [
        StudentStatOut(
            student_id=sid,
            name=name_map.get(sid, ""),
            correct_count=len([a for a in recs if a.is_correct]),
            wrong_count=len([a for a in recs if not a.is_correct]),
            correct_question_ids=sorted(a.question_id for a in recs if a.is_correct),
            wrong_question_ids=sorted(a.question_id for a in recs if not a.is_correct),
        )
        for sid, recs in by_student.items()
    ]
    student_stats.sort(key=lambda s: s.student_id)

    return QuizStatsOut(
        session_id=session.id,
        title=session.title,
        status=session.status,
        participant_count=len(student_stats),
        question_stats=question_stats,
        student_stats=student_stats,
    )
