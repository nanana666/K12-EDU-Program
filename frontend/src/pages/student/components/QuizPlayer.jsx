import { useState } from "react";

import http from "@/api/http";

/**
 * 沉浸式答题器：参考“扇贝单词 / 百词斩”的极简风格。
 * 大字题干 + 大选项按钮 + 清晰进度，弱化一切干扰。
 */
export default function QuizPlayer({ quiz, student, onSubmitted }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const questions = quiz.questions;
  const question = questions[current];
  const total = questions.length;
  const selected = answers[question.id];
  const isLast = current === total - 1;
  const progress = ((current + (selected != null ? 1 : 0)) / total) * 100;

  const pick = (optionId) => {
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
  };

  const goNext = () => {
    if (current < total - 1) setCurrent(current + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await http.post(`/quiz-sessions/${quiz.id}/submit`, {
        student_id: student.id,
        answers: questions.map((q) => ({
          question_id: q.id,
          option_id: answers[q.id],
        })),
      });
      onSubmitted(quiz.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-emerald-50 via-white to-white">
      {/* 顶部进度 */}
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
          <span>{quiz.title}</span>
          <span>
            第 {current + 1} / {total} 题
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 题目与选项 */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">
          <h1 className="text-center text-3xl font-bold leading-relaxed text-slate-800 md:text-4xl">
            {question.text}
          </h1>

          <div className="mt-10 flex flex-col gap-4">
            {question.options.map((opt) => {
              const isSelected = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => pick(opt.id)}
                  className={`w-full rounded-2xl border-2 px-6 py-5 text-left text-xl font-medium transition-all md:text-2xl ${
                    isSelected
                      ? "scale-[1.02] border-emerald-500 bg-emerald-50 text-emerald-700 shadow-lg"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  {isSelected && <span className="mr-2 text-emerald-500">●</span>}
                  {opt.text}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mt-6 text-center text-sm text-red-500">{error}</p>
          )}

          <div className="mt-10 flex justify-center">
            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={selected == null || submitting}
                className="rounded-2xl bg-emerald-600 px-12 py-4 text-xl font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                {submitting ? "提交中…" : "提交答案"}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={selected == null}
                className="rounded-2xl bg-emerald-600 px-12 py-4 text-xl font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                下一题
              </button>
            )}
          </div>
          {!isLast && (
            <p className="mt-4 text-center text-xs text-slate-300">
              选好后点“下一题”继续
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
