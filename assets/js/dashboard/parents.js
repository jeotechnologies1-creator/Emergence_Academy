const ParentsModule = window.OfficeModuleEngine.create({
  moduleKey: "parents",
  title: "Parents",
  tableName: "parents",
  orderBy: "created_at",
  columns: [
    { key: "profile_id", label: "Parent" },
    { key: "occupation", label: "Occupation" },
    { key: "relationship", label: "Relationship" },
    { key: "address", label: "Address" },
    { key: "created_at", label: "Created" }
  ],
  formFields: ["profile_id", "occupation", "relationship", "address"],
  requiredFields: ["profile_id", "relationship"],
  permissions: {
    create: ["ceo", "admin", "executive", "admission"],
    edit: ["ceo", "admin", "executive", "admission"],
    delete: ["ceo", "admin", "executive"]
  },
  fieldOptions: {
    relationship: ["father", "mother", "guardian", "sponsor", "other"]
  },
  lookups: {
    profile_id: {
      table: "profiles",
      labelKey: "email",
      // A parent record must be attached to a parent account. This prevents a
      // teacher profile from being selected as the child's guardian.
      filter: (profile) => String(profile?.role || "").toLowerCase() === "parent"
    }
  }
});

window.ParentsModule = ParentsModule;
