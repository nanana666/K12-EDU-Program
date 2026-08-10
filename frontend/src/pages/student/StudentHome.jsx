import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import http from "@/api/http";
import { useAuth } from "@/store/auth";
import QuizList from "./components/QuizList";
import QuizPlayer from "./components/QuizPlayer";
import WaitingRoom from "./components/WaitingRoom";

/**
 * 学生端主页：活动列表（自行选择）→ 沉浸式答题 → 提交完成。
 */
export default function StudentHome() {
  const { student, logoutStudent } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("list"); // list | waiting | playing | done
  const [activeQuiz, setActiveQuiz] = useState(null);

  if (!student) {
    return <Navigate to="/student" replace />;
  }

  const handleSelectQuiz = async (sessionId) => {
    try {
      const data = await http.get(`/quiz-sessions/${sessionId}`);
      if (data.submitted) {
        // 后端判定已提交过，直接回到列表
        setPhase("list");
        return;
      }
      setActiveQuiz(data);
      setPhase("playing");
    } catch {
      // 活动可能已被教师结束，回到列表刷新即可
      setPhase("list");
    }
  };

  const handleSubmitted = () => {
    setPhase("done");
  };

  const handleBackToList = () => {
    setActiveQuiz(null);
    setPhase("list");
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
            onClick={handleBackToList}
            className="rounded-xl bg-emerald-600 px-8 py-3 font-medium text-white transition hover:bg-emerald-700"
          >
            返回活动列表
          </button>
          <button
            onClick={() => {
              logoutStudent();
              navigate("/student", { replace: true });
            }}
            className="rounded-xl border border-slate-300 px-8 py-3 font-medium text-slate-600 transition hover:bg-slate-50"
          >
            切换账号
          </button>
        </div>
      </div>
    );
  }

  return (
    phase === "waiting" ? (
      <WaitingRoom
        student={student}
        onNewQuiz={() => setPhase("list")}
        onBack={() => setPhase("list")}
        onLogout={() => {
          logoutStudent();
          navigate("/student", { replace: true });
        }}
      />
    ) : (
      <QuizList
        student={student}
        onSelect={handleSelectQuiz}
        onWait={() => setPhase("waiting")}
        onLogout={() => {
          logoutStudent();
          navigate("/student", { replace: true });
        }}
      />
    )
  );
}
