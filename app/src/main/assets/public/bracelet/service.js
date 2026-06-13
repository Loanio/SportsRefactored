import { buildHeartRatePayload, buildSleepPayload, normalizeBracelet } from "./domain.js";

export class BraceletService {
  constructor(repository, user) {
    this.repository = repository;
    this.user = user;
  }

  async bootstrap() {
    const local = this.repository.getLocalBracelet();
    if (!local && !this.user.bindId) return { bracelet: null };
    const bindId = local?.bindId || this.user.bindId;
    const result = await this.repository.getBracelet({ bindId, userId: this.user.id });
    return { bracelet: result.statusCode === 1 ? result.obj : local };
  }

  async search(keyword = "") {
    return this.repository.searchBracelet({
      userId: this.user.id,
      name: keyword,
      bindId: this.user.bindId
    });
  }

  async bind(bracelet) {
    const payload = {
      userId: this.user.id,
      stuNum: this.user.jobNum,
      bindId: bracelet.bindId || bracelet.name,
      macAddress: bracelet.macAddress,
      model: bracelet.model,
      braceletId: bracelet.name || bracelet.bindId
    };
    const result = await this.repository.addBracelet(payload);
    if (result.statusCode !== 1) throw new Error(result.message || "绑定失败");
    return normalizeBracelet(payload);
  }

  async unbind(all = true) {
    const bracelet = this.repository.getLocalBracelet();
    const payload = {
      userId: this.user.id,
      bindId: bracelet?.bindId || this.user.bindId,
      macAddress: bracelet?.macAddress || this.user.macAddress
    };
    const result = all ? await this.repository.allThrowBracelet(payload) : await this.repository.throwBracelet(payload);
    if (result.statusCode !== 1) throw new Error(result.message || "解绑失败");
    return result;
  }

  async syncHealthData() {
    const bracelet = this.repository.getLocalBracelet();
    const bindId = bracelet?.bindId || this.user.bindId;
    if (!bindId) throw new Error("请先绑定手环");
    const [heartRate, sleep] = await Promise.all([
      this.repository.addHeartRate(buildHeartRatePayload({ bindId })),
      this.repository.addSleepData(buildSleepPayload({ bindId }))
    ]);
    return { heartRate, sleep };
  }

  async loadReports() {
    const bracelet = this.repository.getLocalBracelet();
    const bindId = bracelet?.bindId || this.user.bindId;
    const today = new Date().toISOString().slice(0, 10);
    const [heartRate, dayHeart, weekHeart, sleep, weekSleep] = await Promise.all([
      this.repository.getHeartRate({ bindId, userId: this.user.id }),
      this.repository.getDayHeartRates(this.user.jobNum, today),
      this.repository.getWeekHeartRates({ bindId, userId: this.user.id }),
      this.repository.getSleep({ bindId, userId: this.user.id }),
      this.repository.getWeekSleep({ bindId, userId: this.user.id })
    ]);
    return { heartRate, dayHeart, weekHeart, sleep, weekSleep };
  }

  async submitFeedback(remark) {
    return this.repository.addFeedBack(this.user.id, remark);
  }
}
