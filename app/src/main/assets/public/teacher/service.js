export class TeacherManageService {
  constructor(repository, user) {
    this.repository = repository;
    this.user = user;
  }

  async loadHome() {
    const termsResult = await this.repository.getTermList();
    const terms = normalizeList(termsResult.obj);
    const currentTerm = terms.find(item => item.isCurrent) || terms[0] || { id: "", name: "当前学期" };
    const [classesResult, modulesResult] = await Promise.all([
      this.repository.getEduClass(this.user.id, currentTerm.id),
      this.repository.getModuleList(this.user.id)
    ]);
    const classes = normalizeList(classesResult.obj);
    return {
      terms,
      currentTerm,
      classes,
      modules: flattenModules(modulesResult.obj?.moduleList || [])
    };
  }

  async changeTerm(termId) {
    const result = await this.repository.getEduClass(this.user.id, termId);
    return normalizeList(result.obj);
  }

  async loadClassDashboard(eduClassId) {
    const [info, students, sign, history, projects, grades, gradeAnalysis, exerciseAnalysis] = await Promise.all([
      this.repository.getEduClassInfo(eduClassId),
      this.repository.getStudentList(eduClassId),
      this.repository.getSignClassInfo(eduClassId),
      this.repository.getSignClassHistory(this.user.id, eduClassId),
      this.repository.getTestProject(this.user.type || "教师", eduClassId),
      this.repository.getGrade(eduClassId),
      this.repository.gradeAnalysis(eduClassId),
      this.repository.exerciseAnalysis(eduClassId)
    ]);

    return {
      course: info.obj || {},
      students: normalizeList(students.obj),
      sign: sign.obj || {},
      history: normalizeList(history.obj),
      projects: normalizeList(projects.obj?.data || projects.obj),
      grades: normalizeList(grades.obj),
      gradeAnalysis: gradeAnalysis.obj || {},
      exerciseAnalysis: exerciseAnalysis.obj || {}
    };
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.records)) return value.records;
  return value ? [value] : [];
}

function flattenModules(groups) {
  const rows = [];
  groups.forEach(group => {
    (group.childrenBtn || group.children || []).forEach(item => rows.push(item));
  });
  return rows.length ? rows : [
    { code: "SKKQ", name: "上课考勤" },
    { code: "XSLB", name: "学生列表" },
    { code: "DLSJ", name: "锻炼数据" },
    { code: "SHGL", name: "手环管理" },
    { code: "SKXL", name: "上课心率" },
    { code: "SJFX", name: "数据分析" },
    { code: "TCCJ", name: "体测成绩" },
    { code: "CJBZ", name: "成绩备注" }
  ];
}
