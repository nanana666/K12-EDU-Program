import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import http from "@/api/http";
import { useAuth } from "@/store/auth";
import QuizPlayer from "./components/QuizPlayer";
import WaitingRoom from "./components/WaitingRoom";

/**
 * 学生端主页：等待出题 → 沉浸式答题 → 提交完成。
 */
export default function StudentHome() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("waiting"); // waiting | playing | done
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [error, setError] = useState("");

  if (!student) {
    return <Navigate to="/student" replace />;
  }

  // 获取已提交过的活动 ID，避免重复进入
  const getSubmittedIds = () => {
    try {
      return JSON.parse(localStorage.getItem("k12-submitted-sessions") || "[]");
    } catch {
      return [];
    }
  };

  // 等待阶段：每 3 秒轮询当前活跃活动
  useEffect(() => {
    if (phase !== "waiting") return undefined;
    const submitted = getSubmittedIds();
    const check = async () => {
      try {
        const data = await http.get("/quiz-sessions/active");
        if (data && !submitted.includes(data.id)) {
          setActiveQuiz(data);
          setPhase("playing");
        }
      } catch {
        // 学生端连不上教师端时保持等待，不打扰
      }
    };
    check();
    const timer = setInterval(check, 3000);
    return () => clearInterval(timer);
  }, [phase]);

  const handleSubmitted = (sessionId) => {
    const submitted = getSubmittedIds();
    localStorage.setItem(
      "k12-submitted-sessions",
      JSON.stringify([...new Set([...submitted, sessionId])]),
    );
    setPhase("done");
  };

  const handleBackToWaiting = () => {
    setActiveQuiz(null);
    setPhase("waiting");
  };

  if (phase === "playing" && activeQuiz) {
    return (
      <QuizPlayer
        quiz={activeQuiz}
        student={student}
        onSubmitted={handleSubmitted}
      />
    );
  }

  if (phase === "done") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-emerald-50 to-white">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-600">
          ✓
        </div>
        <h1 className="text-3xl font-bold text-emerald-700">答题完成！</h1>
        <p className="text-slate-500">你的答案已提交给老师</p>
        <div className="flex gap-3">
          <button
            onClick={handleBackToWaiting}
            className="rounded-xl bg-emerald-600 px-8 py-3 font-medium text-white transition hover:bg-emerald-700"
          >
            返回等待
          </button>
          <button
            onClick={() => navigate("/student", { replace: true })}
            className="rounded-xl border border-slate-300 px-8 py-3 font-medium text-slate-600 transition hover:bg-slate-50"
          >
            切换账号
          </button>
        </div>
      </div>
    );
  }

  return (
    <WaitingRoom
      student={student}
      error={error}
      onLogout={() => navigate("/student", { replace: true })}
      onRetry={() => setError("")}
    />
  );
}
