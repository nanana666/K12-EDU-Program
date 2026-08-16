"""单机多学生并发模拟 + 状态一致性校验脚本（局域网联调测试）。

覆盖场景：
  T0 连通性：并发 GET /health（经局域网 IP）
  T1 并发提交：30 名学生「登录 + 提交」全流程同时起跑
  T2 高并发提交：50 名学生同时提交 + 同一新生 5 路并发重复提交（期望 1 成功 4 个 409）
  T3 读写混合：50 名学生提交期间，教师端持续轮询 /stats
  T4 一致性校验：/stats 返回 vs 脚本期望值 vs SQLite 直查，逐项比对

运行方式（在仓库根目录）：
  backend\\venv\\Scripts\\python.exe backend\\tests\\concurrency_sim.py \
      --base http://<局域网IP>:8000 --db backend/data/k12_concurrency_test.db
"""

import argparse
import asyncio
import json
import sqlite3
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="K12 单机并发模拟测试")
    parser.add_argument("--base", default="http://127.0.0.1:8000",
                        help="被测后端地址（建议用局域网 IP）")
    parser.add_argument("--db", default="backend/data/k12_concurrency_test.db",
                        help="测试数据库文件路径（需与后端 K12_DATABASE_URL 一致）")
    parser.add_argument("--questions", type=int, default=10, help="题目数量")
    parser.add_argument("--students-t1", type=int, default=30, help="T1 学生数")
    parser.add_argument("--students-t2", type=int, default=50, help="T2 学生数")
    parser.add_argument("--students-t3", type=int, default=50, help="T3 学生数")
    parser.add_argument("--report", default="backend/logs/concurrency_report.json",
                        help="测试报告输出路径")
    parser.add_argument("--timeout", type=float, default=15.0, help="单请求超时秒数")
    parser.add_argument("--poll-interval", type=float, default=0.5,
                        help="T3 教师端统计轮询间隔（秒）")
    return parser.parse_args()


class HttpResult:
    __slots__ = ("status", "body", "seconds", "ok")

    def __init__(self, status: int, body: dict, seconds: float):
        self.status = status
        self.body = body if isinstance(body, dict) else {}
        self.seconds = seconds
        self.ok = status == 200 and self.body.get("code") == 0


def _request(method: str, url: str, payload: dict | None = None,
             timeout: float = 15.0) -> HttpResult:
    """同步 HTTP 请求（供 asyncio.to_thread 包装）。"""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return HttpResult(resp.status, body, time.perf_counter() - start)
    except urllib.error.HTTPError as exc:
        body = {}
        try:
            body = json.loads(exc.read().decode("utf-8"))
        except Exception:
            pass
        return HttpResult(exc.code, body, time.perf_counter() - start)
    except Exception as exc:
        return HttpResult(0, {"error": str(exc)}, time.perf_counter() - start)


async def get(url: str, timeout: float) -> HttpResult:
    return await asyncio.to_thread(_request, "GET", url, None, timeout)


async def post(url: str, payload: dict, timeout: float) -> HttpResult:
    return await asyncio.to_thread(_request, "POST", url, payload, timeout)


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, int(round(p / 100 * (len(ordered) - 1))))
    return ordered[idx]


def summarize(timings: list[float]) -> dict:
    return {
        "count": len(timings),
        "p50_ms": round(percentile(timings, 50) * 1000, 1),
        "p95_ms": round(percentile(timings, 95) * 1000, 1),
        "max_ms": round(max(timings, default=0) * 1000, 1),
        "min_ms": round(min(timings, default=0) * 1000, 1),
    }


class Tester:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.base = args.base.rstrip("/")
        self.api = f"{self.base}/api/v1"
        self.errors: list[str] = []
        self.report: dict = {}
        # 题目标准答案：question_id -> 正确选项 id 集合
        self.correct: dict[int, set[int]] = {}
        # 题目全部选项 id（按 id 升序）：用于构造“错误选项”
        self.option_ids: dict[int, list[int]] = {}
        self.question_ids: list[int] = []
        self.multi_question_ids: set[int] = set()

    # ---------- 基础操作 ----------

    async def login(self, student_id: str, name: str = "") -> HttpResult:
        return await post(
            f"{self.api}/auth/student/login",
            {"student_id": student_id, "name": name or f"学生-{student_id}"},
            self.args.timeout,
        )

    async def submit(self, session_id: int, student_id: str,
                     answers: list[dict]) -> HttpResult:
        return await post(
            f"{self.api}/quiz-sessions/{session_id}/submit",
            {"student_id": student_id, "answers": answers},
            self.args.timeout,
        )

    async def create_question(self, text: str, option_texts: list[str],
                              correct_indices: list[int]) -> HttpResult:
        options = [
            {"text": t, "is_correct": i in correct_indices}
            for i, t in enumerate(option_texts)
        ]
        return await post(
            f"{self.api}/questions", {"text": text, "options": options},
            self.args.timeout,
        )

    async def create_session(self, title: str, question_ids: list[int]) -> int:
        res = await post(
            f"{self.api}/quiz-sessions",
            {"title": title, "question_ids": question_ids},
            self.args.timeout,
        )
        if not res.ok:
            raise RuntimeError(f"创建答题活动失败: {res.status} {res.body}")
        return res.body["data"]["id"]

    async def fetch_stats(self, session_id: int) -> dict | None:
        res = await get(f"{self.api}/quiz-sessions/{session_id}/stats",
                        self.args.timeout)
        return res.body.get("data") if res.ok else None

    # ---------- 数据准备 ----------

    async def seed(self) -> None:
        """创建题目（含 2 道多选题）并记录标准答案。"""
        multi = {3, 7}
        for i in range(1, self.args.questions + 1):
            if i in multi:
                correct_indices = [0, 1]
                option_texts = ["选项A", "选项B", "选项C", "选项D"]
            else:
                correct_indices = [0]
                option_texts = ["选项A", "选项B", "选项C", "选项D"]
            res = await self.create_question(
                f"并发测试题 {i}", option_texts, correct_indices
            )
            if not res.ok:
                raise RuntimeError(f"创建题目失败: {res.status} {res.body}")
            qid = res.body["data"]["id"]
            self.question_ids.append(qid)
            opts = res.body["data"]["options"]
            self.option_ids[qid] = sorted(o["id"] for o in opts)
            self.correct[qid] = {o["id"] for o in opts if o["is_correct"]}
            if i in multi:
                self.multi_question_ids.add(qid)
        print(f"  已创建 {len(self.question_ids)} 道题（含 "
              f"{len(self.multi_question_ids)} 道多选题）")

    def answers_for(self, student_index: int) -> list[dict]:
        """按确定性规则生成该学生的答案（约 1/4 题目答错）。"""
        answers = []
        for j, qid in enumerate(self.question_ids):
            correct = self.correct[qid]
            # 规则：(学生序号+题号) % 4 == 0 时答错，否则答对
            if (student_index + 1 + j + 1) % 4 == 0:
                wrong = next(oid for oid in self.option_ids[qid]
                             if oid not in correct)
                answers.append({"question_id": qid, "option_ids": [wrong]})
            else:
                answers.append({"question_id": qid, "option_ids": sorted(correct)})
        return answers

    # ---------- T4 期望值 ----------

    def expected_stats(self, session_id: int,
                       submitted: dict[str, list[dict]]) -> dict:
        """由“实际发送并成功的答案”推导期望统计。submitted: student_id -> answers。"""
        by_question: dict[int, dict] = {
            qid: {"correct": set(), "wrong": set()}
            for qid in self.question_ids
        }
        by_student: dict[str, dict] = {}
        for sid, answers in submitted.items():
            st = {"correct_ids": set(), "wrong_ids": set()}
            for item in answers:
                qid = item["question_id"]
                selected = set(item["option_ids"])
                if selected == self.correct[qid]:
                    by_question[qid]["correct"].add(sid)
                    st["correct_ids"].add(qid)
                else:
                    by_question[qid]["wrong"].add(sid)
                    st["wrong_ids"].add(qid)
            by_student[sid] = st
        return {
            "participant_count": len(submitted),
            "question_stats": [
                {
                    "question_id": qid,
                    "correct_students": sorted(by_question[qid]["correct"]),
                    "wrong_students": sorted(by_question[qid]["wrong"]),
                }
                for qid in self.question_ids
            ],
            "student_stats": [
                {
                    "student_id": sid,
                    "correct_ids": sorted(by_student[sid]["correct_ids"]),
                    "wrong_ids": sorted(by_student[sid]["wrong_ids"]),
                }
                for sid in sorted(by_student)
            ],
        }

    # ---------- 场景 ----------

    async def t0_connectivity(self) -> dict:
        print("\n[T0] 连通性测试：并发 20 次 GET /health")
        results = await asyncio.gather(
            *[get(f"{self.base}/health", self.args.timeout) for _ in range(20)]
        )
        ok = sum(1 for r in results if r.ok)
        for r in results:
            if not r.ok:
                self.errors.append(f"T0 health 失败: {r.status} {r.body}")
        return {"ok_count": ok, "total": len(results),
                "timings": summarize([r.seconds for r in results])}

    async def _submit_burst(self, session_id: int,
                            students: list[dict[str, str]],
                            answers: list[list[dict]],
                            ) -> dict[str, HttpResult]:
        """students[i] -> answers[i] 同时提交，返回 student_id -> 结果。"""
        tasks = [
            self.submit(session_id, s["id"], answers[i])
            for i, s in enumerate(students)
        ]
        results = await asyncio.gather(*tasks)
        return {s["id"]: results[i] for i, s in enumerate(students)}

    async def t1(self) -> dict:
        print(f"\n[T1] 30 名学生「登录+提交」全流程并发")
        n = self.args.students_t1
        session_id = await self.create_session("T1 并发提交", self.question_ids)
        students = [
            {"id": f"STU-T1-{k:04d}", "name": f"并发生{k:03d}"} for k in range(n)
        ]

        async def flow(student: dict[str, str]) -> tuple[str, HttpResult]:
            login = await self.login(student["id"], student["name"])
            if not login.ok:
                return student["id"], login
            idx = int(student["id"].rsplit("-", 1)[1])
            submit = await self.submit(session_id, student["id"],
                                       self.answers_for(idx))
            return student["id"], submit

        start = time.perf_counter()
        results = dict(await asyncio.gather(*[flow(s) for s in students]))
        burst = time.perf_counter() - start
        ok = {sid: r for sid, r in results.items() if r.ok}
        fail = {sid: r for sid, r in results.items() if not r.ok}
        for sid, r in fail.items():
            self.errors.append(f"T1 学生 {sid} 失败: {r.status} {r.body}")
        timings = [r.seconds for r in results.values()]
        submitted = {
            sid: self.answers_for(int(sid.rsplit("-", 1)[1]))
            for sid in ok
        }
        return {
            "session_id": session_id,
            "burst_seconds": round(burst, 3),
            "success": len(ok), "failed": len(fail),
            "timings": summarize(timings),
            "submitted": submitted,
        }

    async def t2(self) -> dict:
        print(f"\n[T2] 50 名学生同时提交 + 5 路并发重复提交竞争")
        n = self.args.students_t2
        session_id = await self.create_session("T2 高并发", self.question_ids)
        students = [
            {"id": f"STU-T2-{k:04d}", "name": f"并发生{k:03d}"} for k in range(n)
        ]
        # 预先并发登录
        login_results = await asyncio.gather(
            *[self.login(s["id"], s["name"]) for s in students]
        )
        for s, r in zip(students, login_results):
            if not r.ok:
                self.errors.append(f"T2 登录 {s['id']} 失败: {r.status} {r.body}")

        answers = [
            self.answers_for(100 + k) for k in range(n)
        ]
        start = time.perf_counter()
        submit_map = await self._submit_burst(session_id, students, answers)
        burst = time.perf_counter() - start
        ok = {sid: r for sid, r in submit_map.items() if r.ok}
        fail = {sid: r for sid, r in submit_map.items() if not r.ok}
        for sid, r in fail.items():
            self.errors.append(f"T2 学生 {sid} 提交失败: {r.status} {r.body}")

        # 重复提交竞争：新学生同时发 5 次，期望 1 成功 + 4 个 409
        race_id = "STU-RACE-001"
        race_login = await self.login(race_id, "竞争学生")
        if not race_login.ok:
            self.errors.append(f"T2 race 登录失败: {race_login.status} {race_login.body}")
        race_answers = self.answers_for(999)
        race_results = await asyncio.gather(
            *[self.submit(session_id, race_id, race_answers) for _ in range(5)]
        )
        race_ok = [r for r in race_results if r.ok]
        race_409 = [r for r in race_results if r.status == 409]
        race_other = [r for r in race_results if r.ok is False and r.status != 409]
        for r in race_other:
            self.errors.append(f"T2 race 非预期状态: {r.status} {r.body}")

        submitted = {sid: answers[i] for i, sid in enumerate(ok)}
        if race_ok:
            submitted[race_id] = race_answers
        return {
            "session_id": session_id,
            "burst_seconds": round(burst, 3),
            "success": len(ok), "failed": len(fail),
            "timings": summarize([r.seconds for r in submit_map.values()]),
            "race": {
                "success": len(race_ok),
                "conflict_409": len(race_409),
                "other": len(race_other),
            },
            "submitted": submitted,
        }

    async def t3(self) -> dict:
        print(f"\n[T3] 读写混合：50 名学生提交 + 教师端轮询 /stats")
        n = self.args.students_t3
        session_id = await self.create_session("T3 读写混合", self.question_ids)
        students = [
            {"id": f"STU-T3-{k:04d}", "name": f"并发生{k:03d}"} for k in range(n)
        ]
        await asyncio.gather(*[self.login(s["id"], s["name"]) for s in students])
        answers = [self.answers_for(200 + k) for k in range(n)]

        poll_hits: list[dict] = []
        stop = asyncio.Event()
        poll_interval = self.args.poll_interval

        async def poll_stats() -> None:
            while not stop.is_set():
                res = await get(
                    f"{self.api}/quiz-sessions/{session_id}/stats",
                    self.args.timeout,
                )
                poll_hits.append({"ok": res.ok, "status": res.status,
                                  "seconds": res.seconds})
                try:
                    await asyncio.wait_for(stop.wait(), timeout=poll_interval)
                except asyncio.TimeoutError:
                    pass

        poller = asyncio.create_task(poll_stats())
        start = time.perf_counter()
        submit_map = await self._submit_burst(session_id, students, answers)
        burst = time.perf_counter() - start
        stop.set()
        await poller

        ok = {sid: r for sid, r in submit_map.items() if r.ok}
        fail = {sid: r for sid, r in submit_map.items() if not r.ok}
        for sid, r in fail.items():
            self.errors.append(f"T3 学生 {sid} 提交失败: {r.status} {r.body}")
        poll_fail = [h for h in poll_hits if not h["ok"]]
        for h in poll_fail:
            self.errors.append(f"T3 stats 轮询失败: {h['status']}")
        submitted = {sid: answers[i] for i, sid in enumerate(ok)}
        return {
            "session_id": session_id,
            "burst_seconds": round(burst, 3),
            "success": len(ok), "failed": len(fail),
            "timings": summarize([r.seconds for r in submit_map.values()]),
            "poll_count": len(poll_hits),
            "poll_failed": len(poll_fail),
            "poll_timings": summarize([h["seconds"] for h in poll_hits]),
            "submitted": submitted,
        }

    # ---------- T4 校验 ----------

    async def verify_session(self, label: str, session_id: int,
                             submitted: dict[str, list[dict]]) -> dict:
        stats = await self.fetch_stats(session_id)
        if stats is None:
            self.errors.append(f"T4 {label}: 无法获取 /stats")
            return {"label": label, "ok": False, "mismatches": ["stats 获取失败"]}

        expected = self.expected_stats(session_id, submitted)
        mismatches: list[str] = []

        if stats["participant_count"] != expected["participant_count"]:
            mismatches.append(
                f"participant_count: 期望 {expected['participant_count']} "
                f"实际 {stats['participant_count']}"
            )

        qmap = {q["question_id"]: q for q in stats["question_stats"]}
        for qexp in expected["question_stats"]:
            qact = qmap.get(qexp["question_id"])
            if qact is None:
                mismatches.append(f"题目 {qexp['question_id']} 缺失")
                continue
            exp_c = set(qexp["correct_students"])
            exp_w = set(qexp["wrong_students"])
            act_c = {s["student_id"] for s in qact["correct_students"]}
            act_w = {s["student_id"] for s in qact["wrong_students"]}
            if exp_c != act_c:
                mismatches.append(
                    f"题目 {qexp['question_id']} 答对名单不一致: "
                    f"缺 {sorted(exp_c - act_c)} 多 {sorted(act_c - exp_c)}"
                )
            if exp_w != act_w:
                mismatches.append(
                    f"题目 {qexp['question_id']} 答错名单不一致: "
                    f"缺 {sorted(exp_w - act_w)} 多 {sorted(act_w - exp_w)}"
                )
            if len(act_c) != qact["correct_count"] or len(act_w) != qact["wrong_count"]:
                mismatches.append(
                    f"题目 {qexp['question_id']} 计数不一致: "
                    f"correct {qact['correct_count']}/{len(act_c)} "
                    f"wrong {qact['wrong_count']}/{len(act_w)}"
                )

        smap = {s["student_id"]: s for s in stats["student_stats"]}
        for sexp in expected["student_stats"]:
            sact = smap.get(sexp["student_id"])
            if sact is None:
                mismatches.append(f"学生 {sexp['student_id']} 缺失")
                continue
            if set(sexp["correct_ids"]) != set(sact["correct_question_ids"]):
                mismatches.append(
                    f"学生 {sexp['student_id']} 对题号不一致: "
                    f"期望 {sexp['correct_ids']} 实际 {sact['correct_question_ids']}"
                )
            if set(sexp["wrong_ids"]) != set(sact["wrong_question_ids"]):
                mismatches.append(
                    f"学生 {sexp['student_id']} 错题号不一致: "
                    f"期望 {sexp['wrong_ids']} 实际 {sact['wrong_question_ids']}"
                )

        db = self.db_check(session_id, expected["participant_count"])
        return {
            "label": label,
            "ok": not mismatches and db["ok"],
            "participant_expected": expected["participant_count"],
            "participant_actual": stats["participant_count"],
            "question_count": len(self.question_ids),
            "mismatches": mismatches,
            "db": db,
        }

    def db_check(self, session_id: int, expected_participants: int) -> dict:
        """直查 SQLite 做第二重校验。"""
        try:
            con = sqlite3.connect(self.args.db)
            con.row_factory = sqlite3.Row
            total = con.execute(
                "SELECT COUNT(*) c FROM answer_records WHERE session_id=?",
                (session_id,),
            ).fetchone()["c"]
            distinct = con.execute(
                "SELECT COUNT(DISTINCT student_id) c FROM answer_records "
                "WHERE session_id=?",
                (session_id,),
            ).fetchone()["c"]
            expected_rows = expected_participants * len(self.question_ids)
            problems = []
            if total != expected_rows:
                problems.append(f"answer_records 行数 {total} != 期望 {expected_rows}")
            if distinct != expected_participants:
                problems.append(
                    f"去重学生数 {distinct} != 期望 {expected_participants}"
                )
            con.close()
            return {"ok": not problems, "rows": total, "distinct_students": distinct,
                    "problems": problems}
        except Exception as exc:
            return {"ok": False, "rows": None, "distinct_students": None,
                    "problems": [f"DB 检查异常: {exc}"]}

    # ---------- 主流程 ----------

    async def run(self) -> int:
        print(f"目标后端: {self.base}")
        health = await get(f"{self.base}/health", self.args.timeout)
        if not health.ok:
            print(f"健康检查失败: {health.status} {health.body}", file=sys.stderr)
            return 2
        print(f"后端在线（{health.body['data']['lan_ip']}:{health.body['data']['port']}）")

        self.report["health"] = health.body["data"]
        print("准备题目数据…")
        await self.seed()

        t0 = await self.t0_connectivity()
        self.report["t0"] = t0
        print(f"  T0 结果: 成功 {t0['ok_count']}/{t0['total']}，"
              f"p50={t0['timings']['p50_ms']}ms p95={t0['timings']['p95_ms']}ms")

        t1 = await self.t1()
        self.report["t1"] = t1
        print(f"  T1 结果: 成功 {t1['success']}/{t1['success'] + t1['failed']}，"
              f"耗时 {t1['burst_seconds']}s")

        t2 = await self.t2()
        self.report["t2"] = t2
        print(f"  T2 结果: 成功 {t2['success']}/{t2['success'] + t2['failed']}，"
              f"耗时 {t2['burst_seconds']}s；重复提交竞争: "
              f"成功 {t2['race']['success']} / 409 {t2['race']['conflict_409']} / "
              f"其他 {t2['race']['other']}")

        t3 = await self.t3()
        self.report["t3"] = t3
        print(f"  T3 结果: 成功 {t3['success']}/{t3['success'] + t3['failed']}，"
              f"耗时 {t3['burst_seconds']}s；stats 轮询 {t3['poll_count']} 次，"
              f"失败 {t3['poll_failed']} 次")

        print("\n[T4] 状态一致性校验…")
        verifications = [
            await self.verify_session("T1", t1["session_id"], t1["submitted"]),
            await self.verify_session("T2", t2["session_id"], t2["submitted"]),
            await self.verify_session("T3", t3["session_id"], t3["submitted"]),
        ]
        self.report["t4"] = verifications
        for v in verifications:
            print(f"  {v['label']}: {'PASS' if v['ok'] else 'FAIL'} "
                  f"(参与 {v['participant_actual']}/{v['participant_expected']}，"
                  f"DB 行数 {v['db']['rows']})")
            for m in v["mismatches"]:
                print(f"    - {m}")
            for p in v["db"]["problems"]:
                print(f"    - [DB] {p}")

        self.report["errors"] = self.errors
        self.report["passed"] = (not self.errors
                                 and all(v["ok"] for v in verifications)
                                 and t2["race"]["success"] == 1
                                 and t2["race"]["conflict_409"] == 4)
        report_path = Path(self.args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(self.report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\n报告已写入: {report_path.resolve()}")
        print("结论:", "全部通过" if self.report["passed"] else "存在问题")
        return 0 if self.report["passed"] else 1


async def main() -> int:
    args = parse_args()
    tester = Tester(args)
    return await tester.run()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
