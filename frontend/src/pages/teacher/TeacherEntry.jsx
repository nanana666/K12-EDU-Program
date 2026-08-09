import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import http from "@/api/http";
import { useAuth } from "@/store/auth";

/**
 * 教师端入口：登录页（仅凭账号登录，账号需提前录入数据库）。
 */
export default function TeacherEntry() {
  const { teacher, loginTeacher } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (teacher) {
    return <Navigate to="/teacher/home" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("请输入教师账号");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await http.post("/auth/teacher/login", { username: username.trim() });
      loginTeacher(data);
      navigate("/teacher/home", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-center text-3xl font-bold text-brand-600">教师端</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          局域网 Host · 请使用已录入的教师账号登录
        </p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">教师账号</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如：teacher1"
              className="rounded-lg border border-slate-300 px-4 py-3 text-lg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 py-3 text-lg font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "登录中…" : "进入教师端"}
          </button>
        </form>
      </div>
    </div>
  );
}
