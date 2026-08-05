const ReportsModule = window.OfficeModuleEngine.create({
  moduleKey: "reports",
  title: "Reports",
  tableName: "activity_logs",
  orderBy: "created_at",
  readOnly: true,
  columns: [
    { key: "action", label: "Action" },
    { key: "details", label: "Details" },
    { key: "user_id", label: "User" },
    { key: "created_at", label: "Created" }
  ]
});

window.ReportsModule = ReportsModule;
