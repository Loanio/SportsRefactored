import { ApiClient, normalizeApiResult } from "../api/client.js";
import { ExerciseKind, finishSession } from "./domain.js";

const StorageKeys = {
  RUN: "restored.exercise.rundata",
  OTHER: "restored.exercise.otherexercise"
};

const delay = (value, ms = 180) => new Promise(resolve => setTimeout(() => resolve(value), ms));

export class ExerciseRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.api = new ApiClient(storage);
  }

  async getExerciseEvents() {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.get("/tyapi/mobile/exerciseRecord/getExerciseEvent"));
      return asArray(result.obj).map(normalizeEvent);
    }

    return delay([
      event("run", "跑步", ExerciseKind.RUN, "run.png", "#4DA282"),
      event("basketball", "篮球", ExerciseKind.OTHER, "basketball.png", "#667BBF"),
      event("football", "足球", ExerciseKind.OTHER, "football.png", "#FFB612"),
      event("badminton", "羽毛球", ExerciseKind.OTHER, "badminton.png", "#33AEFE"),
      event("pingpong", "乒乓球", ExerciseKind.OTHER, "pingpong.png", "#FA904F"),
      event("dumbbell", "力量训练", ExerciseKind.OTHER, "dumbbell.png", "#4DA282"),
      event("pool", "游泳", ExerciseKind.OTHER, "pool.png", "#667BBF"),
      event("tennis", "网球", ExerciseKind.OTHER, "tennis.png", "#FFB612")
    ]);
  }

  async getExerciseInstructions() {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.get("/tyapi/mobile/exerciseRecord/getExerciseInstructions"));
      const obj = result.obj || {};
      return {
        open: obj.open ?? obj.isOpen ?? true,
        article: obj.article || obj.content || obj.explain || ""
      };
    }

    return delay({
      open: true,
      article: "请确认本人参与锻炼，选择真实场地；跑步需开启定位，非跑步项目需保持计时页面运行。运动结束后请及时上传，30分钟内可继续未完成记录。"
    });
  }

  async getRunPlaces() {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/run/getSelectEventId"));
      return asArray(result.obj).map(item => normalizePlace(item, item.eventId || item.exerciseEventId || "run"));
    }

    return delay([
      place("run-north", "北区田径场", "venue-001", "run"),
      place("run-south", "南区操场", "venue-002", "run")
    ]);
  }

  async getExerciseLocationAreas(eventId) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getExerciseLocationAreas", { eventId }));
      return asArray(result.obj).map(item => normalizePlace(item, eventId));
    }

    const data = {
      basketball: [place("bb-1", "篮球场1", "venue-bb", eventId), place("bb-2", "篮球场2", "venue-bb", eventId)],
      football: [place("fb-1", "足球场", "venue-fb", eventId)],
      badminton: [place("bd-1", "羽毛球馆A区", "venue-bd", eventId), place("bd-2", "羽毛球馆B区", "venue-bd", eventId)],
      pingpong: [place("pp-1", "乒乓球室", "venue-pp", eventId)],
      dumbbell: [place("gym-1", "体能训练房", "venue-gym", eventId)],
      pool: [place("pool-1", "游泳馆", "venue-pool", eventId)],
      tennis: [place("tn-1", "网球场", "venue-tn", eventId)]
    };
    return delay(data[eventId] || [place(`${eventId}-1`, "默认场地", `venue-${eventId}`, eventId)]);
  }

  async getSemesterSummary(userId) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getSemesterSummary", { info: { userId } }));
      return normalizeSummary(result.obj);
    }

    return delay({
      number: 12,
      effectiveDistance: 28.6,
      stringList: [
        "跑步类项目需在指定区域内完成。",
        "非跑步项目以有效运动时长计入统计。",
        "离线记录请在网络恢复后尽快上传。"
      ],
      eventResList: [
        { eventName: "跑步", number: 6, effectiveDistance: 18.2 },
        { eventName: "篮球", number: 3, effectiveDistance: 0 },
        { eventName: "羽毛球", number: 3, effectiveDistance: 0 }
      ]
    });
  }

  async getSemesterExerciseList(userId) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getSemesterExerciseList", { userId }));
      return asArray(result.obj).map(normalizeTarget);
    }

    return delay([
      target("跑步", true, true, 32, 60, 6, 12, 0),
      target("球类运动", false, true, 0, 0, 9, 16, 1),
      target("有效里程", true, false, 28.6, 80, 0, 0, 0)
    ]);
  }

  async judgeClientId(payload) {
    if (this.api.isRealMode()) {
      const result = normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/judgeClientId", payload));
      return result.obj || result.raw || { judgeClientId: false };
    }

    return delay({ judgeClientId: false });
  }

  async getStatus() {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.get("/tyapi/mobile/exerciseRecord/getStatus"));
    }
    return delay({ statusCode: 1, obj: [{ id: "normal", name: "正常" }, { id: "appeal", name: "申诉中" }] });
  }

  async getAllMessage(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getAllMessage", payload));
    }
    return delay({ statusCode: 1, obj: [{ source: "通知公告", content: "课外锻炼模拟消息" }] });
  }

  async getHistoryList(userId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getHistoryList", { userId }));
    }
    return delay({ statusCode: 1, obj: this.read(ExerciseKind.RUN).concat(this.read(ExerciseKind.OTHER)) });
  }

  async getTimeSummary(userId, eventId, termId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getTimeSummary", { userId, eventId, termId }));
    }
    return delay({ statusCode: 1, obj: { timeList: ["周一", "周二", "周三"], dataList: [1, 0, 2] } });
  }

  async getRunCountNum(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getRunCountNum", payload));
    }
    return delay({ statusCode: 1, obj: { count: this.read(ExerciseKind.RUN).length } });
  }

  async getPolygonsMarker(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getPolygonsMarker", payload));
    }
    return delay({ statusCode: 1, obj: { points: [], center: "121.4700,31.2300" } });
  }

  async getRunPolygonsMarker(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/run/getPolygonsMarker", payload));
    }
    return delay({ statusCode: 1, obj: { points: [], center: "121.4700,31.2300" } });
  }

  async getCheckPoint(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/run/getCheckPoint", payload));
    }
    return delay({ statusCode: 1, obj: [] });
  }

  async getRunRecordInfo(exerciseRecordId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getRunRecordInfo", { exerciseRecordId }));
    }
    return delay({ statusCode: 1, obj: null });
  }

  async getRunViolations(exerciseRecordId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/getRunViolationsV1_2_16", { exerciseRecordId }));
    }
    return delay({ statusCode: 1, obj: [] });
  }

  async judgeUploaded(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/judgeUploaded", payload));
    }
    return delay({ statusCode: 1, obj: { isdel: false } });
  }

  async judgeLocalUploaded(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/judgeLocalUploaded", payload));
    }
    return delay({ statusCode: 1, obj: { isdel: false } });
  }

  async updateRunRecord(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/run/updateRecord", payload));
    }
    return delay({ statusCode: 1, obj: { remark: "模拟通过", exerciseStatus: "normal" } });
  }

  async updateRunFiles(payload) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/run/updateFiles", payload));
    }
    return delay({ statusCode: 1, obj: null });
  }

  async startSession(session) {
    if (!this.api.isRealMode()) return delay({ statusCode: 1, message: "开始成功" });
    const result = normalizeApiResult(await this.api.post("/tyapi/mobile/exerciseRecord/startExercise", {
      userId: session.userId,
      eventId: session.eventId,
      venueId: session.venueId,
      exerciseLocationId: session.exerciseLocationId,
      startTime: session.startTime,
      jobNum: session.jobNum,
      bindId: session.bindId
    }));
    if (result.statusCode !== 1) throw new Error(result.message || "开始锻炼失败");
    return result;
  }

  async uploadSession(session) {
    if (this.api.isRealMode()) {
      const path = session.runInfo ? "/tyapi/mobile/run/endRun" : "/tyapi/mobile/exerciseRecord/endExercise";
      const result = normalizeApiResult(await this.api.post(path, session));
      return {
        ok: result.statusCode === 1,
        code: result.statusCode,
        message: result.message || (result.statusCode === 1 ? "上传成功" : "上传失败"),
        raw: result.raw
      };
    }

    const payload = JSON.stringify(session);
    if (payload.includes("force-error")) return delay({ ok: false, code: 2, message: "服务端拒绝该条记录" });
    return delay({ ok: true, code: 1, message: "上传成功" }, 420);
  }

  async listLocalSessions(kind) {
    return this.read(kind);
  }

  async saveLocalSession(session) {
    const kind = session.kind;
    const rows = this.read(kind).filter(row => row.id !== session.id);
    rows.push(session);
    this.write(kind, rows);
    return session;
  }

  async finishAndSave(session, metrics) {
    return this.saveLocalSession(finishSession(session, metrics));
  }

  async removeLocalSession(kind, id) {
    this.write(kind, this.read(kind).filter(row => row.id !== id));
  }

  read(kind) {
    const key = kind === ExerciseKind.RUN ? StorageKeys.RUN : StorageKeys.OTHER;
    try {
      return JSON.parse(this.storage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  write(kind, rows) {
    const key = kind === ExerciseKind.RUN ? StorageKeys.RUN : StorageKeys.OTHER;
    this.storage.setItem(key, JSON.stringify(rows));
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.rows)) return value.rows;
  return value ? [value] : [];
}

function normalizeEvent(item) {
  const name = item.name || item.eventName || item.title || "运动项目";
  const id = String(item.id || item.eventId || item.exerciseEventId || name);
  const isRun = item.run ?? item.isRun ?? /跑/.test(name);
  return event(
    id,
    name,
    isRun ? ExerciseKind.RUN : ExerciseKind.OTHER,
    iconForName(name),
    colorForName(name)
  );
}

function normalizePlace(item, eventId) {
  return {
    id: String(item.id || item.exerciseLocationId || item.locationId || item.eventId || item.name),
    name: item.name || item.eventName || item.locationName || item.venueName || "运动场地",
    venueId: item.venueId || item.venueID || item.id || "",
    exerciseEventId: String(item.exerciseEventId || item.eventId || eventId),
    centralPoint: item.centralPoint || item.centerPoint || item.point || ""
  };
}

function normalizeSummary(obj = {}) {
  return {
    number: Number(obj.number || obj.count || 0),
    effectiveDistance: Number(obj.effectiveDistance || obj.distance || 0),
    stringList: obj.stringList || obj.instructions || [],
    eventResList: obj.eventResList || obj.list || []
  };
}

function normalizeTarget(item) {
  const info = item.info || item;
  const eventName = info.eventName || item.eventName || item.name || "运动项目";
  return {
    ...item,
    info: { ...info, eventName },
    targetDis: Boolean(item.targetDis ?? item.targetDistance),
    targetNum: Boolean(item.targetNum ?? item.targetNumber),
    effectiveDistance: Number(item.effectiveDistance || 0),
    targetDistance: Number(item.targetDistance || 0),
    number: Number(item.number || 0),
    targetNumber: Number(item.targetNumber || 0),
    vioNum: Number(item.vioNum || 0),
    effectiveDistanceString: item.effectiveDistanceString || `${item.effectiveDistance || 0}km`,
    targetDistanceString: item.targetDistanceString || `${item.targetDistance || 0}km`,
    numberString: item.numberString || `${item.number || 0}次`,
    targetNumberString: item.targetNumberString || `${item.targetNumber || 0}次`,
    targetDistanceText: item.targetDistanceText || "目标里程",
    targetNumberText: item.targetNumberText || "目标次数"
  };
}

function iconForName(name) {
  if (/篮/.test(name)) return "basketball.png";
  if (/足/.test(name)) return "football.png";
  if (/羽/.test(name)) return "badminton.png";
  if (/乒/.test(name)) return "pingpong.png";
  if (/泳/.test(name)) return "pool.png";
  if (/网/.test(name)) return "tennis.png";
  if (/力量|健身|训练/.test(name)) return "dumbbell.png";
  return "run.png";
}

function colorForName(name) {
  if (/篮|泳/.test(name)) return "#667BBF";
  if (/足|网/.test(name)) return "#FFB612";
  if (/羽/.test(name)) return "#33AEFE";
  if (/乒/.test(name)) return "#FA904F";
  return "#4DA282";
}

function event(id, name, kind, icon, color) {
  return { id, name, kind, icon: `./static/img/ball/${icon}`, color, run: kind === ExerciseKind.RUN };
}

function place(id, name, venueId, exerciseEventId) {
  return { id, name, venueId, exerciseEventId, centralPoint: "121.4700,31.2300" };
}

function target(eventName, targetDis, targetNum, effectiveDistance, targetDistance, number, targetNumber, vioNum) {
  return {
    info: { eventName },
    targetDis,
    targetNum,
    effectiveDistance,
    targetDistance,
    number,
    targetNumber,
    vioNum,
    effectiveDistanceString: `${effectiveDistance}km`,
    targetDistanceString: `${targetDistance}km`,
    numberString: `${number}次`,
    targetNumberString: `${targetNumber}次`,
    targetDistanceText: "目标里程",
    targetNumberText: "目标次数"
  };
}
