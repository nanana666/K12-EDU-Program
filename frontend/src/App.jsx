import { Navigate, Route, Routes } from "react-router-dom";

import EntrySelect from "@/pages/EntrySelect";
import StudentEntry from "@/pages/student/StudentEntry";
import StudentHome from "@/pages/student/StudentHome";
import TeacherEntry from "@/pages/teacher/TeacherEntry";
import TeacherHome from "@/pages/teacher/TeacherHome";

/**
 * 应用入口路由：
 * - /teacher  教师端（局域网 Host）
 * - /student  学生端（客户端）
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EntrySelect />} />
      <Route path="/teacher" element={<TeacherEntry />} />
      <Route path="/teacher/home" element={<TeacherHome />} />
      <Route path="/student" element={<StudentEntry />} />
      <Route path="/student/home" element={<StudentHome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
