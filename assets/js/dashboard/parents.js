const ParentsModule = window.OfficeModuleEngine.create({
  moduleKey: "parents",
  title: "Parents",
  tableName: "parents",
  orderBy: "created_at",
  columns: [
    { key: "parent_name", label: "Parent" },
    { key: "parent_email", label: "Email" },
    { key: "parent_phone", label: "Phone" },
    { key: "occupation", label: "Occupation" },
    { key: "relationship", label: "Relationship" },
    { key: "address", label: "Address" },
    { key: "children", label: "Children" },
    { key: "created_at", label: "Created" }
  ],
  // Create the portal account and link it to one or more enrolled children in one step.
  formFields: [{ key: "student_ids", label: "Children", type: "multi-select", fullWidth: true }, "first_name", "last_name", "email", "phone", "password", "occupation", "relationship", "address"],
  editFormFields: [{ key: "student_ids", label: "Link additional children", type: "multi-select", fullWidth: true }, "occupation", "relationship", "address"],
  requiredFields: ["student_ids", "first_name", "last_name", "email", "password", "relationship"],
  editRequiredFields: ["relationship"],
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
  async transformRows(rows) {
    const [profiles, links, students] = await Promise.all([
      API.records.getAll("profiles", { orderBy: "created_at", ascending: false, select: "id,first_name,last_name,email,phone" }),
      API.records.getAll("parent_students", { orderBy: "created_at", ascending: false, select: "parent_id,student_id" }),
      API.records.getAll("students", { orderBy: "created_at", ascending: false, select: "id,student_no,admission_number,profile_id" })
    ]);
    const profileById = Object.fromEntries((profiles || []).map((profile) => [String(profile.id), profile]));
    const studentById = Object.fromEntries((students || []).map((student) => [String(student.id), student]));
    const childrenByParent = {};
    (links || []).forEach((link) => {
      const student = studentById[String(link.student_id)];
      const childProfile = student && profileById[String(student.profile_id)];
      if (!student) return;
      const childName = `${childProfile?.first_name || ""} ${childProfile?.last_name || ""}`.trim() || "Student";
      const childNumber = student.student_no || student.admission_number;
      (childrenByParent[String(link.parent_id)] ||= []).push(childNumber ? `${childName} (${childNumber})` : childName);
    });
    return (rows || []).map((parent) => {
      const profile = profileById[String(parent.profile_id)] || {};
      return {
        ...parent,
        parent_name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "—",
        parent_email: profile.email || "—",
        parent_phone: profile.phone || "—",
        children: (childrenByParent[String(parent.id)] || []).join(", ") || "—"
      };
    });
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
  },
  async updateRecord(payload, parentId) {
    const studentIds = Array.isArray(payload.student_ids)
      ? payload.student_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const { data, error } = await API.db.functions.invoke("create-user", {
      body: {
        operation: "update-parent-links",
        parent_id: parentId,
        student_ids: studentIds,
        occupation: String(payload.occupation || "").trim(),
        relationship: String(payload.relationship || "").trim(),
        address: String(payload.address || "").trim()
      }
    });
    if (error || data?.error) return API.response(false, null, data?.error || error?.message || "Unable to update the parent record.");
    return API.response(true, data?.parent, data?.message || "Parent record updated and selected children linked.");
  }
});

window.ParentsModule = ParentsModule;
ParentsModule.openForStudent = (studentId) => {
  window.OfficeModuleEngine.openModal(ParentsModule, "create", null, { student_ids: [String(studentId)] });
};
