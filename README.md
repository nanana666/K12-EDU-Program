# K12-EDU-Program

用于"小学语文教育"的桌面端软件，基于 Electron 封装、前后端分离架构。教师端作为局域网 Host 启动后端服务，学生端在局域网内连接并参与答题。

## 已实现功能

### 双端入口
- 打开前端后先进入**入口选择页**，由用户自行选择进入"教师端"或"学生端"。
- **教师端**：账号登录（无密码，账号需提前录入数据库）。
- **学生端**：输入教师端地址 + 学号登录；学号不存在时自动注册，已存在则直接登录。每次进入学生端都需重新输入学号与姓名，教师端地址会缓存为默认值且可修改。

### 题库管理（教师端）
- 添加题目：题干 + 2~8 个选项，可勾选多个正确答案（支持**多选题**）。
- JSON 批量导入：粘贴 JSON 数组一次导入多道题。
- 删除题目；题目列表展示选项与正确答案标记。

### 出题与分发
- 教师可将任意数量题目打包为**答题活动（题集）**并发布。
- 学生端登录后展示**所有进行中的活动列表**，可自行选择任意活动答题，也可以选择"等待老师出题"等待新活动。
- 已提交过的活动由**后端数据库判定**（`answer_records` 表），前端按后端返回的 `submitted` 字段标记"已完成"，同一学生不能重复作答（重复提交返回 409）。

### 学生端沉浸式答题
- 极简沉浸式界面（参考"扇贝单词 / 百词斩"风格）：大字题干、大按钮选项、顶部进度条。
- 自动识别单选/多选：正确答案数量 > 1 时显示"多选题"标签并允许勾选多项。
- **多选判分规则**：所选选项集合与全部正确答案集合完全一致才判对，少选/多选/选错均判错。
- 答完自动提交（JSON 格式），学生端不暴露正确答案。

### 教师端统计看板
- 宏观数据：参与回答总人数。
- 题目维度：每题正确/错误人数，及答对/答错学生名单（含题干）。
- 学生维度：每名学生答对/答错题数及对应题号。
- 看板每 3 秒自动刷新；教师可随时"结束活动"停止接收答案。

### 工程规范
- 统一 JSON 响应格式：`{ "code": 0, "message": "ok", "data": ... }`，错误码非 0。
- 统一异常处理（业务异常、参数校验、兜底 500），均不泄露内部堆栈。
- 后端分层：路由 / Schema / Service / Model / DB 分离。
- 所有 JSON 响应强制 `charset=utf-8`，中文与拼音音调（ā á ǎ à）可正常显示。

## 技术栈

| 层 | 技术 |
|---|---|
| 外壳 | Electron 31 |
| 前端 | React 18 + Vite 5 + TailwindCSS 3 + React Router + Zustand + Axios |
| 后端 | Python + FastAPI + Uvicorn |
| 数据库 | SQLite + SQLAlchemy 2.x |
| 通信 | REST API（JSON），学生端轮询获取活动 |

## 项目结构

```text
K12-EDU-Program/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口（CORS、UTF-8、异常处理）
│   │   ├── api/                # 路由层（auth / questions / quiz_sessions）
│   │   ├── core/               # 配置、统一响应、异常
│   │   ├── db/                 # 数据库会话、建表、种子数据、迁移
│   │   ├── models/             # SQLAlchemy 模型（教师/学生/题目/选项/活动/答案）
│   │   ├── schemas/            # Pydantic 请求/响应模型
│   │   └── services/           # 业务逻辑层
│   ├── data/                   # SQLite 数据库文件（自动生成，已 gitignore）
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # Electron + React 前端
│   ├── electron/               # Electron 主进程与预加载脚本
│   ├── src/
│   │   ├── pages/              # 入口选择 / 教师端 / 学生端页面
│   │   ├── store/              # Zustand 状态（登录态、服务器地址）
│   │   └── api/                # 统一 HTTP 客户端
│   ├── package.json
│   └── .env.example
├── docs/
│   └── questions-20-chinese.json  # 20 道语文常识题示例（可批量导入）
└── project-plan-v1.md
```

## 从零开始本地部署

### 环境要求

- **Git**（克隆仓库）
- **Python 3.11+**（本项目在 Python 3.14.6 下开发）
- **Node.js 18+**（含 npm；本项目在 npm 11 下开发）

以下教程以 Windows 为例，macOS/Linux 将 `venv\Scripts\python` 替换为 `venv/bin/python` 即可。

### 第一步：克隆仓库并切换分支

```bash
git clone <仓库地址> K12-EDU-Program
cd K12-EDU-Program
git checkout dev          # 所有开发在 dev 分支
```

### 第二步：部署后端

```bash
cd backend

# 1. 创建 Python 虚拟环境（首次）
python -m venv venv

# 2. 安装依赖（首次）
venv\Scripts\python -m pip install -r requirements.txt

# 3. 启动后端服务
venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

启动说明：

- 首次启动会自动创建数据库文件 `backend/data/k12_edu.db`、建表，并**预置教师账号**：`admin`（管理员）、`teacher1`（王老师）、`teacher2`（李老师）。
- `--host 0.0.0.0` 表示监听所有网卡，学生端才能通过局域网 IP 访问；仅本机测试可改用 `127.0.0.1`。
- 需要自定义端口等配置时，复制 `backend/.env.example` 为 `backend/.env` 后修改（支持 `K12_HOST`、`K12_PORT`）。
- 验证服务已启动：浏览器访问 `http://127.0.0.1:8000/health`，应返回 `{"code": 0, ...}`；接口文档见 `http://127.0.0.1:8000/docs`。

### 第三步：部署前端

```bash
cd frontend

# 1. 安装依赖（首次，Electron 二进制较大，耗时较长）
npm install

# 2. 启动开发模式（Vite + Electron 一起启动）
npm run dev
```

启动说明：

- 开发模式会先启动 Vite 开发服务器（端口 5173），再打开 Electron 窗口加载页面。
- 也可以分开启动：`npm run dev:vite`（浏览器访问 `http://127.0.0.1:5173`）与 `npm run dev:electron`（Electron 窗口）。
- 若 `npm install` 提示 Electron / esbuild 的安装脚本被阻止，请执行：
  ```bash
  npm approve-scripts electron esbuild
  npm rebuild electron esbuild
  ```
- 生产模式构建：`npm run build` 生成 `frontend/dist`，然后 `npm start` 以 Electron 加载构建产物。

### 第四步：局域网使用（教师端 + 学生端）

1. **教师端主机**：启动后端（绑定 `0.0.0.0:8000`），启动前端，进入"教师端"。
2. **学生端设备**（可以是另一台电脑/平板，也可以是同一台）：启动前端（开发模式或生产模式），进入"学生端"，在"教师端地址"输入框填写教师端主机的局域网 IP + 端口，例如 `http://192.168.1.100:8000`。
3. 若学生端无法连接，检查：
   - 教师端主机的防火墙是否放行 TCP 8000 端口；
   - 两台设备是否在同一局域网；
   - 地址是否正确（不要写 `127.0.0.1`，除非同机测试）。

## 使用教程

### 教师端

1. **登录**：打开前端 → 点击"教师端"卡片 → 输入账号（如 `teacher1`）→ 进入。
2. **添加题目**：进入"题库与出题"页，右侧填写题干与选项，勾选正确答案（可多选，即多选题）→ "保存题目"。
3. **批量导入**：在"批量导入（JSON）"框粘贴题目数组后点"导入题目"。格式示例：

   ```json
   [
     {
       "text": "《静夜思》的作者是谁？",
       "options": [
         { "text": "李白", "is_correct": true },
         { "text": "杜甫", "is_correct": false },
         { "text": "白居易", "is_correct": false },
         { "text": "王维", "is_correct": false }
       ]
     }
   ]
   ```

   仓库自带 20 道语文常识题示例文件 [docs/questions-20-chinese.json](docs/questions-20-chinese.json)，可直接复制其内容导入。

4. **发起答题**：在左侧勾选要打包的题目 → 输入活动标题（如"第一单元随堂练习"）→ "发布答题"。学生端刷新后即可看到该活动。
5. **查看统计**：切到"统计看板"页 → 点击活动 → 查看参与人数、题目维度（每题对错人数与名单）、学生维度（每人答对/答错题号）。看板每 3 秒自动刷新；答题结束后点"结束活动"，学生端将无法再提交。

### 学生端

1. **登录**：打开前端 → 点击"学生端"卡片 → 填写"教师端地址"（默认带出上次缓存的地址，可修改）→ 输入学号（必填，不存在则自动注册）→ 姓名（可选，不填自动生成昵称）→ 进入。
2. **选择活动**：登录后进入活动列表，可以看到所有**进行中的答题活动**；选择任意一个点"开始答题"；也可以点"等待老师出题"继续等待新活动（发布新活动后会自动跳回列表）。
3. **答题**：进入答题后逐题作答——单选题点选一个选项，多选题会显示"多选题"标签、可勾选多个；选好后点"下一题"，最后一题点"提交答案"。
4. **提交完成**：提交成功后显示"答题完成"，可"返回活动列表"（该活动显示为"✓ 已完成"且不可再次作答）或"切换账号"（重新输入学号/姓名登录）。

### 完整示例流程

1. 教师端主机启动后端与前端；学生端（同机或另一台设备）打开前端。
2. 教师用账号 `teacher1` 登录 → 在"题库与出题"页添加 2 道题（可勾选其中一道为多选题）→ 勾选这两道题 → 输入标题"第一单元随堂练习" → 发布。
3. 学生输入教师端地址、学号 `20260001`、姓名"小明" → 登录 → 活动列表出现"第一单元随堂练习" → 开始答题并提交。
4. 另一名学生用学号 `20260002`（姓名"小红"）登录 → 同一活动对其显示可作答；已提交的小明再次打开列表时该项目显示"已完成"。
5. 教师切到"统计看板"，选择该活动，即可看到 2 名参与者、每题对错人数与名单、每名学生的对错题号。
6. 教师点"结束活动"，活动状态变为已结束，学生端列表中不再出现。

## API 接口速览

统一前缀 `/api/v1`，响应格式 `{ "code": 0, "message": "...", "data": ... }`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/teacher/login` | 教师登录（仅账号） |
| POST | `/auth/student/login` | 学生登录（学号不存在自动注册） |
| POST | `/questions` | 新增题目（含选项） |
| GET | `/questions` | 题目列表 |
| DELETE | `/questions/{id}` | 删除题目 |
| POST | `/quiz-sessions` | 创建并发布答题活动 |
| GET | `/quiz-sessions` | 活动列表（教师端） |
| GET | `/quiz-sessions/active-list?student_id=` | 进行中活动列表（学生端，含 submitted 状态） |
| GET | `/quiz-sessions/{id}?student_id=` | 活动详情（学生视角，不含正确答案） |
| POST | `/quiz-sessions/{id}/submit` | 提交答案（同一学生仅一次） |
| POST | `/quiz-sessions/{id}/finish` | 结束活动 |
| GET | `/quiz-sessions/{id}/stats` | 统计看板数据 |

## 常见问题

- **学生端显示乱码？** 本项目所有 JSON 响应已强制 UTF-8，源文件亦为 UTF-8；请勿使用会以 GBK/ASCII 编码中文的工具或终端写入数据。
- **学生端连不上教师端？** 检查地址是否为教师端局域网 IP（非 127.0.0.1）、两端是否同一网络、防火墙是否放行 8000 端口。
- **端口被占用？** 后端改端口：`backend/.env` 中设置 `K12_PORT=其他端口`，或用 `--port` 参数；前端开发端口 5173 冲突时修改 `frontend/vite.config.js` 的 `server.port`（需同时更新 `package.json` 中 wait-on 的地址）。
- **想清空数据重来？** 停止后端，删除 `backend/data/k12_edu.db`，重新启动会自动建库并预置教师账号（学生与题目数据会被清空）。
- **npm install 后 Electron 无法启动？** 执行 `npm approve-scripts electron esbuild` 与 `npm rebuild electron esbuild`。

## 开发分支

所有开发在 `dev` 分支进行，`main` 分支保留稳定版本。
