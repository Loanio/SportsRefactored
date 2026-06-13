import { ApiClient, normalizeApiResult } from "../api/client.js";
import { buildHeartRatePayload, buildSleepPayload, normalizeBracelet } from "./domain.js";

const BraceletKey = "restored.bracelet.current";

export class BraceletRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.api = new ApiClient(storage);
  }

  async searchBracelet(payload) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/searchBracelet", payload));
      return asArray(result.obj).map(normalizeBracelet);
    }
    return delay([
      normalizeBracelet({ bindId: "M6w_001", macAddress: "00:11:22:33:44:55", model: "M6w", electric: "82%" }),
      normalizeBracelet({ bindId: "M6w_002", macAddress: "00:11:22:33:44:66", model: "M6w", electric: "64%" })
    ]);
  }

  async searchBraceletBox(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/lsusearchBraceletBox", payload));
    }
    return delay({ statusCode: 1, obj: [] });
  }

  async showCabinetBox(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/lsu/Bracelet/lsuShowCabinetBox", payload));
    }
    return delay({ statusCode: 1, obj: null });
  }

  async getBracelet(payload) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/getBracelet", payload));
      return { ...result, obj: normalizeBracelet(result.obj) };
    }
    return delay({ statusCode: 1, obj: this.getLocalBracelet() || normalizeBracelet({ model: "M6w", electric: "88%" }) });
  }

  async addBracelet(payload) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/addBracelet", payload));
      if (result.statusCode === 1) this.saveLocalBracelet(normalizeBracelet({ ...payload, ...(result.obj || {}) }));
      return result;
    }
    this.saveLocalBracelet(normalizeBracelet(payload));
    return delay({ statusCode: 1, message: "绑定成功", obj: payload });
  }

  async throwBracelet(payload) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/throwBracelet", payload));
      if (result.statusCode === 1) this.clearLocalBracelet();
      return result;
    }
    this.clearLocalBracelet();
    return delay({ statusCode: 1, message: "解绑成功" });
  }

  async allThrowBracelet(payload) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/allThrowBracelet", payload));
      if (result.statusCode === 1) this.clearLocalBracelet();
      return result;
    }
    this.clearLocalBracelet();
    return delay({ statusCode: 1, message: "解绑成功" });
  }

  async addHeartRate(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/heartRate/addHeartRate", payload));
    }
    return delay({ statusCode: 1, message: "心率同步成功", obj: payload });
  }

  async addSleepData(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/addSleep", payload));
    }
    return delay({ statusCode: 1, message: "睡眠同步成功", obj: payload });
  }

  async getHeartRate(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/heartRate/getHeartRate", payload));
    }
    return delay({ statusCode: 1, obj: buildHeartRatePayload(payload).data });
  }

  async getDayHeartRates(stuNum, time) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/heartRate/getDayHeartRates", { stuNum, time }));
    }
    return delay({ statusCode: 1, obj: buildHeartRatePayload({}).data });
  }

  async getWeekHeartRates(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/heartRate/getWeekHeartRates", payload));
    }
    return delay({ statusCode: 1, obj: [] });
  }

  async getSleep(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/getSleep", payload));
    }
    return delay({ statusCode: 1, obj: buildSleepPayload(payload).data });
  }

  async getWeekSleep(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/bracelet/getWeekSleep", payload));
    }
    return delay({ statusCode: 1, obj: [] });
  }

  async addFeedBack(userId, remark) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/lsu/BraceletFeedback/addFeedBack", { userId, remark }));
    }
    return delay({ statusCode: 1, message: "反馈已提交" });
  }

  saveLocalBracelet(bracelet) {
    this.storage.setItem(BraceletKey, JSON.stringify(bracelet));
  }

  getLocalBracelet() {
    try {
      return JSON.parse(this.storage.getItem(BraceletKey) || "null");
    } catch {
      return null;
    }
  }

  clearLocalBracelet() {
    this.storage.removeItem(BraceletKey);
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.records)) return value.records;
  return value ? [value] : [];
}

function delay(value, ms = 180) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}
