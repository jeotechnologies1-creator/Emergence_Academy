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
  // Create the portal account and link it to the enrolled student in one step.
  formFields: ["student_id", "first_name", "last_name", "email", "phone", "password", "occupation", "relationship", "address"],
  editFormFields: ["occupation", "relationship", "address"],
  requiredFields: ["student_id", "first_name", "last_name", "email", "password", "relationship"],
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
    student_id: {
      table: "students",
      preferProfileName: true
    }
  },
  async createRecord(payload) {
    const studentId = String(payload.student_id || "").trim();
    const accountResult = await Auth.createOfficeAccount({
      first_name: String(payload.first_name || "").trim(),
      last_name: String(payload.last_name || "").trim(),
      email: String(payload.email || "").trim().toLowerCase(),
      phone: String(payload.phone || "").trim(),
      password: String(payload.password || "").trim(),
      role: "parent"
    });
    if (!accountResult?.success || !accountResult?.parent?.id) {
      return API.response(false, null, accountResult?.message || "Unable to create the parent portal account.");
    }

    const parentId = accountResult.parent.id;
    const relationship = String(payload.relationship || "").trim();
    const { error: parentUpdateError } = await API.db.from("parents").update({
      occupation: String(payload.occupation || "").trim() || null,
      relationship,
      address: String(payload.address || "").trim() || null
    }).eq("id", parentId);
    if (parentUpdateError) return API.response(false, null, parentUpdateError.message);

    const { error: linkError } = await API.db.from("parent_students").upsert(
      { parent_id: parentId, student_id: studentId, relationship },
      { onConflict: "parent_id,student_id" }
    );
    if (linkError) return API.response(false, null, linkError.message);

    return API.response(true, { id: parentId }, "Parent portal account created and linked to the selected student.");
  }
});

window.ParentsModule = ParentsModule;
