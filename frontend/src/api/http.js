import axios from "axios";

import { useSettings } from "@/store/settings";

/**
 * 统一 HTTP 客户端：
 * - 后端地址取自全局设置（教师端默认 127.0.0.1:8000；学生端可配置为教师端 IP）。
 * - 响应采用统一格式 { code, message, data }，业务错误统一抛出。
 */

const http = axios.create({
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const { serverBase } = useSettings.getState();
  config.baseURL = `${serverBase}/api/v1`;
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && body.code !== 0) {
      return Promise.reject(new Error(body.message || "请求失败"));
    }
    return body.data;
  },
  (error) => {
    const message =
      error.response?.data?.message || error.message || "网络连接失败";
    return Promise.reject(new Error(message));
  },
);

export default http;
