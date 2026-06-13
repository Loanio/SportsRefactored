import { ApiClient, ApiModeKey, aesMinEncrypt, normalizeApiResult } from "../api/client.js";
import { pseudoEncrypt } from "./domain.js";

const SessionKey = "restored.auth.session";
const SchoolKey = "restored.auth.school";
const AcceptedKey = "restored.auth.accepted";

export class AuthRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.users = seedUsers();
    this.api = new ApiClient(storage);
  }

  async getSchoolList() {
    if (this.isRealMode()) {
      try {
        const result = normalizeApiResult(await this.api.post("/tyapi/mobile/dataSource/getDataSourceList/"));
        if (result.statusCode === 1 && Array.isArray(result.obj)) return result.obj.map(normalizeSchool);
      } catch (error) {
        console.warn("真实学校接口不可用，已回退到还原数据", error);
      }
    }
    return delay([
      { name: "浙大城市学院", url: "https://ty.hzcu.edu.cn/app", logo: "./static/img/login/xalogo.png" },
      { name: "丽水学院", url: "https://lsxyty.hzwolf.com/app/", logo: "./static/img/login/lslogo.png" },
      { name: "浙江机电职业技术大学", url: "https://ty.zime.edu.cn/app", logo: "./static/img/login/jdlogo.png" },
      { name: "数智体育演示", url: "https://ty.hzwolf.com/app", logo: "./static/img/login/logo.png" }
    ]);
  }

  async login({ loginId, password, system = "Android", version = "2.6.4" }) {
    if (this.isRealMode()) {
      const systemInfo = getSystemInfo(system);
      return normalizeApiResult(await this.api.post("/tyapi/mobile/user/login", {
        loginId: await aesMinEncrypt(loginId),
        pwd: await aesMinEncrypt(password),
        system,
        systemNum: systemInfo.system,
        model: systemInfo.brand,
        platform: "",
        number: version
      }));
    }

    const user = this.users.find(item => item.loginId === loginId && item.password === password);
    if (!user) return delay({ statusCode: -1, message: "账号或密码错误" }, 420);
    return delay({
      statusCode: 1,
      message: "登录成功",
      obj: {
        token: `mock-token-${Date.now()}`,
        id: user.id,
        isTeacher: user.type === "教师",
        type: user.type,
        jobNum: user.jobNum,
        name: user.name,
        audit: "pass",
        isHomePage: user.type === "教师",
        moduleList: user.moduleList,
        bindId: user.bindId,
        model: system,
        macAddress: "00:11:22:33:44:55",
        age: user.age,
        times: user.mustChangePassword ? 1 : 0,
        encryptedLoginId: pseudoEncrypt(loginId),
        encryptedPwd: pseudoEncrypt(password),
        version
      }
    }, 520);
  }

  async register({ name, mobile, password, confirmPassword }) {
    if (this.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/user/register", {
        name,
        mobile,
        pwd: await aesMinEncrypt(password),
        newPwd: await aesMinEncrypt(confirmPassword)
      }));
    }

    if (this.users.some(user => user.mobile === mobile)) {
      return delay({ statusCode: -1, message: "手机号已注册" });
    }
    this.users.push({
      id: `u-${Date.now()}`,
      loginId: mobile,
      password,
      name,
      mobile,
      type: "学生",
      jobNum: mobile.slice(-8),
      bindId: `bind-${Date.now()}`,
      age: 18,
      mustChangePassword: false,
      moduleList: studentModuleList()
    });
    return delay({ statusCode: 1, message: "注册成功" });
  }

  async retrievePassword({ name, mobile, loginId, password, confirmPassword }) {
    if (this.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/user/retrievePassword", {
        name,
        mobile,
        loginId: await aesMinEncrypt(loginId),
        pwd: await aesMinEncrypt(password),
        newPwd: await aesMinEncrypt(confirmPassword)
      }));
    }

    const user = this.users.find(item => item.name === name && item.mobile === mobile && item.loginId === loginId);
    if (!user) return delay({ statusCode: -1, message: "身份信息不匹配" });
    user.password = password;
    user.mustChangePassword = false;
    return delay({ statusCode: 1, message: "修改成功" });
  }

  async changePassword({ userId, oldPassword, password, confirmPassword }) {
    if (this.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/user/changePwd", {
        id: userId,
        oldPwd: await aesMinEncrypt(oldPassword),
        pwd: await aesMinEncrypt(password),
        newPwd: await aesMinEncrypt(confirmPassword)
      }));
    }

    const user = this.users.find(item => item.id === userId);
    if (!user) return delay({ statusCode: -1, message: "用户不存在" });
    if (oldPassword && user.password !== oldPassword) return delay({ statusCode: -1, message: "旧密码错误" });
    user.password = password;
    user.mustChangePassword = false;
    return delay({ statusCode: 1, message: "请重新登录" });
  }

  async logout() {
    const session = this.getSession();
    if (this.isRealMode() && session?.id) {
      try {
        await this.api.post("/tyapi/mobile/user/logout", { id: session.id });
      } catch (error) {
        console.warn("退出登录接口调用失败，继续清理本地登录态", error);
      }
    }
    this.clearSession();
  }

  async singleSignOn() {
    return delay({ statusCode: 1, obj: { ssoStatus: false, ssoForgetTip: "" } });
  }

  async getAgreement(type) {
    if (this.isRealMode()) {
      const path = type === "privacy" ? "/tyapi/mobile/cms/getPrivacyAgreement/" : "/tyapi/mobile/cms/getUserAgreement/";
      const result = normalizeApiResult(await this.api.get(path));
      const content = typeof result.obj === "string" ? result.obj : result.obj?.content || result.obj?.article || "";
      return { title: type === "privacy" ? "隐私政策" : "用户协议", content };
    }

    const title = type === "privacy" ? "隐私政策" : "用户协议";
    return delay({
      title,
      content: `${title}用于说明数智体育在账号登录、课外锻炼、体测、课程签到等场景中的服务规则。此处为还原版示例内容，真实 APP 会通过 CMS 接口拉取。`
    });
  }

  saveSession(session) {
    this.storage.setItem(SessionKey, JSON.stringify(session));
  }

  getSession() {
    try {
      return JSON.parse(this.storage.getItem(SessionKey) || "null");
    } catch {
      return null;
    }
  }

  clearSession() {
    this.storage.removeItem(SessionKey);
  }

  saveSchool(school) {
    this.storage.setItem(SchoolKey, JSON.stringify(school));
  }

  getSchool() {
    try {
      return JSON.parse(this.storage.getItem(SchoolKey) || "null");
    } catch {
      return null;
    }
  }

  setAccepted(value) {
    this.storage.setItem(AcceptedKey, JSON.stringify(Boolean(value)));
  }

  getAccepted() {
    return JSON.parse(this.storage.getItem(AcceptedKey) || "false");
  }

  isRealMode() {
    return this.storage.getItem(ApiModeKey) === "real";
  }

  setRealMode(enabled) {
    this.api.setRealMode(enabled);
  }
}

function normalizeSchool(item) {
  return {
    name: item.name || item.schoolName || item.dataSourceName || "未命名学校",
    url: item.url || item.configUrl || item.baseUrl || "",
    logo: item.logo || item.schoolLogo || "./static/img/login/logo.png",
    raw: item
  };
}

function getSystemInfo(system) {
  return {
    system: navigator.userAgent || system,
    brand: navigator.platform || "browser"
  };
}

function seedUsers() {
  return [
    {
      id: "stu-001",
      loginId: "student",
      password: "123456",
      name: "王同学",
      mobile: "13800000001",
      type: "学生",
      jobNum: "20260001",
      bindId: "bind-stu-001",
      age: 19,
      mustChangePassword: false,
      moduleList: studentModuleList()
    },
    {
      id: "tea-001",
      loginId: "teacher",
      password: "123456",
      name: "李老师",
      mobile: "13800000002",
      type: "教师",
      jobNum: "T2026001",
      bindId: "",
      age: 35,
      mustChangePassword: false,
      moduleList: teacherModuleList()
    },
    {
      id: "stu-init",
      loginId: "init",
      password: "123456",
      name: "初始密码用户",
      mobile: "13800000003",
      type: "学生",
      jobNum: "20260003",
      bindId: "bind-stu-003",
      age: 18,
      mustChangePassword: true,
      moduleList: studentModuleList()
    }
  ];
}

function studentModuleList() {
  return [
    moduleItem("STUDENT_COURSE", "我的课程", "/student/course/stucourselist"),
    moduleItem("STUDENT_EXERCISE", "课外锻炼", "/student/exercise/index"),
    moduleItem("STUDENT_SIGN_IN", "上课考勤", "/student/signin/stusignin"),
    moduleItem("STUDENT_HEALTH", "体测", "/test/stutest"),
    moduleItem("STUDENT_NEWS", "新闻资讯", "/aid/news")
  ];
}

function teacherModuleList() {
  return [
    moduleItem("TEACHER_COURSE", "教学管理", "/manage/index"),
    moduleItem("TEACHER_HEALTH", "体测", "/test/index"),
    moduleItem("TEACHER_NEWS", "新闻资讯", "/aid/news"),
    moduleItem("TEACHER_HOMEPAGE_STU", "学生主页", "/homepagestu/searchstu")
  ];
}

function moduleItem(code, name, url) {
  return { id: code, code, name, url, category: "页面", icon: "" };
}

function delay(value, ms = 180) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}
