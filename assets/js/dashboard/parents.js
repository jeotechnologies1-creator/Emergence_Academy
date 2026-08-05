const ParentsModule = window.OfficeModuleEngine.create({
  moduleKey: "parents",
  title: "Parents",
  tableName: "parents",
  orderBy: "created_at",
  columns: [
    { key: "occupation", label: "Occupation" },
    { key: "relationship", label: "Relationship" },
    { key: "address", label: "Address" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" }
  ],
  formFields: ["occupation", "relationship", "address", "status"],
  requiredFields: ["relationship", "status"],
  permissions: {
    create: ["ceo", "admin", "executive", "admission"],
    edit: ["ceo", "admin", "executive", "admission"],
    delete: ["ceo", "admin", "executive"]
  },
  softDelete: true,
  softDeleteField: "status",
  softDeleteValue: "inactive",
  softRestoreValue: "active",
  fieldOptions: {
    relationship: ["father", "mother", "guardian", "sponsor", "other"],
    status: ["active", "inactive", "pending"]
  }
});

window.ParentsModule = ParentsModule;
