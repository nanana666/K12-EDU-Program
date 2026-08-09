import { useCallback, useEffect, useState } from "react";

import http from "@/api/http";
import CreateQuiz from "./CreateQuiz";

/** 空题模板 */
const emptyQuestion = () => ({ text: "", options: [{ text: "", is_correct: true }] });
const jsonFormatExample =
  '[{ "text": "题干", "options": [{ "text": "选项", "is_correct": true }] }]';

/**
 * 题库管理：题目列表、添加题目、JSON 批量导入、删除。
 */
export default function QuestionManager() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyQuestion());
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState("");

  const loadQuestions = useCallback(async () => {
    try {
      const data = await http.get("/questions");
      setQuestions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const updateOption = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)),
    }));
  };

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { text: "", is_correct: false }],
    }));
  };

  const removeOption = (index) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      text: form.text.trim(),
      options: form.options.map((opt) => ({
        text: opt.text.trim(),
        is_correct: opt.is_correct,
      })),
    };
    if (!payload.text) {
      setError("请输入题目文本");
      return;
    }
    if (payload.options.length < 2) {
      setError("至少需要两个选项");
      return;
    }
    if (payload.options.some((o) => !o.text)) {
      setError("选项文本不能为空");
      return;
    }
    if (!payload.options.some((o) => o.is_correct)) {
      setError("请至少标记一个正确答案");
      return;
    }
    try {
      await http.post("/questions", payload);
      setForm(emptyQuestion());
      showMessage("题目添加成功");
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImport = async () => {
    setError("");
    let list;
    try {
      list = JSON.parse(importText);
    } catch {
      setError("JSON 格式不正确");
      return;
    }
    if (!Array.isArray(list) || list.length === 0) {
      setError("请提供题目数组，例如 [{ \"text\": \"...\", \"options\": [...] }]");
      return;
    }
    let ok = 0;
    for (const item of list) {
      try {
        await http.post("/questions", item);
        ok += 1;
      } catch (err) {
        setError(`第 ${ok + 1} 条导入失败：${err.message}`);
        break;
      }
    }
    if (ok === list.length) {
      setImportText("");
      showMessage(`成功导入 ${ok} 道题目`);
      loadQuestions();
    }
  };

  const handleDelete = async (questionId) => {
    if (!window.confirm("确定删除这道题吗？")) return;
    try {
      await http.delete(`/questions/${questionId}`);
      showMessage("题目已删除");
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid h-full grid-cols-[1fr_420px] gap-6">
      {/* 左侧：题目列表 + 发起答题 */}
      <div className="flex min-h-0 flex-col gap-6">
        <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-700">
              题库（{questions.length} 题）
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <p className="text-slate-400">加载中…</p>
            ) : questions.length === 0 ? (
              <p className="text-slate-400">还没有题目，请在右侧添加。</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {questions.map((q, qi) => (
                  <li
                    key={q.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-slate-800">
                        <span className="mr-2 text-slate-400">{qi + 1}.</span>
                        {q.text}
                      </p>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="shrink-0 text-sm text-red-400 transition hover:text-red-600"
                        title="删除题目"
                      >
                        删除
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <span
                          key={opt.id}
                          className={`rounded-full px-3 py-1 text-xs ${
                            opt.is_correct
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {opt.is_correct ? "✓ " : ""}
                          {opt.text}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <CreateQuiz questions={questions} onCreated={loadQuestions} />
      </div>

      {/* 右侧：添加题目 + 批量导入 */}
      <div className="flex min-h-0 flex-col gap-6 overflow-y-auto">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-700">添加题目</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <textarea
              value={form.text}
              onChange={(e) => updateForm({ text: e.target.value })}
              placeholder="请输入题目文本…"
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-brand-500"
            />
            <div className="flex flex-col gap-2">
              {form.options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={opt.is_correct}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        options: prev.options.map((o, i) => ({
                          ...o,
                          is_correct: i === index,
                        })),
                      }))
                    }
                    title="标记为正确答案"
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <input
                    value={opt.text}
                    onChange={(e) => updateOption(index, { text: e.target.value })}
                    placeholder={`选项 ${index + 1}`}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
                  />
                  {form.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="text-sm text-red-400 hover:text-red-600"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addOption}
                disabled={form.options.length >= 8}
                className="rounded-lg border border-brand-200 px-4 py-2 text-sm text-brand-600 transition hover:bg-brand-50 disabled:opacity-50"
              >
                + 添加选项
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-brand-600 py-2 font-medium text-white transition hover:bg-brand-700"
              >
                保存题目
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-700">批量导入（JSON）</h2>
          <p className="mb-3 text-xs text-slate-400">
            格式：{jsonFormatExample}
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{"text":"春眠不觉晓的作者是？","options":[{"text":"孟浩然","is_correct":true},{"text":"李白","is_correct":false}]}]'
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-brand-500"
          />
          <button
            onClick={handleImport}
            className="mt-3 w-full rounded-lg bg-slate-800 py-2 font-medium text-white transition hover:bg-slate-900"
          >
            导入题目
          </button>
        </section>

        {message && (
          <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
