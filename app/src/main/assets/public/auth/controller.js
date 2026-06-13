import { AuthRoute, getPasswordStrength } from "./domain.js";
import { AuthRepository } from "./repository.js";
import { AuthService } from "./service.js";

const repository = new AuthRepository();
const service = new AuthService(repository);

const state = {
  route: location.hash.replace("#", "") || AuthRoute.LOGIN,
  schools: [],
  school: null,
  accepted: false,
  realMode: false,
  showPassword: false
};

const $ = selector => document.querySelector(selector);
const $all = selector => [...document.querySelectorAll(selector)];

init();

async function init() {
  const boot = await service.bootstrap();
  state.schools = boot.schools;
  state.school = boot.school;
  state.accepted = boot.accepted;
  state.realMode = boot.realMode;
  bindEvents();
  render();
}

function bindEvents() {
  window.addEventListener("hashchange", () => {
    state.route = location.hash.replace("#", "") || AuthRoute.LOGIN;
    render();
  });

  $("#loginForm").addEventListener("submit", submitLogin);
  $("#registerForm").addEventListener("submit", submitRegister);
  $("#findForm").addEventListener("submit", submitFindPassword);
  $("#changeForm").addEventListener("submit", submitChangePassword);
  $("#schoolBtn").addEventListener("click", () => navigate(AuthRoute.SCHOOL));
  $("#accepted").addEventListener("change", event => {
    state.accepted = event.target.checked;
    service.setAccepted(state.accepted);
  });
  $("#apiModeBtn").addEventListener("click", toggleApiMode);
  $("#showPwdBtn").addEventListener("click", togglePassword);
  $("#changePassword").addEventListener("input", renderPasswordStrength);
  $("#agreementUser").addEventListener("click", () => showAgreement("user"));
  $("#agreementPrivacy").addEventListener("click", () => showAgreement("privacy"));
  $("#schoolBack").addEventListener("click", () => navigate(AuthRoute.LOGIN));
  $("#goRegister").addEventListener("click", () => navigate(AuthRoute.REGISTER));
  $("#goFind").addEventListener("click", () => navigate(AuthRoute.FIND_PASSWORD));
  $all("[data-back-login]").forEach(btn => btn.addEventListener("click", () => navigate(AuthRoute.LOGIN)));
}

function render() {
  $all(".auth-view").forEach(view => view.classList.toggle("active", view.dataset.view === state.route));
  $("#schoolName").textContent = state.school?.name || "请选择学校";
  $("#schoolLogo").src = state.school?.logo || "./static/img/login/logo.png";
  $("#accepted").checked = state.accepted;
  $("#apiModeBtn").setAttribute("aria-pressed", String(state.realMode));
  $("#apiModeText").textContent = state.realMode ? "真实接口" : "还原数据";
  $("#apiUrl").textContent = state.realMode ? `Base URL：${state.school?.url || "未选择学校"}` : "当前使用本地还原数据，可离线预览";
  renderSchools();
  renderPasswordStrength();
}

function renderSchools() {
  $("#schoolList").innerHTML = state.schools.map((school, index) => `
    <button class="school-row ${school.name === state.school?.name ? "active" : ""}" data-index="${index}">
      <img src="${school.logo}" alt="">
      <div>
        <strong>${school.name}</strong>
        <span>${school.url}</span>
      </div>
    </button>
  `).join("");
  $all(".school-row").forEach(row => {
    row.addEventListener("click", () => {
      state.school = service.chooseSchool(state.schools[Number(row.dataset.index)]);
      toast(`已选择：${state.school.name}`);
      navigate(AuthRoute.LOGIN);
    });
  });
}

async function toggleApiMode() {
  state.realMode = !state.realMode;
  service.setRealMode(state.realMode);
  toast(state.realMode ? "已切换为真实接口" : "已切换为还原数据");
  if (state.realMode) {
    const boot = await service.bootstrap();
    state.schools = boot.schools;
    state.school = boot.school;
  }
  render();
}

async function submitLogin(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  setBusy("#loginSubmit", true, "登录中...");
  try {
    const result = await service.login(form, {
      school: state.school,
      accepted: state.accepted,
      system: "Android",
      version: "2.6.4"
    });
    toast("登录成功");
    setTimeout(() => {
      location.href = result.landingPath;
    }, 500);
  } catch (error) {
    showError(error.message);
  } finally {
    setBusy("#loginSubmit", false, "登录");
  }
}

async function submitRegister(event) {
  event.preventDefault();
  try {
    await service.register(Object.fromEntries(new FormData(event.currentTarget)));
    toast("注册成功，请登录");
    navigate(AuthRoute.LOGIN);
  } catch (error) {
    showError(error.message);
  }
}

async function submitFindPassword(event) {
  event.preventDefault();
  try {
    await service.retrievePassword(Object.fromEntries(new FormData(event.currentTarget)));
    toast("修改成功，请登录");
    navigate(AuthRoute.LOGIN);
  } catch (error) {
    showError(error.message);
  }
}

async function submitChangePassword(event) {
  event.preventDefault();
  try {
    await service.changePassword(Object.fromEntries(new FormData(event.currentTarget)), { requireOld: true });
    toast("请重新登录");
    navigate(AuthRoute.LOGIN);
  } catch (error) {
    showError(error.message);
  }
}

function togglePassword() {
  state.showPassword = !state.showPassword;
  const type = state.showPassword ? "text" : "password";
  $all("input[type='password'], input[data-password]").forEach(input => {
    input.type = type;
    input.dataset.password = "true";
  });
}

function renderPasswordStrength() {
  const value = $("#changePassword")?.value || "";
  const strength = getPasswordStrength(value);
  $("#strengthText").textContent = strength.label;
  $("#strengthBar").style.width = `${Math.max(12, strength.score * 25)}%`;
  $("#strengthBar").dataset.level = strength.label;
}

async function showAgreement(type) {
  const agreement = await service.getAgreement(type);
  showModal(agreement.title, `<p>${agreement.content}</p>`, [["知道了", "", closeModal]]);
}

function navigate(route) {
  location.hash = route === AuthRoute.LOGIN ? "" : route;
  state.route = route;
  render();
}

function setBusy(selector, busy, text) {
  const btn = $(selector);
  btn.disabled = busy;
  btn.textContent = text;
}

function showError(message) {
  $("#errorBox").textContent = message;
  $("#errorBox").classList.add("show");
  clearTimeout(showError.timer);
  showError.timer = setTimeout(() => $("#errorBox").classList.remove("show"), 2600);
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
