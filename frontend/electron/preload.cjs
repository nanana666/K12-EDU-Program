// 预加载脚本：未来通过 contextBridge 向渲染进程安全暴露能力
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("k12", {
  platform: process.platform,
  version: process.versions.electron,
});
