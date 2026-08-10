import { useEffect, useState } from "react";

import http from "@/api/http";

/**
 * 学生端活动列表：展示所有进行中的答题活动供学生自行选择。
 * - 未提交的活动可点击进入答题；
 * - 已提交的活动显示"已完成"并禁用（防止重新作答）；
 * - "等待老师出题"作为列表中的一个选项。
 */
export default function QuizList({ student, onSelect, onWait, onLogout }) {
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // 携带学号，由后端判定该学生是否已提交过各活动
      const data = await http.get("/quiz-sessions/active-list", {
        params: { student_id: student.id },
      });
      setSessions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const available = (sessions || []).filter((s) => !s.submitted);
  const finished = (sessions || []).filter((s) => s.submitted);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-emerald-50 to-white">
      <header className="flex items-center justify-between px-8 pt-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            你好，{student.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            请选择一个进行中的答题活动开始作答
          </p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-xl border border-slate-300 px-5 py-2 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          切换账号
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-8 py-8">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center text-slate-400">正在检索答题活动…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">
                进行中的活动（{available.length}）
              </h2>
              <button
                onClick={load}
                className="rounded-lg border border-emerald-200 px-3 py-1 text-sm text-emerald-600 transition hover:bg-emerald-50"
              >
                刷新
              </button>
            </div>

            {available.length === 0 && finished.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-emerald-200 bg-white/60 px-6 py-10 text-center text-slate-400">
                当前没有进行中的答题活动
              </p>
            ) : (
              <>
                {available.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className="group flex w-full items-center justify-between rounded-2xl border-2 border-emerald-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-lg"
                  >
                    <div>
                      <p className="text-xl font-semibold text-slate-800">
                        {s.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        共 {s.question_count} 道题 · 进行中
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-5 py-2 text-sm font-medium text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                      开始答题
                    </span>
                  </button>
                ))}

                {finished.map((s) => (
                  <div
                    key={s.id}
                    className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-slate-50 p-6 opacity-70"
                  >
                    <div>
                      <p className="text-xl font-semibold text-slate-500">
                        {s.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        共 {s.question_count} 道题
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-5 py-2 text-sm font-medium text-slate-500">
                      ✓ 已完成
                    </span>
                  </div>
                ))}
              </>
            )}

            <button
              onClick={onWait}
              className="flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-6 text-left transition hover:border-amber-500 hover:bg-amber-50"
            >
              <div>
                <p className="text-xl font-semibold text-amber-700">
                  等待老师出题
                </p>
                <p className="mt-1 text-sm text-amber-600/70">
                  暂时不参加当前活动，继续等待新的题目
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-medium text-amber-700">
                进入等待
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
