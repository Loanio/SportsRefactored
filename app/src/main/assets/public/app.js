const state = {
  role: "学生",
  schoolName: "数智体育",
  session: null,
  currentPage: "home",
  currentSlide: 0,
  isHomePageOpen: false,
  msgNum: 3,
  moduleList: null,
  notices: [
    { id: 1, source: "通知公告", content: "本周体测预约已开放，请按班级通知完成报名。" },
    { id: 2, source: "课程提醒", content: "今日 16:00 有课外锻炼记录待上传。" }
  ],
  messages: [
    { id: 1, title: "体测预约提醒", text: "你有一个新的体测预约批次可报名。", unread: true },
    { id: 2, title: "课程签到", text: "篮球专项课第 6 周签到已开始。", unread: true },
    { id: 3, title: "场馆订单", text: "羽毛球场预约审核通过。", unread: true }
  ],
  feed: [
    { title: "校园晨跑挑战", text: "今日共有 128 名同学完成晨跑打卡，平均配速 6'12''。" },
    { title: "校队训练动态", text: "田径队发布新的训练计划，队员可在代表队模块查看。" },
    { title: "科学锻炼建议", text: "本周建议安排 2 次有氧、1 次力量训练，注意拉伸恢复。" }
  ],
  unfinished: { type: "户外跑步", distance: "2.31km", path: "/pages/map/map?runId=mock-run-001" }
};

const AS = "./static/img";

const studentModels = [
  ["我的课程", "STUDENT_COURSE", "mycourse.svg", "/student/course/stucourselist"],
  ["课外锻炼", "STUDENT_EXERCISE", "Sport.svg", "/student/exercise/index"],
  ["手环", "STUDENT_BRACELET", "Watch.svg", "/bracelet/main"],
  ["教学视频", "STUDENT_VIDEO", "Vedio.svg", "/course/index"],
  ["上课考勤", "STUDENT_SIGN_IN", "tc-sign.svg", "/student/signin/stusignin"],
  ["场馆服务", "STUDENT_VENUES", "Stadium.svg", "/venues/index"],
  ["比赛", "STUDENT_RACE", "race-one.svg", "/campus/index"],
  ["体测", "STUDENT_HEALTH", "ScoreApply.svg", "/test/stutest"],
  ["急救知识", "STUDENT_KLG_FIRST_AID", "Medical-box.svg", "/aid/index"],
  ["健康常识", "STUDENT_KLG_HEALTH", "healthreport.svg", "/aid/health"],
  ["代表队", "STUDENT_TEAM", "Athlete.svg", "/student/sportsteam/teamlist"],
  ["科学锻炼", "STUDENT_PRESCRIPTION", "Rocket.svg", "/recipe/index"],
  ["我的社团", "STUDENT_ASSOCIATION", "Shetuan.svg", "/community/index"],
  ["新闻资讯", "STUDENT_NEWS", "News.svg", "/aid/news"],
  ["教师主页", "STUDENT_HOMEPAGE_TEA", "ProfileT.svg", "/homepage/search"],
  ["学生主页", "STUDENT_HOMEPAGE_STU", "ProfileS.svg", "/homepagestu/searchstu"],
  ["体育器材", "STUDENT_EQUIPMENT", "box.svg", "/equipment/index"],
  ["失物招领", "STUDENT_LOST", "Lost.svg", "/lostfound/stuindex"]
];

const teacherModels = [
  ["教学管理", "TEACHER_COURSE", "Folder.svg", "/manage/index"],
  ["教学视频", "TEACHER_VIDEO", "Vedio.svg", "/course/index"],
  ["场馆服务", "TEACHER_VENUES", "Stadium.svg", "/venues/index"],
  ["比赛", "TEACHER_RACE", "race-bmgl.svg", "/campus/index"],
  ["体测", "TEACHER_HEALTH", "ScoreAudit.svg", "/test/index"],
  ["急救知识", "TEACHER_KLG_FIRST_AID", "Medical-box.svg", "/aid/index"],
  ["健康常识", "TEACHER_KLG_HEALTH", "healthreport.svg", "/aid/health"],
  ["代表队", "TEACHER_TEAM", "AthleteSeal.svg", "/student/sportsteam/teamlist"],
  ["听课", "TEACHER_LISTENING", "checker.svg", "/supervision/index"],
  ["我的社团", "TEACHER_ASSOCIATION", "Shetuan.svg", "/community/index"],
  ["新闻资讯", "TEACHER_NEWS", "News.svg", "/aid/news"],
  ["下院系", "TEACHER_GUIDE", "Flag.svg", "/guidance/index"],
  ["教师主页", "TEACHER_HOMEPAGE_TEA", "ProfileT.svg", "/homepage/search"],
  ["学生主页", "TEACHER_HOMEPAGE_STU", "ProfileS.svg", "/homepagestu/searchstu"],
  ["体育器材", "TEACHER_EQUIPMENT", "box.svg", "/equipment/index"],
  ["机柜管理", "TEACHER_CABINET_ADMIN", "cabinet.svg", "/cell/cellmanage"]
];

const carouselData = [
  { title: "数智体育平台", url: `${AS}/homepage/bgimg.png`, id: "news-1" },
  { title: "课外锻炼数据看板", url: `${AS}/homepage/temp5.png`, id: "news-2" },
  { title: "校园竞赛与场馆服务", url: `${AS}/homepage/bgimg2.png`, id: "news-3" }
];

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function init() {
  hydrateSession();
  bindEvents();
  renderAll();
  setInterval(nextSlide, 3200);
}

function hydrateSession() {
  try {
    const session = JSON.parse(localStorage.getItem("restored.auth.session") || "null");
    if (!session) return;
    state.session = session;
    state.role = session.type || state.role;
    state.schoolName = session.schoolName || state.schoolName;
    state.isHomePageOpen = Boolean(session.isHomePage);
  } catch {
    state.session = null;
  }
}

function bindEvents() {
  $all(".role-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      state.role = btn.dataset.role;
      state.isHomePageOpen = state.role === "教师";
      renderAll();
      toast(`已切换到${state.role}端`);
    });
  });

  $all(".tab").forEach(tab => {
    tab.addEventListener("click", () => changePage(tab.dataset.target));
  });

  $("#scanBtn").addEventListener("click", showScanModal);
  $("#homePageBtn").addEventListener("click", pageToMessage);
  $("#noticeOpenBtn").addEventListener("click", showNoticeModal);
  $("#continueBtn").addEventListener("click", () => {
    toast(`跳转：${state.unfinished.path}`);
    hideContinue();
  });
  $("#readAllBtn").addEventListener("click", readAllMessages);
  $("#publishBtn").addEventListener("click", () => toast("发布运动圈动态"));
}

function renderAll() {
  $("#schoolName").textContent = state.schoolName;
  $all(".role-pill").forEach(btn => btn.classList.toggle("active", btn.dataset.role === state.role));
  $("#avatar").src = state.role === "学生" ? `${AS}/index/ProfileS.svg` : `${AS}/index/ProfileT.svg`;
  $("#mineAvatar").src = $("#avatar").src;
  $("#userName").textContent = state.role === "学生" ? "王同学" : "李老师";
  if (state.session) {
    $("#userName").textContent = state.session.name;
    $("#userMeta").textContent = `${state.role === "学生" ? "学号" : "工号"} ${state.session.jobNum} · ${state.schoolName}`;
  } else {
    $("#userMeta").textContent = state.role === "学生" ? "学号 20260001 · 数智体育学院" : "工号 T2026001 · 公共体育教学部";
  }
  renderCarousel();
  renderNotice();
  renderModules();
  renderMessages();
  renderFeed();
  renderMine();
  renderBadge();
}

function renderCarousel() {
  $("#carouselTrack").innerHTML = carouselData.map(item => `
    <button class="slide" data-id="${item.id}">
      <div class="slide-inner">
        <img src="${item.url}" alt="">
        <div class="slide-title">${item.title}</div>
      </div>
    </button>
  `).join("");
  $("#carouselDots").innerHTML = carouselData.map((_, index) =>
    `<span class="dot ${index === state.currentSlide ? "active" : ""}"></span>`
  ).join("");
  $("#carouselTrack").style.transform = `translateX(-${state.currentSlide * 100}%)`;
  $all(".slide").forEach((slide, index) => {
    slide.addEventListener("click", () => toast(`跳转：/pages/aid/detail?id=${carouselData[index].id}`));
  });
}

function nextSlide() {
  state.currentSlide = (state.currentSlide + 1) % carouselData.length;
  renderCarousel();
}

function renderNotice() {
  const notice = state.notices[0];
  $("#noticeTitle").textContent = notice ? notice.source : "通知公告";
  $("#noticeText").textContent = notice ? notice.content : "暂无通知";
}

function getModels() {
  const all = state.role === "学生" ? studentModels : teacherModels;
  if (!state.moduleList) return all;
  return all.filter(item => state.moduleList.includes(item[1]));
}

function renderModules() {
  const models = getModels();
  $("#moduleCount").textContent = `${models.length} 个`;
  $("#moduleGrid").innerHTML = models.map(([name, code, icon, path]) => `
    <button class="module" data-path="${path}" data-code="${code}">
      <img src="${AS}/index/${icon}" alt="">
      <span>${name}</span>
    </button>
  `).join("");
  $all(".module").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.code === "STUDENT_EXERCISE") {
        location.href = "./exercise.html";
        return;
      }
      if (btn.dataset.code === "STUDENT_BRACELET") {
        location.href = "./bracelet.html";
        return;
      }
      if (btn.dataset.code === "TEACHER_COURSE") {
        location.href = "./teacher-manage.html";
        return;
      }
      toast(`跳转：${btn.dataset.path}`);
    });
  });
}

function renderMessages() {
  $("#messageList").innerHTML = state.messages.length ? state.messages.map(msg => `
    <button class="message-item ${msg.unread ? "unread" : ""}" data-id="${msg.id}">
      <strong>${msg.title}</strong>
      <p>${msg.text}</p>
    </button>
  `).join("") : `<div class="empty-state message-item">暂无消息</div>`;
  $all(".message-item[data-id]").forEach(item => {
    item.addEventListener("click", () => {
      const msg = state.messages.find(row => row.id === Number(item.dataset.id));
      if (msg) msg.unread = false;
      renderMessages();
      renderBadge();
    });
  });
}

function renderFeed() {
  $("#feedList").innerHTML = state.feed.map(item => `
    <article class="feed-item">
      <strong>${item.title}</strong>
      <p>${item.text}</p>
    </article>
  `).join("");
}

function renderMine() {
  const rows = [
    ["我的个人主页", state.isHomePageOpen ? "已开启" : "未开启"],
    ["账号设置", "修改资料 / 密码"],
    ["版本信息", "2.6.4 build 2604"],
    ["退出登录", ""]
  ];
  $("#settingList").innerHTML = rows.map(([name, value]) => `
    <button class="setting-item" data-name="${name}">
      <strong>${name}</strong>
      <span>${value}</span>
    </button>
  `).join("");
  $all(".setting-item").forEach(row => {
    row.addEventListener("click", () => {
      if (row.dataset.name === "我的个人主页") pageToMessage();
      else if (row.dataset.name === "退出登录") {
        logoutFromServer();
        location.href = "./login.html";
      }
      else toast(row.dataset.name);
    });
  });
}

function logoutFromServer() {
  const session = readJson("restored.auth.session");
  const school = readJson("restored.auth.school");
  if (localStorage.getItem("restored.api.mode") === "real" && session?.id && school?.url) {
    fetch(`${school.url.replace(/\/$/, "")}/tyapi/mobile/user/logout`, {
      method: "POST",
      headers: {
        token: session.sysToken || "",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: session.id }),
      keepalive: true
    }).catch(() => {});
  }
  localStorage.removeItem("restored.auth.session");
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function renderBadge() {
  state.msgNum = state.messages.filter(msg => msg.unread).length;
  $("#msgBadge").textContent = state.msgNum;
  $("#msgBadge").style.display = state.msgNum ? "block" : "none";
}

function changePage(page) {
  state.currentPage = page;
  $all(".page").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $all(".tab").forEach(el => el.classList.toggle("active", el.dataset.target === page));
}

function pageToMessage() {
  if (state.isHomePageOpen) {
    toast(state.role === "学生" ? "跳转：/pages/homepagestu/student" : "跳转：/pages/homepage/teacher");
    return;
  }
  showModal("开启个人主页", `
    <p>原 APP 在这里会调用 getMyPersonalPage、addPersonalPage 或 openMyPersonalPage。</p>
    <p>开启后进入${state.role === "学生" ? "学生" : "教师"}主页模板选择。</p>
  `, [
    ["下次再说", "secondary", closeModal],
    ["立即开启", "", () => {
      state.isHomePageOpen = true;
      closeModal();
      renderMine();
      toast("个人主页已开启，跳转模板选择");
    }]
  ]);
}

function showNoticeModal() {
  const notice = state.notices[0];
  showModal(notice?.source || "通知公告", `<p>${notice?.content || "暂无通知"}</p>`, [
    ["确定", "", () => {
      if (state.notices.length) state.notices.shift();
      closeModal();
      renderNotice();
      toast("通知已读");
    }]
  ]);
}

function showScanModal() {
  showModal("扫码逻辑模拟", `
    <p>原 APP 会按二维码前缀分流：club、homePage、cabinet、APPARATUS、Lost、health、signIn/signOut。</p>
    <p>这里选择一种结果查看对应跳转。</p>
  `, [
    ["个人主页码", "secondary", () => scanResult("homePage-student-10001")],
    ["机柜码", "secondary", () => scanResult("cabinet-A-1-03")],
    ["签到码", "", () => scanResult("signIn-course-01")]
  ]);
}

function scanResult(value) {
  closeModal();
  const prefix = value.split("-")[0];
  const routes = {
    homePage: "/pages/homepagestu/student?homePageId=10001",
    cabinet: "/pages/cell/borrowreturn?cell1=A&cell2=1&cell3=03",
    signIn: "调用 signQRInCommon 完成签到"
  };
  toast(routes[prefix] || "扫码成功");
}

function readAllMessages() {
  state.messages.forEach(msg => msg.unread = false);
  renderMessages();
  renderBadge();
  toast("消息已全部标记为已读");
}

function hideContinue() {
  $("#continueCard").style.display = "none";
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

init();
