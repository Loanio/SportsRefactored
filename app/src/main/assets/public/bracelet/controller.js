import { BraceletRepository } from "./repository.js";
import { BraceletService } from "./service.js";

const session = readJson("restored.auth.session") || {};
const debugParams = readJson("restored.api.debug.params")?.["bracelet.html"] || {};
const user = {
  id: debugParams.userId || session.id || "u-20260001",
  jobNum: session.jobNum || "20260001",
  bindId: debugParams.bindId || session.bindId || "",
  macAddress: session.macAddress || "",
  clientId: debugParams.clientId || session.clientId || "mock-client"
};

const repository = new BraceletRepository();
const service = new BraceletService(repository, user);

const state = {
  bracelet: null,
  searchList: []
};

const $ = selector => document.querySelector(selector);

init();

async function init() {
  bindEvents();
  await refresh();
}

function bindEvents() {
  $("#backHome").addEventListener("click", () => location.href = "./index.html");
  $("#refreshBtn").addEventListener("click", refresh);
  $("#searchBtn").addEventListener("click", search);
  $("#manualBindBtn").addEventListener("click", showManualBind);
  $("#syncBtn").addEventListener("click", syncHealth);
  $("#reportBtn").addEventListener("click", showReports);
  $("#unbindBtn").addEventListener("click", unbind);
  $("#feedbackBtn").addEventListener("click", showFeedback);
}

async function refresh() {
  try {
    const boot = await service.bootstrap();
    state.bracelet = boot.bracelet;
    render();
  } catch (error) {
    render();
    toast(error.message);
  }
}

function render() {
  $("#braceletCard").innerHTML = state.bracelet ? `
    <strong>${state.bracelet.model || state.bracelet.name}</strong>
    <span>绑定编号：${state.bracelet.bindId || "--"}</span>
    <span>MAC：${state.bracelet.macAddress || "--"}</span>
    <span>电量：${state.bracelet.electric || "--"}</span>
  ` : `
    <strong>未绑定手环</strong>
    <span>可通过搜索或手动填写 bindId / MAC 进行绑定。</span>
  `;

  $("#searchList").innerHTML = state.searchList.length ? state.searchList.map(item => `
    <button class="bracelet-row" data-bind="${item.bindId}" data-mac="${item.macAddress}" data-model="${item.model}" data-name="${item.name}">
      <span>
        <strong>${item.name}</strong>
        <span>${item.macAddress || "无 MAC"} · ${item.model}</span>
      </span>
      <b>绑定</b>
    </button>
  `).join("") : `<div class="empty-box">暂无搜索结果</div>`;

  document.querySelectorAll(".bracelet-row").forEach(row => {
    row.addEventListener("click", () => bind({
      bindId: row.dataset.bind,
      macAddress: row.dataset.mac,
      model: row.dataset.model,
      name: row.dataset.name
    }));
  });
}

async function search() {
  try {
    const params = readDebugParams();
    state.searchList = await service.search(params.keyword || params.braceletId || "");
    render();
    toast("搜索完成");
  } catch (error) {
    toast(error.message);
  }
}

function showManualBind() {
  showModal("手动绑定", `
    <label class="modal-field"><span>bindId / braceletId</span><input id="bindInput" value="${user.bindId || ""}"></label>
    <label class="modal-field"><span>MAC 地址</span><input id="macInput" value="${user.macAddress || ""}"></label>
    <label class="modal-field"><span>型号</span><input id="modelInput" value="M6w"></label>
  `, [
    ["取消", "secondary", closeModal],
    ["绑定", "", async () => {
      closeModal();
      await bind({
        bindId: $("#bindInput").value.trim(),
        macAddress: $("#macInput").value.trim(),
        model: $("#modelInput").value.trim(),
        name: $("#bindInput").value.trim()
      });
    }]
  ]);
}

async function bind(bracelet) {
  try {
    state.bracelet = await service.bind(bracelet);
    render();
    toast("绑定成功");
  } catch (error) {
    toast(error.message);
  }
}

async function unbind() {
  try {
    await service.unbind(true);
    state.bracelet = null;
    render();
    toast("解绑成功");
  } catch (error) {
    toast(error.message);
  }
}

async function syncHealth() {
  try {
    const result = await service.syncHealthData();
    showJsonModal("同步结果", result);
  } catch (error) {
    toast(error.message);
  }
}

async function showReports() {
  try {
    const result = await service.loadReports();
    showJsonModal("健康数据接口", result);
  } catch (error) {
    toast(error.message);
  }
}

function showFeedback() {
  showModal("填写反馈", `
    <label class="modal-field"><span>反馈内容</span><input id="feedbackInput" value="未搜索到手环"></label>
  `, [
    ["取消", "secondary", closeModal],
    ["提交", "", async () => {
      const value = $("#feedbackInput").value.trim();
      closeModal();
      const result = await service.submitFeedback(value);
      toast(result.message || "已提交");
    }]
  ]);
}

function showJsonModal(title, data) {
  showModal(title, `<pre class="json-preview">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`, [["关闭", "", closeModal]]);
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

function closeModal() {
  $("#modal").classList.add("hidden");
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function readDebugParams() {
  const page = readJson("restored.api.debug.params")?.["bracelet.html"] || {};
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
