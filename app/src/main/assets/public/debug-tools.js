(function () {
  const ParamsKey = "restored.api.debug.params";
  const OverrideKey = "restored.api.debug.override";

  const state = {
    page: location.pathname.split("/").pop() || "index.html",
    params: readJson(ParamsKey, {}),
    override: readJson(OverrideKey, {})
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const root = document.createElement("aside");
    root.className = "debug-float";
    root.innerHTML = `
      <div class="debug-panel">
        <div class="debug-head">
          <strong>接口调参</strong>
          <span>${state.page}</span>
        </div>
        <label class="debug-field">
          <span>Base URL 覆盖</span>
          <input id="debugBaseUrl" placeholder="默认取已选学校 url">
        </label>
        <label class="debug-field">
          <span>Token 覆盖</span>
          <input id="debugToken" placeholder="默认取当前登录 token">
        </label>
        <label class="debug-field">
          <span>当前 WebView UA</span>
          <textarea id="debugUa" spellcheck="false" readonly></textarea>
        </label>
        <label class="debug-field">
          <span>userId</span>
          <input id="debugUserId">
        </label>
        <label class="debug-field">
          <span>eventId</span>
          <input id="debugEventId">
        </label>
        <label class="debug-field">
          <span>termId / yearsId</span>
          <input id="debugTermId">
        </label>
        <label class="debug-field">
          <span>clientId</span>
          <input id="debugClientId">
        </label>
        <label class="debug-field">
          <span>bindId</span>
          <input id="debugBindId">
        </label>
        <label class="debug-field">
          <span>额外 JSON 参数</span>
          <textarea id="debugRaw" spellcheck="false" placeholder='{"page":1,"pageSize":10}'></textarea>
        </label>
        <div class="debug-actions">
          <button id="debugSave">保存</button>
          <button class="ghost" id="debugReset">清空本页</button>
        </div>
        <p class="debug-note">保存后刷新当前页面生效；请求层会把这些参数合并到真实接口入参里。</p>
      </div>
      <button class="debug-trigger" id="debugToggle" title="接口调参">API</button>
    `;
    document.body.appendChild(root);

    fillForm();
    root.querySelector("#debugToggle").addEventListener("click", () => root.classList.toggle("open"));
    root.querySelector("#debugSave").addEventListener("click", save);
    root.querySelector("#debugReset").addEventListener("click", reset);
  }

  function fillForm() {
    const pageParams = state.params[state.page] || {};
    $("#debugBaseUrl").value = state.override.baseUrl || "";
    $("#debugToken").value = state.override.token || "";
    $("#debugUa").value = navigator.userAgent || "";
    $("#debugUserId").value = pageParams.userId || "";
    $("#debugEventId").value = pageParams.eventId || "";
    $("#debugTermId").value = pageParams.termId || "";
    $("#debugClientId").value = pageParams.clientId || "";
    $("#debugBindId").value = pageParams.bindId || "";
    $("#debugRaw").value = pageParams.raw ? JSON.stringify(pageParams.raw, null, 2) : "";
  }

  function save() {
    const rawText = $("#debugRaw").value.trim();
    let raw = {};
    if (rawText) {
      try {
        raw = JSON.parse(rawText);
      } catch {
        alert("额外 JSON 参数格式不正确");
        return;
      }
    }

    state.override = {
      baseUrl: $("#debugBaseUrl").value.trim(),
      token: $("#debugToken").value.trim()
    };
    state.params[state.page] = compact({
      userId: $("#debugUserId").value.trim(),
      eventId: $("#debugEventId").value.trim(),
      termId: $("#debugTermId").value.trim(),
      clientId: $("#debugClientId").value.trim(),
      bindId: $("#debugBindId").value.trim(),
      raw
    });

    localStorage.setItem(OverrideKey, JSON.stringify(compact(state.override)));
    localStorage.setItem(ParamsKey, JSON.stringify(state.params));
    location.reload();
  }

  function reset() {
    delete state.params[state.page];
    localStorage.setItem(ParamsKey, JSON.stringify(state.params));
    location.reload();
  }

  function compact(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => {
      if (item && typeof item === "object") return Object.keys(item).length;
      return item !== "";
    }));
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") || fallback;
    } catch {
      return fallback;
    }
  }

  function $(selector) {
    return document.querySelector(selector);
  }
})();
