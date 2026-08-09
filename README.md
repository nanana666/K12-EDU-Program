# K12-EDU-Program

用于"小学语文教育"的桌面端软件，基于 Electron 封装、前后端分离架构。

## 技术栈

- **外壳**：Electron
- **前端**：React 18 + Vite + TailwindCSS + React Router + Zustand
- **后端/局域网服务端**：FastAPI + SQLAlchemy 2.x（由教师端启动，局域网内供学生端连接）
- **数据库**：SQLite

## 目录结构

```text
backend/    FastAPI 后端（路由/Service/模型分层）
frontend/   Electron + React 前端（教师端 + 学生端）
```

## 本地开发

### 后端

```bash
cd backend
python -m venv venv            # 首次
venv\Scripts\pip install -r requirements.txt   # 首次
venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 前端

```bash
cd frontend
npm install                    # 首次
npm run dev                    # 启动 Vite + Electron
```

## 开发分支

所有开发在 `dev` 分支进行，与 `main` 分支区分。
