import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import http from "@/api/http";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";

/**
 * 学生端入口：输入服务器地址与学号登录（学号不存在自动注册）。
 */
export default function StudentEntry() {
  const { student, loginStudent } = useAuth();
  const { serverBase, setServerBase } = useSettings();
  const navigate = useNavigate();

  const [server, setServer] = useState(serverBase);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (student) {
    return <Navigate to="/student/home" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!server.trim()) {
      setError("请输入教师端地址");
      return;
    }
    if (!studentId.trim()) {
      setError("请输入学号");
      return;
    }
    setLoading(true);
    setError("");
    setServerBase(server.trim().replace(/\/+$/, ""));
    try {
      const data = await http.post("/auth/student/login", {
        student_id: studentId.trim(),
        name: name.trim(),
      });
      loginStudent(data);
      navigate("/student/home", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-center text-3xl font-bold text-emerald-600">学生端</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          输入学号即可开始，首次登录会自动创建账号
        </p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">教师端地址</span>
            <input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="http://192.168.1.100:8000"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">学号</span>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="请输入学号"
              className="rounded-lg border border-slate-300 px-4 py-3 text-lg outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">
              姓名（可选）
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="不填则自动生成昵称"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "登录中…" : "进入答题"}
          </button>
        </form>
      </div>
    </div>
  );
}
