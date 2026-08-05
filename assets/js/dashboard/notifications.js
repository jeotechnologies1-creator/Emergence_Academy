const NotificationModule = window.OfficeModuleEngine.create({
  moduleKey: "notifications",
  title: "Notifications",
  tableName: "notifications",
  orderBy: "created_at",
  columns: [
    { key: "title", label: "Title" },
    { key: "message", label: "Message" },
    { key: "target_role", label: "Target Role" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" }
  ],
  formFields: ["title", "message", "target_role", "status"],
  requiredFields: ["title", "message", "target_role", "status"],
  permissions: {
    create: ["ceo", "admin", "executive", "hr", "admission", "exam", "library", "finance"],
    edit: ["ceo", "admin", "executive", "hr", "admission", "exam", "library", "finance"],
    delete: ["ceo", "admin", "executive"]
  },
  softDelete: true,
  softDeleteField: "status",
  softDeleteValue: "archived",
  softRestoreValue: "draft",
  fieldOptions: {
    target_role: ["all", "ceo", "admin", "executive", "teacher", "student", "parent", "finance", "hr", "admission", "exam", "library"],
    status: ["draft", "scheduled", "sent", "archived"]
  }
});

window.NotificationModule = NotificationModule;
