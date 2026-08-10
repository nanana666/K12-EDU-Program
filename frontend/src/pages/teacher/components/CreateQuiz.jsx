import { useState } from "react";

import http from "@/api/http";

/**
 * 发起答题：勾选题目打包，创建并发布答题活动。
 */
export default function CreateQuiz({ questions, onCreated }) {
  const [selected, setSelected] = useState(new Set());
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    setError("");
    setMessage("");
    if (selected.size === 0) {
      setError("请至少选择一道题");
      return;
    }
    if (!title.trim()) {
      setError("请输入活动标题");
      return;
    }
    setLoading(true);
    try {
      const data = await http.post("/quiz-sessions", {
        title: title.trim(),
        question_ids: [...selected],
      });
      setMessage(`已发布「${data.title}」，学生端将收到 ${data.question_count} 道题`);
      setSelected(new Set());
      setTitle("");
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">发起答题</h2>
        <span className="text-sm text-slate-400">已选 {selected.size} 题</span>
      </div>
      <div className="mb-3 max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {questions.length === 0 ? (
          <p className="px-2 py-1 text-sm text-slate-400">题库为空</p>
        ) : (
          questions.map((q) => (
            <label
              key={q.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.has(q.id)}
                onChange={() => toggle(q.id)}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span className="line-clamp-2 text-slate-700">{q.text}</span>
            </label>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="活动标题，如：第一单元随堂练习"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
        />
        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "发布中…" : "发布答题"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
