# 后端服务（FastAPI）

由教师端设备启动，在局域网中暴露端口，供学生端连接。

## 目录结构

- `app/main.py`：应用入口
- `app/api/`：路由层
- `app/core/`：核心配置
- `app/models/`：数据模型（SQLAlchemy）
- `app/schemas/`：请求/响应模型（Pydantic）
- `app/services/`：业务逻辑层
- `app/db/`：数据库连接与初始化

