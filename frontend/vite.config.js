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
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
