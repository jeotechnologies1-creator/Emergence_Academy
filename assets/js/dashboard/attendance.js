const AttendanceModule = window.OfficeModuleEngine.create({
  moduleKey: "attendance",
  title: "Attendance",
  tableName: "attendance",
  orderBy: "date",
  columns: [
    { key: "date", label: "Date" },
    { key: "student_id", label: "Student" },
    { key: "class_id", label: "Class" },
    { key: "subject_id", label: "Subject" },
    { key: "status", label: "Status" },
    { key: "remark", label: "Remark" }
  ],
  formFields: ["date", "student_id", "class_id", "subject_id", "status", "remark"],
  requiredFields: ["date", "student_id", "class_id", "status"],
  fieldTypes: {
    date: "date"
  },
  fieldRules: {
    date: { notFuture: true }
  },
  fieldOptions: {
    status: ["present", "absent", "late", "excused"]
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
        const suffix = studentNo ? ` (${studentNo})` : "";
        return `${context.profileName || "Student"}${suffix}`.trim();
      }
    },
    class_id: { table: "classes" },
    subject_id: { table: "subjects", labelKey: "subject_name" }
  }
});

window.AttendanceModule = AttendanceModule;
