import { ApiClient, normalizeApiResult } from "../api/client.js";

export class TeacherManageRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.api = new ApiClient(storage);
  }

  async getTermList() {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/grade/getTermList"));
    }
    return mockResult([
      { id: "term-2026-spring", name: "2025-2026 第二学期", isCurrent: true },
      { id: "term-2025-autumn", name: "2025-2026 第一学期", isCurrent: false }
    ]);
  }

  async getEduClass(userId, termId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/teaching/eduClass", { userId, termId }));
    }
    return mockResult([
      course("class-001", "篮球专项一班", "周一 3-4节", "体育馆篮球场", 42),
      course("class-002", "大学体育-羽毛球", "周三 5-6节", "羽毛球馆 A区", 36),
      course("class-003", "体能训练", "周五 7-8节", "田径场", 48)
    ]);
  }

  async getEduClassInfo(eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/teaching/eduClassInfo", { eduClassId }));
    }
    return mockResult({ ...course(eduClassId, "篮球专项一班", "周一 3-4节", "体育馆篮球场", 42), reportCard: true });
  }

  async getModuleList(userId, system = "Android", number = "2.6.4") {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/grade/getModuleList", { id: userId, system, number, onlyPage: false }));
    }
    return mockResult({ moduleList: moduleGroups() });
  }

  async getStudentList(eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/teaching/getStudentList", { eduClassId }));
    }
    return mockResult([
      student("stu-1", "王同学", "20260001", "已签到", 86),
      student("stu-2", "陈同学", "20260002", "迟到", 78),
      student("stu-3", "刘同学", "20260003", "未签到", 63)
    ]);
  }

  async getSignClassInfo(eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/sign/getSignClassInfo", { eduClassId }));
    }
    return mockResult({ signInNumber: 30, activityNumber: 42, leaveNumber: 3, absentNumber: 9, status: "进行中" });
  }

  async getSignClassHistory(userId, eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/sign/getSignClassHistory", { userId, eduClassId }));
    }
    return mockResult([
      { id: "sign-1", date: "2026-06-08", signInNumber: 37, absentNumber: 5 },
      { id: "sign-2", date: "2026-06-01", signInNumber: 39, absentNumber: 3 }
    ]);
  }

  async getTestProject(type, eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/grade/getTestProjectV_2_2_3", { type, eduClassId }));
    }
    return mockResult({ teachingType: true, data: [
      { typeId: "body", typeName: "身体素质" },
      { typeId: "skill", typeName: "专项技术" },
      { typeId: "normal", typeName: "平时成绩" }
    ] });
  }

  async getGrade(eduClassId, typeName = "总成绩", subId = "", sortWay = "desc") {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/grade/getGrade", { eduClassId, typeName, subId, sortWay }));
    }
    return mockResult([
      { name: "王同学", jobNum: "20260001", score: 86, rank: 1 },
      { name: "陈同学", jobNum: "20260002", score: 78, rank: 2 },
      { name: "刘同学", jobNum: "20260003", score: 63, rank: 3 }
    ]);
  }

  async gradeAnalysis(eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/dataAnalysis/gradeAnalysis", { eduClassId }));
    }
    return mockResult({ avgScore: 76.4, passRate: 0.86, excellentRate: 0.21 });
  }

  async exerciseAnalysis(eduClassId) {
    if (this.api.isRealMode()) {
      return normalizeApiResult(await this.api.post("/tyapi/mobile/dataAnalysis/exerciseAnalysis", { eduClassId }));
    }
    return mockResult({ finishRate: 0.73, avgDistance: 18.6, activeNumber: 31 });
  }
}

function course(classId, name, week, address, studentCount) {
  return { classId, id: classId, name, courseName: name, week, jc: "", address, studentCount };
}

function student(id, name, jobNum, signInStatus, score) {
  return { id, eduClassStudentId: id, name, jobNum, signInStatus, score };
}

function moduleGroups() {
  return [{
    name: "教学班功能",
    childrenBtn: [
      { code: "SKKQ", name: "上课考勤" },
      { code: "XSLB", name: "学生列表" },
      { code: "DLSJ", name: "锻炼数据" },
      { code: "SHGL", name: "手环管理" },
      { code: "SKXL", name: "上课心率" },
      { code: "SJFX", name: "数据分析" },
      { code: "TCCJ", name: "体测成绩" },
      { code: "CJBZ", name: "成绩备注" }
    ]
  }];
}

function mockResult(obj) {
  return new Promise(resolve => setTimeout(() => resolve({ statusCode: 1, message: "ok", obj }), 160));
}
