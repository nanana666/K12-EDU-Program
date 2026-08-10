import { useEffect, useRef } from "react";

import http from "@/api/http";

/**
 * 等待出题页：极简、柔和，适合小学生。
 * 轮询进行中活动列表，发现新活动时回调通知列表页刷新。
 */
export default function WaitingRoom({ student, onNewQuiz, onBack, onLogout }) {
  const knownIdsRef = useRef(null); // null 表示首次轮询尚未初始化

  useEffect(() => {
    let timer;
    const check = async () => {
      try {
        const data = await http.get("/quiz-sessions/active-list");
        const ids = (data || []).map((s) => s.id);
        if (knownIdsRef.current === null) {
          // 首次轮询：仅记录当前已有活动，不触发"新活动"跳转
          knownIdsRef.current = ids;
          return;
        }
        const fresh = ids.filter((id) => !knownIdsRef.current.includes(id));
        if (fresh.length > 0) {
          onNewQuiz();
          return;
        }
        knownIdsRef.current = ids;
      } catch {
        // 暂时连不上教师端时保持等待，不打扰
      }
    };
    check();
    timer = setInterval(check, 3000);
    return () => clearInterval(timer);
  }, [onNewQuiz]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100 shadow-inner">
        <span className="h-10 w-10 animate-pulse rounded-full bg-emerald-400" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">
          你好，{student.name}
        </h1>
        <p className="mt-3 text-lg text-slate-500">请稍等，老师马上出题…</p>
      </div>
      <p className="rounded-full bg-white px-6 py-2 text-sm text-slate-400 shadow-sm">
        学号 {student.id}
      </p>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-slate-300 px-6 py-2 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          返回活动列表
        </button>
        <button
          onClick={onLogout}
          className="rounded-xl border border-slate-300 px-6 py-2 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          切换账号
        </button>
      </div>
    </div>
  );
}
