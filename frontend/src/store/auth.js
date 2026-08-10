import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 登录状态：教师端与学生端分别保存。
 * 仅教师端持久化到 localStorage；学生端只保存在内存中，
 * 每次进入学生端都需重新输入学号与姓名（不使用缓存登录态）。
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
    {
      name: "k12-auth",
      // 学生端登录态不持久化，避免"无法切换账号"
      partialize: (state) => ({ teacher: state.teacher }),
      // 即使旧缓存残留 student，也不允许恢复进内存
      merge: (persisted, current) => ({
        ...current,
        teacher: persisted?.teacher ?? null,
      }),
    },
  ),
);
