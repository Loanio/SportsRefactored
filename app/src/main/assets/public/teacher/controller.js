import { TeacherManageRepository } from "./repository.js";
import { TeacherManageService } from "./service.js";

const session = readJson("restored.auth.session") || {};
const debugParams = readJson("restored.api.debug.params")?.["teacher-manage.html"] || {};
const user = {
  id: debugParams.userId || session.id || "tea-001",
  name: session.name || "李老师",
  type: session.type || "教师"
};

const repository = new TeacherManageRepository();
const service = new TeacherManageService(repository, user);

const state = {
  home: null,
  selectedClass: null,
  classData: null,
  panel: "home",
  tab: "students"
};

const moduleIcon = {
  SKKQ: "tc-sign.svg",
  XSLB: "ProfileS.svg",
  DLSJ: "Sport.svg",
  SHGL: "Watch.svg",
  SHJB: "Watch.svg",
  SKXL: "healthreport.svg",
  SJFX: "Pie.svg",
  JSP: "Stopwatch.svg",
  TCCJ: "ScoreAudit.svg",
  CJBZ: "Edit.svg"
};

const $ = selector => document.querySelector(selector);
const $all = selector => [...document.querySelectorAll(selector)];

init();

async function init() {
  bindEvents();
  await refresh();
}

function bindEvents() {
  $("#backHome").addEventListener("click", () => {
    if (state.panel === "class") {
      switchPanel("home");
      return;
    }
    location.href = "./index.html";
  });
  $("#moreBtn").addEventListener("click", () => showJsonModal("接口数据", state.classData || state.home));
  $("#refreshBtn").addEventListener("click", refresh);
  $("#courseListBtn").addEventListener("click", () => showJsonModal("课程列表接口", state.home?.classes || []));
  $("#termSelect").addEventListener("change", changeTerm);
  $all(".teacher-tabs button").forEach(btn => btn.addEventListener("click", () => {
    state.tab = btn.dataset.tab;
    renderClass();
  }));
}

async function refresh() {
  try {
    state.home = await service.loadHome();
    $("#teacherName").textContent = `${user.name} · 教师端`;
    renderHome();
    switchPanel(state.panel);
  } catch (error) {
    toast(error.message);
  }
}

async function changeTerm(event) {
  try {
    state.home.currentTerm = state.home.terms.find(item => item.id === event.target.value);
    state.home.classes = await service.changeTerm(event.target.value);
    renderHome();
  } catch (error) {
    toast(error.message);
  }
}

function renderHome() {
  $("#termSelect").innerHTML = state.home.terms.map(term => `
    <option value="${term.id}" ${term.id === state.home.currentTerm?.id ? "selected" : ""}>${term.name}</option>
  `).join("");
  $("#classCount").textContent = `${state.home.classes.length} 个`;
  $("#classList").innerHTML = state.home.classes.length ? state.home.classes.map(item => `
    <button class="class-card" data-id="${item.classId || item.id}">
      <span>
        <strong>${item.name || item.courseName || "未命名课程"}</strong>
        <span>${item.week || ""}${item.jc || ""}</span>
        <small>${item.address || "未设置地点"} · ${item.studentCount || 0}人</small>
      </span>
      <b>进入</b>
    </button>
  `).join("") : `<div class="empty-box">该学期暂无课程</div>`;

  $all(".class-card").forEach(card => card.addEventListener("click", () => openClass(card.dataset.id)));
}

async function openClass(classId) {
  try {
    state.selectedClass = classId;
    state.classData = await service.loadClassDashboard(classId);
    state.tab = "students";
    renderClass();
    switchPanel("class");
  } catch (error) {
    toast(error.message);
  }
}

function renderClass() {
  const course = state.classData.course;
  $("#classHead").innerHTML = `
    <h2>${course.name || course.courseName || "教学班"}</h2>
    <p>${course.week || ""}${course.jc || ""} · ${course.address || "未设置地点"} · ${course.studentCount || state.classData.students.length}人</p>
  `;

  const modules = state.home.modules.slice(0, 8);
  $("#classModules").innerHTML = modules.map(item => `
    <button data-code="${item.code}">
      <img src="./static/img/index/${moduleIcon[item.code] || "Folder.svg"}" alt="">
      <span>${item.name}</span>
    </button>
  `).join("");
  $("#classModules").querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => showModule(btn.dataset.code));
  });

  $("#classSummary").innerHTML = `
    ${summaryCard("已签到", state.classData.sign.signInNumber ?? "--")}
    ${summaryCard("总人数", state.classData.sign.activityNumber ?? state.classData.students.length)}
    ${summaryCard("平均分", state.classData.gradeAnalysis.avgScore ?? "--")}
    ${summaryCard("锻炼完成率", percentText(state.classData.exerciseAnalysis.finishRate))}
  `;

  $all(".teacher-tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === state.tab));
  $("#tabBody").innerHTML = renderTab();
}

function renderTab() {
  if (state.tab === "students") {
    return state.classData.students.length ? state.classData.students.map(item => `
      <article class="list-row">
        <span><strong>${item.name}</strong><span>${item.jobNum || item.loginId || ""}</span></span>
        <b class="tag">${item.signInStatus || "未考勤"}</b>
      </article>
    `).join("") : empty("暂无学生");
  }
  if (state.tab === "attendance") {
    return state.classData.history.length ? state.classData.history.map(item => `
      <article class="list-row">
        <span><strong>${item.date || item.name || "考勤记录"}</strong><span>已签到 ${item.signInNumber ?? "--"} · 缺勤 ${item.absentNumber ?? "--"}</span></span>
        <b class="tag">${item.status || "记录"}</b>
      </article>
    `).join("") : empty("暂无考勤记录");
  }
  if (state.tab === "grades") {
    return state.classData.grades.length ? state.classData.grades.map(item => `
      <article class="list-row">
        <span><strong>${item.name || item.studentName}</strong><span>${item.jobNum || ""} · 排名 ${item.rank ?? "--"}</span></span>
        <b class="tag">${item.score ?? item.grade ?? "--"}</b>
      </article>
    `).join("") : empty("暂无成绩");
  }
  return `<pre class="json-preview">${escapeHtml(JSON.stringify({
    gradeAnalysis: state.classData.gradeAnalysis,
    exerciseAnalysis: state.classData.exerciseAnalysis,
    projects: state.classData.projects
  }, null, 2))}</pre>`;
}

function showModule(code) {
  const routes = {
    SKKQ: "上课考勤",
    XSLB: "学生列表",
    DLSJ: "锻炼数据",
    SHGL: "手环管理",
    SKXL: "上课心率",
    SJFX: "数据分析",
    TCCJ: "体测成绩",
    CJBZ: "成绩备注"
  };
  showJsonModal(routes[code] || code, state.classData);
}

function summaryCard(label, value) {
  return `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function percentText(value) {
  if (value === undefined || value === null || value === "") return "--";
  return `${Math.round(Number(value) * 100)}%`;
}

function switchPanel(panel) {
  state.panel = panel;
  $all(".teacher-panel").forEach(item => item.classList.toggle("active", item.dataset.panel === panel));
}

function empty(text) {
  return `<div class="empty-box">${text}</div>`;
}

function showJsonModal(title, data) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = `<pre class="json-preview">${escapeHtml(JSON.stringify(data || {}, null, 2))}</pre>`;
  $("#modalActions").innerHTML = `<button id="modalClose">关闭</button>`;
  $("#modalClose").addEventListener("click", () => $("#modal").classList.add("hidden"));
  $("#modal").classList.remove("hidden");
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
