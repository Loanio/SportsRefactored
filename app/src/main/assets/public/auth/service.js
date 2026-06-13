import {
  createSession,
  getLandingPath,
  validateChangePassword,
  validateFindPassword,
  validateLogin,
  validateRegister
} from "./domain.js";

export class AuthService {
  constructor(repository) {
    this.repository = repository;
  }

  async bootstrap() {
    const [schools, selectedSchool] = await Promise.all([
      this.repository.getSchoolList(),
      Promise.resolve(this.repository.getSchool())
    ]);
    const school = selectedSchool || schools[0];
    if (!selectedSchool) this.repository.saveSchool(school);
    return {
      schools,
      school,
      accepted: this.repository.getAccepted(),
      session: this.repository.getSession(),
      realMode: this.repository.isRealMode()
    };
  }

  chooseSchool(school) {
    this.repository.saveSchool(school);
    return school;
  }

  setAccepted(value) {
    this.repository.setAccepted(value);
  }

  setRealMode(value) {
    this.repository.setRealMode(value);
  }

  async login(form, context) {
    const error = validateLogin({ ...form, school: context.school, accepted: context.accepted });
    if (error) throw new Error(error);
    const result = await this.repository.login({
      loginId: form.loginId,
      password: form.password,
      system: context.system || "Android",
      version: context.version || "2.6.4"
    });
    if (result.statusCode !== 1) throw new Error(result.message);
    const session = {
      ...createSession(result),
      schoolName: context.school.name,
      configUrl: context.school.url,
      schoolLogo: context.school.logo,
      mustChangePassword: result.obj.times === 1
    };
    this.repository.saveSession(session);
    return { session, landingPath: getLandingPath(session) };
  }

  async register(form) {
    const error = validateRegister(form);
    if (error) throw new Error(error);
    const result = await this.repository.register(form);
    if (result.statusCode !== 1) throw new Error(result.message);
    return result;
  }

  async retrievePassword(form) {
    const error = validateFindPassword(form);
    if (error) throw new Error(error);
    const result = await this.repository.retrievePassword(form);
    if (result.statusCode !== 1) throw new Error(result.message);
    return result;
  }

  async changePassword(form, options = {}) {
    const error = validateChangePassword(form, options.requireOld !== false);
    if (error) throw new Error(error);
    const session = this.repository.getSession();
    const result = await this.repository.changePassword({
      userId: session?.id,
      oldPassword: form.oldPassword,
      password: form.password,
      confirmPassword: form.confirmPassword
    });
    if (result.statusCode !== 1) throw new Error(result.message);
    this.repository.clearSession();
    return result;
  }

  async getAgreement(type) {
    return this.repository.getAgreement(type);
  }

  logout() {
    return this.repository.logout();
  }
}
