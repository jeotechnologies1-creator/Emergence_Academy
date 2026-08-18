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
  // Create the portal account and link it to one or more enrolled children in one step.
  formFields: [{ key: "student_ids", label: "Children", type: "multi-select", fullWidth: true }, "first_name", "last_name", "email", "phone", "password", "occupation", "relationship", "address"],
  editFormFields: ["occupation", "relationship", "address"],
  requiredFields: ["student_ids", "first_name", "last_name", "email", "password", "relationship"],
  multiValueFields: ["student_ids"],
  fieldTypes: { email: "email", password: "password" },
  permissions: {
    create: ["ceo", "admin"],
    edit: ["ceo", "admin", "executive", "admission"],
    delete: ["ceo", "admin", "executive"]
  },
  fieldOptions: {
    relationship: ["father", "mother", "guardian", "sponsor", "other"]
  },
  lookups: {
    student_ids: {
      table: "students",
      preferProfileName: true
    }
  },
  async createRecord(payload) {
    const studentIds = Array.isArray(payload.student_ids)
      ? payload.student_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    if (!studentIds.length) {
      return API.response(false, null, "Select at least one enrolled child.");
    }
    const accountResult = await Auth.createOfficeAccount({
      first_name: String(payload.first_name || "").trim(),
      last_name: String(payload.last_name || "").trim(),
      email: String(payload.email || "").trim().toLowerCase(),
      phone: String(payload.phone || "").trim(),
      password: String(payload.password || "").trim(),
      role: "parent",
      parent_data: {
        student_ids: studentIds,
        occupation: String(payload.occupation || "").trim(),
        relationship: String(payload.relationship || "").trim(),
        address: String(payload.address || "").trim()
      }
    });
    if (!accountResult?.success || !accountResult?.parent?.id) {
      return API.response(false, null, accountResult?.message || "Unable to create the parent portal account.");
    }

    return API.response(true, { id: accountResult.parent.id }, "Parent portal account created and linked to the selected children.");
  }
});

window.ParentsModule = ParentsModule;
