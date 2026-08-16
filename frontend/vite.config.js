import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Electron 渲染进程由 file:// 加载，需使用相对路径基准
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // 监听所有网卡：局域网内学生端浏览器才能访问本机 Vite 开发服务器
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
