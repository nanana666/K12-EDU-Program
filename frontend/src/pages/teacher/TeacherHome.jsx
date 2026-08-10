import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/store/auth";
import QuestionManager from "./components/QuestionManager";
import QuizDashboard from "./components/QuizDashboard";

/**
 * 教师端主页：题库管理 + 发起答题 + 统计看板。
 */
export default function TeacherHome() {
  const { teacher, logoutTeacher } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("bank");

  if (!teacher) {
    return <Navigate to="/teacher" replace />;
  }

  const handleLogout = () => {
    logoutTeacher();
    navigate("/teacher", { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-xl font-bold text-brand-600">K12 语文教育 · 教师端</h1>
          <p className="text-sm text-slate-500">
            {teacher.name}（{teacher.username}）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <nav className="mr-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setTab("bank")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === "bank"
                  ? "bg-white text-brand-600 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              题库与出题
            </button>
            <button
              onClick={() => setTab("dashboard")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === "dashboard"
                  ? "bg-white text-brand-600 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              统计看板
            </button>
          </nav>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            退出登录
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden bg-slate-50 p-6">
        {tab === "bank" ? <QuestionManager /> : <QuizDashboard />}
      </main>
    </div>
  );
}
