import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 登录状态：教师端与学生端分别保存。
 * 持久化到 localStorage，刷新页面后保持登录。
 */
export const useAuth = create(
  persist(
    (set) => ({
      teacher: null,
      student: null,
      loginTeacher: (teacher) => set({ teacher }),
      loginStudent: (student) => set({ student }),
      logoutTeacher: () => set({ teacher: null }),
      logoutStudent: () => set({ student: null }),
    }),
    { name: "k12-auth" },
  ),
);
