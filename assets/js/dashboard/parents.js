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
  formFields: ["profile_id", "student_id", "occupation", "relationship", "address"],
  requiredFields: ["profile_id", "student_id", "relationship"],
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
    },
    student_id: {
      table: "students",
      preferProfileName: true,
      filter: (student) => String(student?.status || "active").toLowerCase() === "active"
    }
  },
  // The same action can create the parent record for a new parent account or
  // connect another enrolled student to an existing parent account.
  async createRecord(payload) {
    const studentId = String(payload.student_id || "").trim();
    const profileId = String(payload.profile_id || "").trim();
    const parentPayload = {
      profile_id: profileId,
      occupation: String(payload.occupation || "").trim() || null,
      relationship: String(payload.relationship || "").trim(),
      address: String(payload.address || "").trim() || null
    };

    const { data: existingParent, error: parentLookupError } = await API.db
      .from("parents")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (parentLookupError) return API.response(false, null, parentLookupError.message);

    let parentId = existingParent?.id;
    if (!parentId) {
      const parentResult = await API.records.create("parents", parentPayload);
      if (!parentResult?.success || !parentResult?.data?.id) return parentResult;
      parentId = parentResult.data.id;
    }

    const { error: linkError } = await API.db.from("parent_students").upsert(
      { parent_id: parentId, student_id: studentId, relationship: parentPayload.relationship },
      { onConflict: "parent_id,student_id" }
    );
    if (linkError) return API.response(false, null, linkError.message);

    return API.response(true, { id: parentId }, "Parent account linked to the selected student.");
  }
});

window.ParentsModule = ParentsModule;
