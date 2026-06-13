export const AuthRoute = Object.freeze({
  LOGIN: "login",
  SCHOOL: "school",
  REGISTER: "register",
  FIND_PASSWORD: "find-password",
  CHANGE_PASSWORD: "change-password",
  AGREEMENT: "agreement"
});

export function validateLogin({ loginId, password, school, accepted }) {
  if (!accepted) return "请先阅读并同意用户协议和隐私政策";
  if (!school?.url && !school?.configUrl) return "暂未选择学校，请先选择";
  if (!loginId || !password) return "请完整填写登录名和密码";
  return "";
}

export function validateRegister(form) {
  if (!form.name) return "请输入姓名";
  if (!form.mobile) return "请输入手机号";
  if (!/^1\d{10}$/.test(form.mobile)) return "手机号格式不正确";
  if (!form.password) return "请输入密码";
  if (!form.confirmPassword) return "请再次确认密码";
  return validatePasswordPair(form.password, form.confirmPassword, 6);
}

export function validateFindPassword(form) {
  if (!form.name) return "请输入姓名";
  if (!form.mobile) return "请输入手机号";
  if (!form.loginId) return "请输入登录账号";
  if (!form.password) return "请输入新密码";
  if (!form.confirmPassword) return "请再次确认新密码";
  return validatePasswordPair(form.password, form.confirmPassword, 6);
}

export function validateChangePassword(form, requireOld = true) {
  if (requireOld && !form.oldPassword) return "请输入旧密码";
  if (!form.password) return "请输入新密码";
  if (!form.confirmPassword) return "请再次确认新密码";
  const pairError = validatePasswordPair(form.password, form.confirmPassword, 8);
  if (pairError) return pairError;
  if (!isStrongPassword(form.password)) return "密码不符合要求";
  return "";
}

export function validatePasswordPair(password, confirmPassword, minLength) {
  if (/\s/.test(password)) return "密码不可包含空格";
  if (/[\u4e00-\u9fa5]/.test(password)) return "密码不可包含中文";
  if (password.length < minLength) return `长度最小${minLength}位`;
  if (password !== confirmPassword) return "两次输入的密码不一致";
  return "";
}

export function getPasswordStrength(password) {
  let score = 0;
  if (/[0-9]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[\W_]/.test(password)) score += 1;
  if (password.length < 8) return { label: "弱", score: Math.min(score, 1), ok: false };
  if (score >= 4) return { label: "强", score, ok: true };
  if (score >= 3) return { label: "中", score, ok: true };
  return { label: "弱", score, ok: false };
}

export function isStrongPassword(password) {
  return getPasswordStrength(password).ok;
}

export function createSession(loginResult) {
  const obj = loginResult.obj;
  return {
    sysToken: obj.token || obj.sysToken || obj.sys_token || "",
    id: obj.id || obj.userId || obj.user?.id || "",
    tokenKey: obj.id,
    isTeacher: Boolean(obj.isTeacher || obj.type === "教师" || obj.role === "teacher"),
    type: obj.type || obj.userType || (obj.isTeacher ? "教师" : "学生"),
    jobNum: obj.jobNum || obj.loginId || obj.user?.jobNum || "",
    name: obj.name || obj.userName || obj.user?.name || "",
    audit: obj.audit,
    isHomePage: obj.isHomePage ?? obj.homePage ?? false,
    moduleList: obj.moduleList || obj.modules || [],
    bindId: obj.bindId || "",
    model: obj.model || "",
    macAddress: obj.macAddress || "",
    age: obj.age || ""
  };
}

export function getLandingPath(session) {
  if (session.mustChangePassword) return "./login.html#change-password";
  return "./index.html";
}

export function pseudoEncrypt(value) {
  return btoa(unescape(encodeURIComponent(String(value)))).split("").reverse().join("");
}
