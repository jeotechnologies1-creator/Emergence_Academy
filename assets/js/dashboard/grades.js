const OfficeGradesModule = window.OfficeModuleEngine.create({
  moduleKey: "grades",
  title: "Grades",
  tableName: "grades",
  orderBy: "created_at",
  columns: [
    { key: "student_id", label: "Student" },
    { key: "subject_id", label: "Subject" },
    { key: "teacher_id", label: "Teacher" },
    { key: "score", label: "Score" },
    { key: "grade", label: "Grade" },
    { key: "term_id", label: "Term" }
  ],
  formFields: ["student_id", "subject_id", "teacher_id", "term_id", "score", "grade", "remarks"],
  requiredFields: ["student_id", "subject_id", "teacher_id", "term_id", "score", "grade"],
  fieldTypes: {
    score: "number"
  },
  fieldRules: {
    score: { min: 0, max: 100 }
  },
  fieldOptions: {
    grade: ["A", "B", "C", "D", "E", "F"]
  },
  permissions: {
    create: ["ceo", "admin", "executive", "teacher", "exam"],
    edit: ["ceo", "admin", "executive", "teacher", "exam"],
    delete: ["ceo", "admin", "executive"]
  },
  lookups: {
    student_id: {
      table: "students",
      preferProfileName: true,
      labelResolver: (row, context = {}) => {
        const studentNo = String(row?.student_no || row?.admission_number || "").trim();
        const suffix = studentNo ? ` - ${studentNo}` : "";
        return `${context.profileName || "Student"}${suffix}`.trim();
      }
    },
    subject_id: { table: "subjects" },
    teacher_id: { table: "teachers", preferProfileName: true },
    term_id: { table: "terms", labelKey: "term_name" }
  }
});

class ParentPerformanceModule {
  static state = { container: null, students: [], grades: [], attendance: [] };
  static safe(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  static studentLabel(student) {
    const name = `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() || "Student";
    return student.student_no || student.admission_number ? `${name} (${student.student_no || student.admission_number})` : name;
  }
  static async load() {
    const [studentsResult, gradesResult, attendanceResult] = await Promise.all([
      API.db.from("students").select("id,student_no,admission_number,profiles:profile_id(first_name,last_name)").order("student_no"),
      API.db.from("grades").select("id,student_id,score,grade,remarks,created_at,subjects:subject_id(subject_name,subject_code)").order("created_at", { ascending: false }),
      API.db.from("attendance").select("id,student_id,status,date,created_at").order("date", { ascending: false })
    ]);
    if (studentsResult.error || gradesResult.error || attendanceResult.error) throw studentsResult.error || gradesResult.error || attendanceResult.error;
    this.state.students = studentsResult.data || [];
    this.state.grades = gradesResult.data || [];
    this.state.attendance = attendanceResult.data || [];
  }
  static renderRows(studentId) {
    const grades = this.state.grades.filter((row) => !studentId || String(row.student_id) === studentId);
    const attendance = this.state.attendance.filter((row) => !studentId || String(row.student_id) === studentId);
    const recorded = attendance.length;
    const present = attendance.filter((row) => String(row.status || "").toLowerCase() === "present").length;
    const average = grades.length ? (grades.reduce((total, row) => total + Number(row.score || 0), 0) / grades.length).toFixed(1) : "—";
    return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-3"><div class="rounded-xl bg-blue-50 p-4"><p class="text-sm text-blue-700">Average score</p><p class="mt-1 text-2xl font-bold text-blue-950">${this.safe(average)}${average === "—" ? "" : "%"}</p></div><div class="rounded-xl bg-emerald-50 p-4"><p class="text-sm text-emerald-700">Attendance</p><p class="mt-1 text-2xl font-bold text-emerald-950">${recorded ? `${present}/${recorded}` : "—"}</p></div><div class="rounded-xl bg-violet-50 p-4"><p class="text-sm text-violet-700">Recorded grades</p><p class="mt-1 text-2xl font-bold text-violet-950">${grades.length}</p></div></div><section class="mt-6 rounded-xl bg-white p-5 shadow"><h3 class="text-lg font-bold text-slate-800">Academic performance</h3><div class="mt-4 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b text-left text-slate-600"><th class="p-2">Subject</th><th class="p-2">Score</th><th class="p-2">Grade</th><th class="p-2">Remarks</th><th class="p-2">Recorded</th></tr></thead><tbody>${grades.length ? grades.map((row) => `<tr class="border-b border-slate-100"><td class="p-2">${this.safe(row.subjects?.subject_name || row.subjects?.subject_code || "Subject")}</td><td class="p-2">${this.safe(row.score)}</td><td class="p-2 font-medium">${this.safe(row.grade)}</td><td class="p-2">${this.safe(row.remarks || "—")}</td><td class="p-2">${this.safe(row.created_at ? new Date(row.created_at).toLocaleDateString() : "—")}</td></tr>`).join("") : '<tr><td colspan="5" class="p-6 text-center text-slate-500">No grades have been recorded yet.</td></tr>'}</tbody></table></div></section><section class="mt-6 rounded-xl bg-white p-5 shadow"><h3 class="text-lg font-bold text-slate-800">Recent attendance</h3><div class="mt-4 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b text-left text-slate-600"><th class="p-2">Date</th><th class="p-2">Status</th></tr></thead><tbody>${attendance.length ? attendance.slice(0, 20).map((row) => `<tr class="border-b border-slate-100"><td class="p-2">${this.safe(row.date ? new Date(row.date).toLocaleDateString() : "—")}</td><td class="p-2 capitalize">${this.safe(row.status || "—")}</td></tr>`).join("") : '<tr><td colspan="2" class="p-6 text-center text-slate-500">No attendance has been recorded yet.</td></tr>'}</tbody></table></div></section>`;
  }
  static template() {
    const students = this.state.students;
    return `<div class="space-y-6"><div class="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-6 text-white shadow"><h2 class="text-3xl font-bold">Child Performance</h2><p class="mt-2 text-indigo-100">Review grades and attendance for children linked to your account.</p></div><section class="rounded-xl bg-white p-5 shadow"><label class="block max-w-xl"><span class="text-sm font-medium text-slate-700">Child</span><select id="parent-performance-student" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">All linked children</option>${students.map((student) => `<option value="${this.safe(student.id)}">${this.safe(this.studentLabel(student))}</option>`).join("")}</select></label></section><div id="parent-performance-content">${this.renderRows("")}</div></div>`;
  }
  static async render(container) {
    this.state.container = container;
    container.innerHTML = '<div class="rounded-xl bg-white p-8 text-slate-500 shadow">Loading child performance…</div>';
    try {
      await this.load();
      container.innerHTML = this.template();
      container.querySelector("#parent-performance-student")?.addEventListener("change", (event) => {
        container.querySelector("#parent-performance-content").innerHTML = this.renderRows(String(event.currentTarget.value || ""));
      });
    } catch (error) {
      console.error(error);
      container.innerHTML = `<div class="rounded-xl bg-white p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load child performance.")}</div>`;
    }
  }
}

class GradesModule {
  static async render(container) {
    const profile = await Auth.profile(true);
    return String(profile?.role || "").toLowerCase() === "parent"
      ? ParentPerformanceModule.render(container)
      : OfficeGradesModule.render(container);
  }
}

window.GradesModule = GradesModule;
