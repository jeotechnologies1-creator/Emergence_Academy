const NotificationModule = window.OfficeModuleEngine.create({
  moduleKey: "notifications",
  title: "Notifications",
  tableName: "notifications",
  orderBy: "created_at",
  columns: [
    { key: "title", label: "Title" },
    { key: "message", label: "Message" },
    { key: "user_id", label: "Recipient" },
    { key: "target_role", label: "Target Role" },
    { key: "created_at", label: "Created" }
  ],
  formFields: ["title", "message", "user_id", "target_role"],
  requiredFields: ["title", "message", "user_id", "target_role"],
  permissions: {
    create: ["ceo", "admin", "executive", "hr", "admission", "exam", "library", "finance"],
    edit: ["ceo", "admin", "executive", "hr", "admission", "exam", "library", "finance"],
    delete: ["ceo", "admin", "executive"]
  },
  fieldOptions: {
    target_role: ["all", "ceo", "admin", "executive", "teacher", "student", "parent", "finance", "hr", "admission", "exam", "library"]
  },
  lookups: {
    user_id: { table: "profiles", labelKey: "email" }
  }
});

const NotificationModuleWithReadSync = {
  ...NotificationModule,
  async render(container) {
    await NotificationModule.render(container);
    await window.NotificationBell?.markNotificationsViewed?.();
    await window.NotificationBell?.updateDashboardNotificationCount?.();
  }
};

window.NotificationModule = NotificationModuleWithReadSync;
