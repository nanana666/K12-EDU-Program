import { useCallback, useEffect, useRef, useState } from "react";

import http from "@/api/http";

/**
 * 统计看板：活动列表 + 宏观/题目维度/学生维度统计（实时轮询）。
 */
export default function QuizDashboard() {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await http.get("/quiz-sessions");
      setSessions(data || []);
      // 默认选中第一个进行中的活动
      setActiveId((prev) => {
        if (prev && (data || []).some((s) => s.id === prev)) return prev;
        const running = (data || []).find((s) => s.status === "active");
        return running ? running.id : (data && data[0]?.id) || null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (activeId == null) return;
    try {
      const data = await http.get(`/quiz-sessions/${activeId}/stats`);
      setStats(data);
    } catch (err) {
      setError(err.message);
    }
  }, [activeId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 选中活动后每 3 秒刷新统计
  useEffect(() => {
    if (activeId == null) return;
    loadStats();
    timerRef.current = setInterval(loadStats, 3000);
    return () => clearInterval(timerRef.current);
  }, [activeId, loadStats]);

  const handleFinish = async (sessionId) => {
    if (!window.confirm("结束该活动后学生将无法继续提交，确定吗？")) return;
    try {
      await http.post(`/quiz-sessions/${sessionId}/finish`);
      loadSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="grid h-full grid-cols-[320px_1fr] gap-6">
      {/* 活动列表 */}
      <section className="flex min-h-0 flex-col rounded-xl bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-700">答题活动</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-slate-400">加载中…</p>
          ) : sessions.length === 0 ? (
            <p className="p-2 text-sm text-slate-400">还没有答题活动</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveId(s.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      activeId === s.id
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">
                        {s.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                          s.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.status === "active" ? "进行中" : "已结束"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {s.question_count} 题 · {new Date(s.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 统计详情 */}
      <section className="flex min-h-0 flex-col rounded-xl bg-white shadow-sm">
        {activeSession ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h2 className="font-semibold text-slate-700">{activeSession.title}</h2>
                <p className="text-xs text-slate-400">
                  {activeSession.status === "active"
                    ? "进行中 · 每 3 秒自动刷新"
                    : "已结束"}
                </p>
              </div>
              {activeSession.status === "active" && (
                <button
                  onClick={() => handleFinish(activeSession.id)}
                  className="rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-500 transition hover:bg-red-50"
                >
                  结束活动
                </button>
              )}
            </div>

            {error && (
              <p className="border-b border-slate-100 px-5 py-2 text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex-1 overflow-y-auto p-5">
              {!stats ? (
                <p className="text-slate-400">等待统计数据…</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* 宏观数据 */}
                  <div className="flex items-center gap-6 rounded-xl bg-brand-50 p-5">
                    <div>
                      <p className="text-3xl font-bold text-brand-600">
                        {stats.participant_count}
                      </p>
                      <p className="text-sm text-slate-500">参与回答人数</p>
                    </div>
                    <p className="text-sm text-slate-500">
                      共 {stats.question_stats.length} 道题
                    </p>
                  </div>

                  {/* 题目维度 */}
                  <div>
                    <h3 className="mb-2 font-semibold text-slate-700">题目维度统计</h3>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-slate-500">
                          <tr>
                            <th className="px-4 py-2">题号</th>
                            <th className="px-4 py-2">题干</th>
                            <th className="px-4 py-2 text-center">正确人数</th>
                            <th className="px-4 py-2 text-center">错误人数</th>
                            <th className="px-4 py-2">答对学生</th>
                            <th className="px-4 py-2">答错学生</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.question_stats.map((qs, idx) => (
                            <tr key={qs.question_id}>
                              <td className="px-4 py-2 font-medium text-slate-700">
                                {idx + 1}
                              </td>
                              <td className="max-w-56 px-4 py-2">
                                <span className="line-clamp-2">
                                  {qs.question_text || qs.question_id}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center text-emerald-600">
                                {qs.correct_count}
                              </td>
                              <td className="px-4 py-2 text-center text-red-500">
                                {qs.wrong_count}
                              </td>
                              <td className="max-w-44 px-4 py-2 text-xs text-slate-600">
                                {qs.correct_students.length
                                  ? qs.correct_students
                                      .map((s) => s.name || s.student_id)
                                      .join("、")
                                  : "—"}
                              </td>
                              <td className="max-w-44 px-4 py-2 text-xs text-slate-600">
                                {qs.wrong_students.length
                                  ? qs.wrong_students
                                      .map((s) => s.name || s.student_id)
                                      .join("、")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 学生维度 */}
                  <div>
                    <h3 className="mb-2 font-semibold text-slate-700">学生维度统计</h3>
                    {stats.student_stats.length === 0 ? (
                      <p className="text-sm text-slate-400">还没有学生提交答案</p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-left text-slate-500">
                            <tr>
                              <th className="px-4 py-2">学号</th>
                              <th className="px-4 py-2">姓名</th>
                              <th className="px-4 py-2 text-center">正确题数</th>
                              <th className="px-4 py-2 text-center">错误题数</th>
                              <th className="px-4 py-2">对题号</th>
                              <th className="px-4 py-2">错题号</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {stats.student_stats.map((ss) => (
                              <tr key={ss.student_id}>
                                <td className="px-4 py-2 font-mono text-xs text-slate-700">
                                  {ss.student_id}
                                </td>
                                <td className="px-4 py-2">{ss.name}</td>
                                <td className="px-4 py-2 text-center text-emerald-600">
                                  {ss.correct_count}
                                </td>
                                <td className="px-4 py-2 text-center text-red-500">
                                  {ss.wrong_count}
                                </td>
                                <td className="px-4 py-2 text-xs text-slate-600">
                                  {ss.correct_question_ids.length
                                    ? ss.correct_question_ids.join("、")
                                    : "—"}
                                </td>
                                <td className="px-4 py-2 text-xs text-slate-600">
                                  {ss.wrong_question_ids.length
                                    ? ss.wrong_question_ids.join("、")
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-400">
            请选择一个答题活动查看统计
          </div>
        )}
      </section>
    </div>
  );
}
