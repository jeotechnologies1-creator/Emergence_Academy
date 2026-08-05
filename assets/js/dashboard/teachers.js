const TeachersModule = window.OfficeModuleEngine.create({
  moduleKey: "teachers",
  title: "Teachers",
  tableName: "teachers",
  orderBy: "created_at",
  columns: [
    { key: "employee_id", label: "Employee ID" },
    { key: "department", label: "Department" },
    { key: "qualification", label: "Qualification" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" }
  ],
  formFields: ["employee_id", "department", "qualification", "status"],
  requiredFields: ["employee_id", "department", "status"],
  permissions: {
    create: ["ceo", "admin", "executive", "hr"],
    edit: ["ceo", "admin", "executive", "hr"],
    delete: ["ceo", "admin", "executive"]
  },
  softDelete: true,
  softDeleteField: "status",
  softDeleteValue: "inactive",
  softRestoreValue: "active",
  fieldOptions: {
    status: ["active", "inactive", "suspended", "pending"]
  }
});

window.TeachersModule = TeachersModule;
