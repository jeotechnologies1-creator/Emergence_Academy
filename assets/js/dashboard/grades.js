const GradesModule = window.OfficeModuleEngine.create({
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
  requiredFields: ["student_id", "subject_id", "teacher_id", "score", "grade"],
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

window.GradesModule = GradesModule;
