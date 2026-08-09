import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 全局设置：教师端主机地址。
 * 学生端在不同机器上连接教师端时，需将地址改为教师端 IP。
 */
export const useSettings = create(
  persist(
    (set) => ({
      serverBase: "http://127.0.0.1:8000",
      setServerBase: (serverBase) => set({ serverBase }),
    }),
    { name: "k12-settings" },
  ),
);
