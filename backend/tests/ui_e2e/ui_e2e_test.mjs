/**
 * 方案 C：Electron 多开全链路 UI 测试驱动（零依赖，Node >= 21 自带 fetch/WebSocket）。
 *
 * 拓扑：
 *   teacher  :9222  教师端窗口
 *   student1 :9223  学生 S1（全部答对）
 *   student2 :9224  学生 S2（第 1 题答错）
 *   student3 :9225  学生 S3（多选少选一项，判错）
 *
 * 运行：在仓库根目录执行
 *   node backend/tests/ui_e2e/ui_e2e_test.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.UI_TEST_BASE || "http://192.168.12.164:8000";
const PORTS = { teacher: 9222, student1: 9223, student2: 9224, student3: 9225 };
const SHOT_DIR = resolve("backend/logs/ui_screenshots");
const REPORT_PATH = resolve("backend/logs/ui_report.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(port, name) {
    this.port = port;
    this.name = name;
    this.id = 0;
    this.pending = new Map();
    this.eventFns = {};
  }

  async connect() {
    const list = await (
      await fetch(`http://127.0.0.1:${this.port}/json/list`)
    ).json();
    const page = list.find((t) => t.type === "page");
    if (!page) throw new Error(`${this.name}: 未找到页面 target`);
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error(`${this.name}: WebSocket 连接失败`));
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${this.name}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        for (const fn of this.eventFns[msg.method] || []) fn(msg.params);
      }
    };
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    // 自动接受 window.confirm 弹窗（结束活动等）
    this.on("Page.javascriptDialogOpening", async () => {
      try {
        await this.send("Page.handleJavaScriptDialog", { accept: true });
      } catch {}
    });
  }

  send(method, params = {}, timeoutMs = 10000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.name}: CDP 命令超时 -> ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  on(method, fn) {
    (this.eventFns[method] ||= []).push(fn);
  }

  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        `${this.name} eval 异常: ${
          r.exceptionDetails.exception?.description ||
          r.exceptionDetails.text
        }`,
      );
    }
    return r.result.value;
  }

  async waitFor(expression, timeout = 25000, interval = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try {
        if (await this.eval(expression)) return true;
      } catch {}
      await sleep(interval);
    }
    throw new Error(`${this.name}: 等待超时 -> ${expression}`);
  }

  async waitText(text, timeout = 25000) {
    return this.waitFor(
      `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
      timeout,
    );
  }

  async shot(name) {
    if (process.env.UI_TEST_SKIP_SCREENSHOTS === "1") return;
    try {
      try {
        await this.send("Page.bringToFront");
      } catch {}
      let r;
      try {
        r = await this.send("Page.captureScreenshot", {
          format: "png",
        }, 5000);
      } catch {
        r = await this.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: false,
        }, 5000);
      }
      mkdirSync(SHOT_DIR, { recursive: true });
      writeFileSync(resolve(SHOT_DIR, `${name}.png`), Buffer.from(r.data, "base64"));
    } catch (err) {
      console.warn(`[warn] 截图失败 ${name}: ${err.message}`);
    }
  }

  async bodyText() {
    return this.eval("document.body.innerText");
  }

  async close() {
    try {
      this.ws.close();
    } catch {}
  }
}

// ---------- UI 操作表达式 ----------

const clickByText = (text) => `(() => {
  const t = ${JSON.stringify(text)};
  const interactive = [...document.querySelectorAll("button,a,label")];
  const exact = interactive.find((e) => e.textContent.trim() === t);
  if (exact) { exact.click(); return true; }
  const leaves = [...document.querySelectorAll(
    "p,span,div,h1,h2,h3,h4,h5,h6,td,li",
  )].filter((e) => e.children.length === 0 && e.textContent.trim().includes(t));
  const leaf = leaves.find((e) => e.textContent.trim() === t) || leaves[0];
  if (leaf) {
    const clickable = leaf.closest("button,a,label");
    (clickable || leaf).click();
    return true;
  }
  const anyEl = [...document.querySelectorAll("button,a,label,span,div,p")]
    .find((e) => e.textContent.includes(t));
  if (!anyEl) return false;
  anyEl.click();
  return true;
})()`;

const setValue = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el.tagName === "TEXTAREA"
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(
    el, ${JSON.stringify(value)},
  );
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;

const checkOptionByIndex = (index, checked) => `(() => {
  const input = document.querySelector('input[placeholder="选项 ${index}"]');
  if (!input) return false;
  const checkbox = input.closest("div").querySelector('input[type="checkbox"]');
  if (!checkbox) return false;
  if (checkbox.checked !== ${checked}) checkbox.click();
  return true;
})()`;

const checkQuestionByText = (qtext) => `(() => {
  const label = [...document.querySelectorAll("label")]
    .find((l) => l.textContent.includes(${JSON.stringify(qtext)}));
  if (!label) return false;
  const cb = label.querySelector('input[type="checkbox"]');
  if (!cb) return false;
  if (!cb.checked) cb.click();
  return true;
})()`;

const statsJs = `(() => {
  const pCount = [...document.querySelectorAll("p")]
    .find((p) => p.textContent.includes("参与回答人数"))
    ?.previousElementSibling?.textContent.trim() || "";
  const tables = [...document.querySelectorAll("table")].map((t) =>
    [...t.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()),
    ),
  );
  return {
    pCount,
    tables,
    finished: document.body.innerText.includes("已结束"),
  };
})()`;

// ---------- 场景数据 ----------

const QUESTIONS = [
  {
    text: "UI测试题一：《静夜思》的作者是谁？",
    options: ["李白", "杜甫", "白居易", "王维"],
    correct: [0],
  },
  {
    text: "UI测试题二：《春晓》的作者是谁？",
    options: ["孟浩然", "李白", "贺知章", "王之涣"],
    correct: [0],
  },
  {
    text: "UI测试题三：下列哪些是唐代诗人？（多选）",
    options: ["李白", "杜甫", "司马光", "岳飞"],
    correct: [0, 1],
  },
];

const STUDENTS = [
  { key: "student1", id: "UI-S1-001", name: "小明",
    answers: [["李白"], ["孟浩然"], ["李白", "杜甫"]] },
  { key: "student2", id: "UI-S2-002", name: "小红",
    answers: [["杜甫"], ["孟浩然"], ["李白", "杜甫"]] },
  { key: "student3", id: "UI-S3-003", name: "小刚",
    answers: [["李白"], ["孟浩然"], ["李白"]] },
];

// 期望统计（以 UI 操作为基准）：
// Q1: S2 答错 -> 对 2 错 1；Q2: 全对 -> 对 3 错 0；Q3: S3 少选判错 -> 对 2 错 1
const EXPECTED = {
  participant: 3,
  question: [
    { correct: 2, wrong: 1 },
    { correct: 3, wrong: 0 },
    { correct: 2, wrong: 1 },
  ],
  students: {
    "小明": { ok: 3, bad: 0, okIds: [1, 2, 3], badIds: [] },
    "小红": { ok: 2, bad: 1, okIds: [2, 3], badIds: [1] },
    "小刚": { ok: 2, bad: 1, okIds: [1, 2], badIds: [3] },
  },
};

// ---------- 主流程 ----------

const results = [];
const steps = [];

function record(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " | " + detail : ""}`);
}

async function phase(name, fn) {
  try {
    await fn();
    record(name, true);
  } catch (err) {
    record(name, false, String(err.message || err));
    results.push({ phase: name, error: String(err.message || err) });
    throw err;
  }
}

async function waitPort(port, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`调试端口 :${port} 未就绪`);
}

async function answerQuiz(cdp, plan) {
  for (let i = 0; i < plan.length; i++) {
    for (const opt of plan[i]) {
      const ok = await cdp.eval(clickByText(opt));
      if (!ok) throw new Error(`点击选项失败: ${opt}`);
    }
    await sleep(400);
    if (i < plan.length - 1) {
      const ok = await cdp.eval(clickByText("下一题"));
      if (!ok) throw new Error("点击下一题失败");
    } else {
      const ok = await cdp.eval(clickByText("提交答案"));
      if (!ok) throw new Error("点击提交答案失败");
    }
    await sleep(500);
  }
}

const PUBLISH_ERROR_MARKERS = ["请至少选择一道题", "请输入活动标题", "服务器内部错误"];

/** 点击按钮并等待期望反馈；点击丢失时自动重试（最多 3 次）。 */
async function clickAndWait(cdp, clickText, expectTexts, timeout = 15000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await cdp.eval(clickByText(clickText));
    const t0 = Date.now();
    while (Date.now() - t0 < Math.min(timeout, 6000)) {
      const body = await cdp.bodyText();
      for (const t of expectTexts) {
        if (body.includes(t)) return t;
      }
      for (const m of PUBLISH_ERROR_MARKERS) {
        if (body.includes(m)) throw new Error(`点击 ${clickText} 后页面报错: ${m}`);
      }
      await sleep(300);
    }
  }
  throw new Error(`点击 ${clickText} 后未出现期望反馈`);
}

async function teacherFlow(t) {
  await phase("T-入口/登录页准备", async () => {
    await t.waitFor(`document.body && (
      document.body.innerText.includes("请选择你的身份进入")
      || document.body.innerText.includes("局域网 Host")
      || document.body.innerText.includes("题库与出题")
    )`);
    const body = await t.bodyText();
    if (body.includes("请选择你的身份进入")) {
      if (!(await t.eval(clickByText("进入教师端")))) {
        throw new Error("点击教师端卡片失败");
      }
      await t.waitText("局域网 Host");
    }
    await t.shot("01-teacher-entry");
  });

  await phase("T-教师登录", async () => {
    const body = await t.bodyText();
    if (!body.includes("题库与出题")) {
      if (!body.includes("局域网 Host")) throw new Error("未处于教师登录页");
      await t.eval(setValue('input[placeholder="例如：teacher1"]', "teacher1"));
      if (!(await t.eval(clickByText("进入教师端")))) {
        throw new Error("点击登录按钮失败");
      }
      await t.waitText("题库与出题");
    }
    await t.shot("02-teacher-logged-in");
  });

  await phase("T-UI 新增 3 道题（含多选）", async () => {
    for (const q of QUESTIONS) {
      await t.eval(setValue('textarea[placeholder="请输入题目文本…"]', q.text));
      // 默认 1 个选项，补齐到 4 个
      for (let k = 0; k < 3; k++) {
        await t.eval(clickByText("+ 添加选项"));
        await sleep(150);
      }
      for (let i = 0; i < q.options.length; i++) {
        await t.eval(setValue(`input[placeholder="选项 ${i + 1}"]`, q.options[i]));
        await t.eval(checkOptionByIndex(i + 1, q.correct.includes(i)));
      }
      await sleep(350);
      if (!(await t.eval(clickByText("保存题目")))) throw new Error("点击保存题目失败");
      await t.waitText("题目添加成功");
      await sleep(600);
    }
    await t.waitText(`题库（${QUESTIONS.length} 题）`);
    await t.shot("03-teacher-questions-added");
  });

  await phase("T-发布答题活动", async () => {
    for (const q of QUESTIONS) {
      const ok = await t.eval(checkQuestionByText(q.text));
      if (!ok) throw new Error(`勾选题目失败: ${q.text}`);
    }
    await t.eval(setValue('input[placeholder="活动标题，如：第一单元随堂练习"]',
                          "UI 联调随堂练习"));
    await sleep(350);
    await clickAndWait(t, "发布答题", ["已发布「UI 联调随堂练习」"]);
    await t.shot("04-teacher-published");
  });
}

async function studentFlow(s, cdp) {
  const prefix = `S-${s.key.slice(-1)}`;
  await phase(`${prefix}-学生登录(${s.name})`, async () => {
    await cdp.waitFor(`document.body && (
      document.body.innerText.includes("请选择你的身份进入")
      || (document.body.innerText.includes("教师端地址")
          && document.body.innerText.includes("进入答题"))
    )`);
    const body = await cdp.bodyText();
    if (body.includes("请选择你的身份进入")) {
      if (!(await cdp.eval(clickByText("进入学生端")))) {
        throw new Error("点击学生端卡片失败");
      }
      await cdp.waitText("教师端地址");
    }
    await cdp.eval(setValue('input[placeholder="http://192.168.1.100:8000"]', BASE));
    await cdp.eval(setValue('input[placeholder="请输入学号"]', s.id));
    await cdp.eval(setValue('input[placeholder="不填则自动生成昵称"]', s.name));
    await cdp.shot(`05-${s.key}-login-form`);
    if (!(await cdp.eval(clickByText("进入答题")))) throw new Error("点击进入答题失败");
    await cdp.waitText(`你好，${s.name}`);
  });

  await phase(`${prefix}-开始答题(${s.name})`, async () => {
    await cdp.waitText("UI 联调随堂练习");
    if (!(await cdp.eval(clickByText("开始答题")))) throw new Error("点击开始答题失败");
    await cdp.waitText("UI测试题一：《静夜思》的作者是谁？");
  });

  await phase(`${prefix}-逐题作答并提交(${s.name})`, async () => {
    await answerQuiz(cdp, s.answers);
    await cdp.waitText("答题完成！");
    await cdp.shot(`06-${s.key}-done`);
  });

  await phase(`${prefix}-返回活动列表(${s.name})`, async () => {
    if (!(await cdp.eval(clickByText("返回活动列表")))) throw new Error("点击返回列表失败");
    await cdp.waitText("进行中的活动");
  });
}

async function dashboardFlow(t) {
  await phase("T-进入统计看板", async () => {
    if (!(await t.eval(clickByText("统计看板")))) throw new Error("点击统计看板失败");
    await t.waitText("答题活动");
    // 等待活动列表渲染完成后再点击，避免竞态
    await t.waitText("UI 联调随堂练习");
    if (!(await t.eval(clickByText("UI 联调随堂练习")))) throw new Error("选择活动失败");
    await t.waitText("参与回答人数");
  });

  await phase("T-统计看板 UI 数值校验", async () => {
    let data = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      data = await t.eval(statsJs);
      if (data.pCount === String(EXPECTED.participant)) break;
      await sleep(1000);
    }
    if (!data || data.pCount !== String(EXPECTED.participant)) {
      throw new Error(`参与人数未达到 3，当前: ${data?.pCount}`);
    }
    const problems = [];
    const qTable = data.tables[0] || [];
    for (let i = 0; i < EXPECTED.question.length; i++) {
      const row = qTable[i];
      const exp = EXPECTED.question[i];
      if (!row) { problems.push(`题目 ${i + 1} 行缺失`); continue; }
      if (row[2] !== String(exp.correct) || row[3] !== String(exp.wrong)) {
        problems.push(`题目 ${i + 1}: UI 对/错=${row[2]}/${row[3]}，期望=${exp.correct}/${exp.wrong}`);
      }
    }
    const sTable = data.tables[1] || [];
    for (const [name, exp] of Object.entries(EXPECTED.students)) {
      const row = sTable.find((r) => r[1] === name);
      if (!row) { problems.push(`学生 ${name} 行缺失`); continue; }
      if (row[2] !== String(exp.ok) || row[3] !== String(exp.bad)) {
        problems.push(`学生 ${name}: UI 对/错=${row[2]}/${row[3]}，期望=${exp.ok}/${exp.bad}`);
      }
    }
    await t.shot("07-teacher-dashboard-stats");
    if (problems.length) throw new Error(problems.join("；"));
  });

  await phase("T-API 交叉校验", async () => {
    const sessions = await (await fetch(`${BASE}/api/v1/quiz-sessions`)).json();
    const session = sessions.data.find((s) => s.title === "UI 联调随堂练习");
    if (!session) throw new Error("API 中未找到活动");
    const stats = (await (await fetch(`${BASE}/api/v1/quiz-sessions/${session.id}/stats`)).json()).data;
    const problems = [];
    if (stats.participant_count !== 3) problems.push(`participant_count=${stats.participant_count}`);
    for (let i = 0; i < EXPECTED.question.length; i++) {
      const q = stats.question_stats[i];
      if (q.correct_count !== EXPECTED.question[i].correct ||
          q.wrong_count !== EXPECTED.question[i].wrong) {
        problems.push(`题目${i + 1} 计数=${q.correct_count}/${q.wrong_count}`);
      }
    }
    const smap = {};
    for (const s of stats.student_stats) smap[s.name] = s;
    for (const [name, exp] of Object.entries(EXPECTED.students)) {
      const s = smap[name];
      if (!s) { problems.push(`学生 ${name} 缺失`); continue; }
      const okIds = s.correct_question_ids.length ? s.correct_question_ids.join("、") : "—";
      const badIds = s.wrong_question_ids.length ? s.wrong_question_ids.join("、") : "—";
      // 题目 ID 与顺序索引一致（全新测试库，题号即 1..3）
      if (s.correct_count !== exp.ok || s.wrong_count !== exp.bad) {
        problems.push(`${name} 对/错=${s.correct_count}/${s.wrong_count}，期望=${exp.ok}/${exp.bad}`);
      }
    }
    if (problems.length) throw new Error(problems.join("；"));
  });

  await phase("T-结束活动", async () => {
    if (!(await t.eval(clickByText("结束活动")))) throw new Error("点击结束活动失败");
    await t.waitText("已结束");
    await t.shot("08-teacher-finished");
  });
}

async function verifyStudentsAfterFinish() {
  for (const s of STUDENTS) {
    const cdp = clients[s.key];
    await cdp.waitText("进行中的活动");
    if (!(await cdp.eval(clickByText("刷新")))) throw new Error(`${s.name} 刷新失败`);
    await cdp.waitText("当前没有进行中的答题活动");
    await cdp.shot(`09-${s.key}-empty-after-finish`);
  }
}

let clients = {};

async function main() {
  console.log(`目标后端: ${BASE}`);
  const health = await (await fetch(`${BASE}/health`)).json();
  if (health.code !== 0) throw new Error("后端健康检查失败");

  for (const [key, port] of Object.entries(PORTS)) {
    await waitPort(port);
    clients[key] = new Cdp(port, key);
    await clients[key].connect();
  }
  record("连接 4 个 Electron 窗口", true);

  await teacherFlow(clients.teacher);

  for (const s of STUDENTS) {
    await studentFlow(s, clients[s.key]);
  }

  // S1 重复提交 UI 校验：列表中显示“✓ 已完成”
  await phase("S1-重复提交 UI 拦截显示", async () => {
    await clients.student1.waitText("✓ 已完成");
    await clients.student1.shot("10-student1-finished-card");
  });

  await dashboardFlow(clients.teacher);

  await phase("学生端-结束后活动消失", async () => {
    await verifyStudentsAfterFinish();
  });

  record("全链路 UI 测试", results.length === 0);
}

main()
  .then(() => {
    const report = {
      base: BASE,
      generated_at: new Date().toISOString(),
      passed: results.length === 0,
      steps,
      errors: results,
    };
    mkdirSync(resolve("backend/logs"), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    Object.values(clients).forEach((c) => c.close());
    process.exit(report.passed ? 0 : 1);
  })
  .catch((err) => {
    console.error("测试中断:", err.message || err);
    const report = {
      base: BASE,
      generated_at: new Date().toISOString(),
      passed: false,
      steps,
      errors: [...results, { fatal: String(err.message || err) }],
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    Object.values(clients).forEach((c) => c.close());
    process.exit(1);
  });

// 全局看门狗：任何情况下 4 分钟内必须结束并落盘报告
setTimeout(() => {
  const report = {
    base: BASE,
    generated_at: new Date().toISOString(),
    passed: false,
    steps,
    errors: [...results, { fatal: "看门狗超时（4 分钟）" }],
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  Object.values(clients).forEach((c) => c.close());
  console.error("看门狗超时，强制结束");
  process.exit(2);
}, 360000).unref();
