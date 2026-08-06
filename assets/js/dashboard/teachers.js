const TeachersModule = window.OfficeModuleEngine.create({
  moduleKey: "teachers",
  title: "Teachers",
  tableName: "teachers",
  orderBy: "created_at",
  columns: [
    { key: "profile_id", label: "Name" },
    { key: "employee_id", label: "Employee ID" },
    { key: "department_id", label: "Department" },
    { key: "qualification", label: "Qualification" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" }
  ],
  formFields: ["full_name", "email", "phone", "password", "employee_id", "department_name", "qualification", "status"],
  editFormFields: ["employee_id", "department_id", "qualification", "status"],
  requiredFields: ["full_name", "email", "employee_id", "department_name", "status"],
  editRequiredFields: ["employee_id", "department_id", "status"],
  fieldTypes: {
    email: "email"
  },
  fieldGenerators: {
    employee_id: () => `EA-EMP-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`
  },
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
  },
  lookups: {
    department_id: { table: "departments", labelKey: "name" }
  },
  createRecord: (payload) => API.teachers.createAccount(payload)
});

window.TeachersModule = TeachersModule;
