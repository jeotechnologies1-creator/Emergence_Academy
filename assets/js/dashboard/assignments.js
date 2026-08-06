const AssignmentModule = window.OfficeModuleEngine.create({
  moduleKey: "assignments",
  title: "Assignments",
  tableName: "assignments",
  orderBy: "due_date",
  columns: [
    { key: "title", label: "Title" },
    { key: "subject_id", label: "Subject" },
    { key: "class_id", label: "Class" },
    { key: "due_date", label: "Due Date" },
    { key: "status", label: "Status" }
  ],
  formFields: ["title", "description", "subject_id", "teacher_id", "class_id", "due_date", "status"],
  requiredFields: ["title", "subject_id", "teacher_id", "class_id", "due_date", "status"],
  fieldTypes: {
    due_date: "date"
  },
  fieldRules: {
    due_date: { notPast: true }
  },
  permissions: {
    create: ["ceo", "admin", "executive", "teacher", "exam"],
    edit: ["ceo", "admin", "executive", "teacher", "exam"],
    delete: ["ceo", "admin", "executive"]
  },
  softDelete: true,
  softDeleteField: "status",
  softDeleteValue: "archived",
  softRestoreValue: "draft",
  fieldOptions: {
    status: ["draft", "published", "closed", "archived"]
  },
  lookups: {
    subject_id: { table: "subjects" },
    teacher_id: { table: "teachers", preferProfileName: true },
    class_id: { table: "classes" }
  }
});

window.AssignmentModule = AssignmentModule;
