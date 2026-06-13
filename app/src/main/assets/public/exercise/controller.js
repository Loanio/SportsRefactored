import { ExerciseKind, SessionStatus, formatDateTime, formatTime, percent } from "./domain.js";
import { ExerciseRepository } from "./repository.js";
import { ExerciseService } from "./service.js";

const session = readJson("restored.auth.session") || {};
const debugParams = readJson("restored.api.debug.params")?.["exercise.html"] || {};
const user = {
  id: debugParams.userId || session.id || "u-20260001",
  jobNum: session.jobNum || "20260001",
  bindId: debugParams.bindId || session.bindId || "bind-001",
  clientId: debugParams.clientId || session.clientId || "mock-client"
};

const repository = new ExerciseRepository();
const service = new ExerciseService(repository, user);

const state = {
  dashboard: null,
  selectedEvent: null,
  selectedPlace: null,
  activeSession: null,
  panel: "dashboard",
  elapsedTimer: null
};

const $ = selector => document.querySelector(selector);
const $all = selector => [...document.querySelectorAll(selector)];

init();

async function init() {
  bindStaticEvents();
  await refresh();
}

function bindStaticEvents() {
  $("#backHome").addEventListener("click", () => location.href = "./index.html");
  $("#notUploadBtn").addEventListener("click", () => switchPanel("local"));
  $("#recordBtn").addEventListener("click", showRecordCenter);
  $("#historyBtn").addEventListener("click", showHistorySummary);
  $("#standardBtn").addEventListener("click", showStandard);
  $("#settingBtn").addEventListener("click", showRuntimeSetting);
  $("#cancelSession").addEventListener("click", stopActiveSession);
  $("#finishSession").addEventListener("click", finishActiveSession);
  $("#localBack").addEventListener("click", () => switchPanel("dashboard"));
}

async function showRecordCenter() {
  try {
    const result = await service.loadRecordCenter(readDebugParams());
    showJsonModal("锻炼记录接口", result);
  } catch (error) {
    showToast(error.message);
  }
}

async function showHistorySummary() {
  try {
    const result = await service.loadHistorySummary(readDebugParams());
    showJsonModal("历史汇总接口", result);
  } catch (error) {
    showToast(error.message);
  }
}

async function showStandard() {
  try {
    const result = await service.loadExerciseStandard(readDebugParams());
    showJsonModal("考核标准接口", result);
  } catch (error) {
    showToast(error.message);
  }
}

async function showRuntimeSetting() {
  try {
    const result = await service.loadVenueRuntime(readDebugParams());
    showJsonModal("场地/围栏接口", result);
  } catch (error) {
    showToast(error.message);
  }
}

async function refresh() {
  state.dashboard = await service.loadDashboard();
  renderDashboard();
  renderLocalRecords();
  switchPanel(state.panel);
}

function renderDashboard() {
  const { events, summary, targets, local } = state.dashboard;
  $("#runCount").textContent = summary.number;
  $("#runDistance").textContent = `${summary.effectiveDistance}km`;
  $("#localCount").textContent = local.run.length + local.other.length;
  $("#notUploadBtn").classList.toggle("danger", local.hasUnuploaded);

  $("#eventList").innerHTML = events.map((event, index) => `
    <button class="sport-card" data-id="${event.id}" style="--sport-color:${event.color}">
      <span class="sport-glow"></span>
      <img src="${event.icon}" alt="">
      <strong>${event.name}</strong>
      <small>${event.run ? "GPS跑步" : "计时运动"}</small>
    </button>
  `).join("");

  $all(".sport-card").forEach(button => {
    button.addEventListener("click", () => chooseEvent(button.dataset.id));
  });

  $("#targetList").innerHTML = targets.map(target => {
    const disPercent = percent(target.effectiveDistance, target.targetDistance);
    const numPercent = percent(target.number, target.targetNumber);
    return `
      <article class="target-card">
        <div class="target-head">
          <strong>${target.info.eventName}</strong>
          <span>违规 ${target.vioNum}</span>
        </div>
        ${target.targetDis ? progressRow("目标里程", target.effectiveDistanceString, target.targetDistanceString, disPercent) : ""}
        ${target.targetNum ? progressRow("目标次数", target.numberString, target.targetNumberString, numPercent) : ""}
      </article>
    `;
  }).join("");

  $("#tipsList").innerHTML = summary.stringList.map(tip => `<li>${tip}</li>`).join("");
}

function progressRow(label, current, target, value) {
  return `
    <div class="progress-row">
      <div><span>${label}</span><b>${current} / ${target}</b></div>
      <div class="progress"><i style="width:${value}%"></i></div>
    </div>
  `;
}

async function chooseEvent(eventId) {
  const event = state.dashboard.events.find(item => item.id === eventId);
  if (!event) return;
  const result = await service.chooseEvent(event);
  state.selectedEvent = event;
  showPlacePicker(result.event, result.places);
}

function showPlacePicker(event, places) {
  showModal("选择锻炼场地", `
    <p>${event.run ? "跑步项目将进入地图运动页。" : "非跑步项目将进入计时运动页。"}</p>
    <div class="place-list">
      ${places.map((place, index) => `
        <button class="place-option ${index === 0 ? "active" : ""}" data-id="${place.id}">
          <strong>${place.name}</strong>
          <span>${place.venueId}</span>
        </button>
      `).join("")}
    </div>
  `, [
    ["重选", "secondary", closeModal],
    ["确定", "", async () => {
      const active = $(".place-option.active") || $(".place-option");
      const place = places.find(item => item.id === active.dataset.id);
      state.selectedPlace = place;
      closeModal();
      await showInstructionThenStart(event, place);
    }]
  ]);

  $all(".place-option").forEach(button => {
    button.addEventListener("click", () => {
      $all(".place-option").forEach(row => row.classList.remove("active"));
      button.classList.add("active");
    });
  });
}

async function showInstructionThenStart(event, place) {
  const { instructions } = state.dashboard;
  if (!instructions.open) {
    await startSession(event, place);
    return;
  }

  let countdown = 5;
  showModal("锻炼须知", `
    <p>${instructions.article}</p>
    <p class="countdown">请阅读 <b id="readCount">${countdown}</b> 秒后开始</p>
  `, [
    ["取消", "secondary", closeModal],
    ["开始锻炼", "disabled", () => {}]
  ]);

  const action = $("#modalActions button:last-child");
  const timer = setInterval(async () => {
    countdown -= 1;
    const el = $("#readCount");
    if (el) el.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(timer);
      action.classList.remove("disabled");
      action.onclick = async () => {
        closeModal();
        await startSession(event, place);
      };
    }
  }, 1000);
}

async function startSession(event, place) {
  state.activeSession = await service.startSession(event, place);
  state.panel = "session";
  switchPanel("session");
  startElapsedTimer();
  showToast(event.kind === ExerciseKind.RUN ? "已进入跑步记录模拟" : "已进入计时运动模拟");
}

function startElapsedTimer() {
  clearInterval(state.elapsedTimer);
  state.elapsedTimer = setInterval(renderSession, 1000);
  renderSession();
}

function renderSession() {
  if (!state.activeSession) return;
  const seconds = Math.floor((Date.now() - new Date(state.activeSession.startTime)) / 1000);
  $("#sessionIcon").src = state.selectedEvent.icon;
  $("#sessionTitle").textContent = state.activeSession.eventName;
  $("#sessionPlace").textContent = state.activeSession.placeName;
  $("#sessionTime").textContent = formatTime(seconds);
  $("#sessionMode").textContent = state.activeSession.kind === ExerciseKind.RUN ? "GPS跑步模式" : "计时运动模式";
  $("#sessionHint").textContent = state.activeSession.kind === ExerciseKind.RUN
    ? "原 APP 此处会打开地图，持续采集轨迹、配速、心率。"
    : "原 APP 此处会保持计时，记录有效时长、心率和场地信息。";
}

async function finishActiveSession() {
  if (!state.activeSession) return;
  const seconds = Math.max(60, Math.floor((Date.now() - new Date(state.activeSession.startTime)) / 1000));
  const metrics = state.activeSession.kind === ExerciseKind.RUN
    ? {
        time: seconds,
        distance: Number((Math.max(0.2, seconds / 900)).toFixed(2)),
        points: [[121.47, 31.23], [121.471, 31.231]],
        heartRate: [92, 106, 118, 124]
      }
    : {
        time: seconds,
        validTime: seconds - 12,
        timePool: [{ start: state.activeSession.startTime, end: new Date().toISOString() }],
        heartRate: [88, 96, 104]
      };

  const finished = await service.finishCurrentSession(state.activeSession, metrics);
  state.activeSession = null;
  clearInterval(state.elapsedTimer);
  await refresh();
  switchPanel("local");
  showToast(`${finished.eventName}已保存到本地待上传`);
}

async function stopActiveSession() {
  if (!state.activeSession) return;
  await service.deleteSession(state.activeSession);
  state.activeSession = null;
  clearInterval(state.elapsedTimer);
  await refresh();
  switchPanel("dashboard");
}

function renderLocalRecords() {
  const local = state.dashboard.local;
  $("#runLocalList").innerHTML = local.run.length ? local.run.map(recordTemplate).join("") : empty("暂无跑步数据");
  $("#otherLocalList").innerHTML = local.other.length ? local.other.map(recordTemplate).join("") : empty("暂无其他数据");

  $all("[data-action='upload']").forEach(btn => {
    btn.addEventListener("click", () => uploadRecord(btn.dataset.kind, btn.dataset.id));
  });
  $all("[data-action='continue']").forEach(btn => {
    btn.addEventListener("click", () => continueRecord(btn.dataset.kind, btn.dataset.id));
  });
  $all("[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", () => deleteRecord(btn.dataset.kind, btn.dataset.id));
  });
}

function recordTemplate(record) {
  const canContinue = record.status !== SessionStatus.EXPIRED;
  const metric = record.kind === ExerciseKind.RUN
    ? `${record.runInfo?.distance || 0}km · ${formatTime(record.runInfo?.time || 0)}`
    : `${formatTime(record.otherInfo?.time || 0)} · ${record.placeName}`;
  return `
    <article class="local-record">
      <div>
        <strong>${record.eventName}</strong>
        <p>${metric}</p>
        <small>${formatDateTime(record.startTime)}</small>
      </div>
      <div class="record-actions">
        <button data-action="upload" data-kind="${record.kind}" data-id="${record.id}">上传</button>
        ${canContinue ? `<button data-action="continue" data-kind="${record.kind}" data-id="${record.id}">继续</button>` : ""}
        <button class="ghost" data-action="delete" data-kind="${record.kind}" data-id="${record.id}">删除</button>
      </div>
    </article>
  `;
}

async function uploadRecord(kind, id) {
  const records = kind === ExerciseKind.RUN ? state.dashboard.local.run : state.dashboard.local.other;
  const record = records.find(row => row.id === id);
  if (!record) return;
  try {
    await service.uploadSession(record);
    await refresh();
    showToast("上传成功");
  } catch (error) {
    showToast(error.message);
  }
}

async function continueRecord(kind, id) {
  const records = kind === ExerciseKind.RUN ? state.dashboard.local.run : state.dashboard.local.other;
  const record = records.find(row => row.id === id);
  const continued = await service.continueSession(record);
  if (continued.status === SessionStatus.EXPIRED) {
    showToast("超过30分钟，不能继续");
    await refresh();
    return;
  }
  state.activeSession = continued;
  state.selectedEvent = state.dashboard.events.find(event => event.id === continued.eventId) || {
    icon: "./static/img/ball/run.png"
  };
  switchPanel("session");
  startElapsedTimer();
}

async function deleteRecord(kind, id) {
  const records = kind === ExerciseKind.RUN ? state.dashboard.local.run : state.dashboard.local.other;
  const record = records.find(row => row.id === id);
  if (!record) return;
  await service.deleteSession(record);
  await refresh();
  showToast("已删除本地记录");
}

function switchPanel(panel) {
  state.panel = panel;
  $all(".exercise-panel").forEach(el => el.classList.toggle("active", el.dataset.panel === panel));
}

function empty(text) {
  return `<div class="empty-box">${text}</div>`;
}

function showModal(title, body, actions) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  $("#modalActions").innerHTML = "";
  actions.forEach(([text, cls, handler]) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (cls) btn.className = cls;
    btn.addEventListener("click", handler);
    $("#modalActions").appendChild(btn);
  });
  $("#modal").classList.remove("hidden");
}

function showJsonModal(title, data) {
  showModal(title, `<pre class="json-preview">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`, [
    ["关闭", "", closeModal]
  ]);
}

function closeModal() {
  $("#modal").classList.add("hidden");
}

function showToast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function readDebugParams() {
  const page = readJson("restored.api.debug.params")?.["exercise.html"] || {};
  return { ...page, ...(page.raw || {}) };
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
