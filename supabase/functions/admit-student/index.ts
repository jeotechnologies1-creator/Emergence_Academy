import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admission-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMISSION_ROLES = new Set(["ceo", "admin", "executive", "admission"]);
const STUDENT_DELETE_ROLES = new Set(["ceo", "admin", "executive"]);
const ROLE_ALIASES: Record<string, string> = {
  administrator: "admin", "super admin": "admin", admissions: "admission",
};
const CLASS_LEVELS = new Set([
  "Primary 3", "Primary 4", "Primary 5", "Primary 6",
  "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function admissionFailure(stage: string, error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message || fallback);
  return json({ error: `${stage}: ${message}`, stage }, 400);
}

function normalizedRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase().replace(/[\-_]+/g, " ").replace(/\s+/g, " ");
  return ROLE_ALIASES[role] || role;
}

function getSupabaseAdminKey() {
  // Auth Admin endpoints still require a service-role JWT for this SDK flow.
  // Managed SUPABASE_SERVICE_ROLE_KEY cannot be overridden in every project,
  // so accept the custom `sb_secret` name configured for this admission flow.
  // Only JWT-shaped values are valid bearer credentials for Auth Admin.
  const legacyServiceRoleKey = [
    Deno.env.get("sb_secret"),
    Deno.env.get("ADMISSION_SERVICE_ROLE_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ]
    .map((value) => String(value || "").trim())
    .find((value) => value.startsWith("eyJ") && value.split(".").length === 3);
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, unknown>;
    const managedSecretKey = String(secretKeys.default || "").trim()
      || Object.values(secretKeys)
        .map((value) => String(value || "").trim())
        .find(Boolean);
    if (managedSecretKey) return managedSecretKey;
  } catch {
    // Projects that only use legacy keys do not expose SUPABASE_SECRET_KEYS.
  }
  return "";
}

function serverKeyFetch(input: RequestInfo | URL, init?: RequestInit) {
  // The current sb_secret key is valid only on the `apikey` header. The
  // standard client otherwise also mirrors it to Authorization: Bearer, where
  // it is treated as a JWT and rejected by Supabase Auth as "Not
  // authenticated". The user JWT is verified by callerClient separately.
  const headers = new Headers(init?.headers);
  headers.delete("authorization");
  return fetch(input, { ...init, headers });
}

async function createStudentAuthUser(
  url: string,
  publicApiKey: string,
  serviceRoleKey: string,
  input: { email: string; password: string; firstName: string; lastName: string },
) {
  // Do this request explicitly instead of through supabase-js. The Admin API
  // requires the public project key as `apikey` and the legacy service-role
  // JWT as the bearer credential. Supplying the service key for both headers
  // is what produced Supabase Auth's unhelpful "Not authenticated" response.
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publicApiKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        first_name: input.firstName,
        last_name: input.lastName,
        role: "student",
      },
    }),
  });

  const raw = await response.text();
  let data: Record<string, any> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw };
  }

  // GoTrue's Admin create-user endpoint returns the user object directly,
  // unlike supabase-js, which wraps it in { user }. Support both shapes.
  const user = data?.user?.id ? data.user : data;
  if (!response.ok || !user?.id) {
    const message = String(data?.msg || data?.message || data?.error || `Auth Admin request failed (${response.status}).`);
    throw new Error(`Student account creation was rejected by Supabase Auth: ${message}`);
  }

  return user;
}

async function deleteCreatedUser(admin: any, userId: string) {
  // Remove dependent records first. Some projects use a restrictive foreign
  // key from students.profile_id, in which case deleting the profile before
  // its student record leaves a partially admitted account behind.
  await admin.from("students").delete().eq("profile_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = getSupabaseAdminKey();
    const authHeader = req.headers.get("Authorization") || "";
    const requestApiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!url || !serviceRoleKey) {
      return json({ error: "Supabase function environment is not configured." }, 500);
    }
    // x-admission-token is sent in addition to Authorization by the dashboard.
    // It prevents client SDK or gateway header normalization from replacing the
    // caller token with the anonymous project key.
    const accessToken = (req.headers.get("x-admission-token") || authHeader)
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!accessToken) return json({ error: "Authentication is required." }, 401);

    if (!requestApiKey) {
      return json({ error: "Admission authentication is not configured." }, 500);
    }

    // This client is deliberately created before any privileged database
    // operation. It is used for every lookup and write after the caller has
    // been authenticated below.
    // Keep the JWT service-role client identical to create-user, which uses
    // Supabase Auth Admin successfully in this project. A new-format secret
    // key needs the custom fetch only when no legacy JWT is available.
    const admin = serviceRoleKey.startsWith("sb_secret_")
      ? createClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { fetch: serverKeyFetch },
        })
      : createClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

    // Validate with a client configured using the same project public key that
    // authenticated the dashboard. This intentionally does not use the
    // service-role client, which is reserved for privileged writes below.
    const callerClient = createClient(url, requestApiKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: callerData,
      error: callerAuthError
    } = await callerClient.auth.getUser(accessToken);

    // Keep a direct Auth endpoint fallback for runtimes where client header
    // normalization interferes with token forwarding.
    const callerResponse = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: requestApiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const callerUser = callerData?.user || (callerResponse.ok ? await callerResponse.json() : null);
    if (!callerUser?.id) {
      console.warn("Admission caller authentication failed", callerAuthError?.message || "Auth endpoint rejected token");
      return json({ error: "Your sign-in session is invalid or expired. Please sign out and sign in again." }, 401);
    }

    const { data: callerProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", callerUser.id)
      .single();

    const role = normalizedRole(callerProfile?.role);

    if (
      profileLookupError ||
      !callerProfile ||
      !ADMISSION_ROLES.has(role)
    ) {
      return json(
        { error: "You do not have permission to admit students." },
        403
      );
    }

    const body = await req.json();
    const operation = String(body?.operation || "").trim().toLowerCase();
    if (operation === "update" || operation === "delete") {
      if (!ADMISSION_ROLES.has(role)) return json({ error: "You do not have permission to manage students." }, 403);
      const studentId = String(body?.student_id || "").trim();
      if (!studentId) return json({ error: "Student ID is required." }, 400);
      const { data: existing, error: existingError } = await admin
        .from("students").select("id, profile_id").eq("id", studentId).maybeSingle();
      if (existingError || !existing?.profile_id) return json({ error: "Student record was not found." }, 404);

      if (operation === "delete") {
        if (!STUDENT_DELETE_ROLES.has(role)) return json({ error: "You do not have permission to delete students." }, 403);
        const { error: studentDeleteError } = await admin.from("students").delete().eq("id", studentId);
        if (studentDeleteError) return admissionFailure("Student deletion failed", studentDeleteError, "Unable to delete the student record.");
        const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", existing.profile_id);
        if (profileDeleteError) return admissionFailure("Student profile deletion failed", profileDeleteError, "The student record was deleted, but the profile could not be removed.");
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(existing.profile_id);
        if (authDeleteError) return admissionFailure("Student login deletion failed", authDeleteError, "The student record was deleted, but the login could not be removed.");
        return json({ success: true, message: "Student and login deleted successfully." });
      }

      const profile = body?.profile || {};
      const email = String(profile.email || "").trim().toLowerCase();
      const firstName = String(profile.first_name || "").trim();
      const lastName = String(profile.last_name || "").trim();
      if (!email || !firstName || !lastName) return json({ error: "First name, last name, and email are required." }, 400);
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(existing.profile_id, { email });
      if (authUpdateError) return admissionFailure("Student login update failed", authUpdateError, "Unable to update the student email.");
      const { error: profileUpdateError } = await admin.from("profiles").update({ first_name: firstName, last_name: lastName, email, phone: String(profile.phone || "").trim() || null }).eq("id", existing.profile_id);
      if (profileUpdateError) return admissionFailure("Student profile update failed", profileUpdateError, "Unable to update the student profile.");
      const { error: studentUpdateError } = await admin.from("students").update({ class_id: String(body.class_id || "").trim() || null, department_id: String(body.department_id || "").trim() || null, status: String(body.status || "active").trim(), admission_date: String(body.admission_date || "").trim() || null }).eq("id", studentId);
      if (studentUpdateError) return admissionFailure("Student update failed", studentUpdateError, "Unable to update the student record.");
      return json({ success: true, message: "Student profile updated successfully." });
    }
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const firstName = String(body?.first_name || "").trim();
    const lastName = String(body?.last_name || "").trim();
    const phone = String(body?.phone || "").trim();
    const gender = String(body?.gender || "").trim() || null;
    const dateOfBirth = String(body?.date_of_birth || "").trim() || null;
    const address = String(body?.address || "").trim() || null;
    const city = String(body?.city || "").trim() || null;
    const state = String(body?.state || "").trim() || null;
    const country = String(body?.country || "").trim() || "Nigeria";
    const classLevel = String(body?.class_level || "").trim();
    let classId = String(body?.class_id || "").trim();
    const departmentId = String(body?.department_id || "").trim() || null;
    const parentId = String(body?.parent_id || "").trim() || null;
    const parentRelationship = String(body?.parent_relationship || "").trim() || null;
    const subjectIds = [...new Set(Array.isArray(body?.subject_ids)
      ? body.subject_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [])];
    const admissionDate = String(body?.admission_date || "").trim() || null;

    if (!email || !password || !firstName || !lastName || (!classId && !classLevel)) {
      return json({ error: "First name, last name, email, password, and class are required." }, 400);
    }
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);

    if (!classId && classLevel) {
      if (!CLASS_LEVELS.has(classLevel)) return json({ error: "Select a valid class level." }, 400);
      const { data: existingClass, error: findClassError } = await admin
        .from("classes")
        .select("id")
        .eq("class_name", classLevel)
        .maybeSingle();
      if (findClassError) return json({ error: findClassError.message }, 400);

      if (existingClass?.id) {
        classId = String(existingClass.id);
      } else {
        const { data: newClass, error: classError } = await admin
          .from("classes")
          .insert({ class_name: classLevel })
          .select("id")
          .single();
        if (classError || !newClass?.id) {
          return json({ error: classError?.message || "Unable to create the selected class." }, 400);
        }
        classId = String(newClass.id);
      }
    }

    const { data: selectedClass, error: selectedClassError } = await admin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .maybeSingle();
    if (selectedClassError) throw selectedClassError;
    if (!selectedClass?.id) return json({ error: "The selected class is no longer available. Refresh the form and choose a class again." }, 400);

    if (departmentId) {
      const { data: department, error: departmentError } = await admin.from("departments").select("id").eq("id", departmentId).maybeSingle();
      if (departmentError) throw departmentError;
      if (!department?.id) return json({ error: "The selected department is no longer available. Refresh the form and choose a department again." }, 400);
    }

    if (parentId) {
      const { data: parent, error: parentError } = await admin.from("parents").select("id").eq("id", parentId).maybeSingle();
      if (parentError) throw parentError;
      if (!parent?.id) return json({ error: "The selected parent or guardian record is no longer available." }, 400);
    }

    if (subjectIds.length) {
      const { data: subjects, error: subjectsError } = await admin.from("subjects").select("id").in("id", subjectIds);
      if (subjectsError) throw subjectsError;
      if ((subjects || []).length !== subjectIds.length) return json({ error: "One or more selected subjects are no longer available. Refresh the form and try again." }, 400);
    }

    const publicApiKey = Deno.env.get("SUPABASE_ANON_KEY") || requestApiKey;
    const user = await createStudentAuthUser(url, publicApiKey, serviceRoleKey, {
      email,
      password,
      firstName,
      lastName,
    });

    // The auth trigger normally creates this profile synchronously. Updating
    // that row avoids a duplicate primary-key insert on installations whose
    // trigger does not implement an UPSERT itself.
    const { data: triggerProfile, error: triggerProfileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (triggerProfileError) {
      await admin.auth.admin.deleteUser(user.id);
      return admissionFailure("Student profile lookup failed", triggerProfileError, "Unable to read the new student profile.");
    }

    const profileValues = {
      email, role: "student", first_name: firstName, last_name: lastName, phone,
      gender, date_of_birth: dateOfBirth, address, city, state, country, status: "active",
    };
    const profileWrite = triggerProfile?.id
      ? await admin.from("profiles").update(profileValues).eq("id", user.id)
      : await admin.from("profiles").insert({ id: user.id, ...profileValues });

    if (profileWrite.error) {
      await admin.auth.admin.deleteUser(user.id);
      return admissionFailure("Student profile setup failed", profileWrite.error, "Unable to save the new student profile.");
    }

    const { data: studentId, error: studentError } = await admin.rpc("admit_student", {
      p_profile_id: user.id,
      p_class_id: classId,
      p_admission_date: admissionDate,
      p_admission_year: new Date().getFullYear(),
      p_status: "active",
    });
    if (studentError || !studentId) {
      await deleteCreatedUser(admin, user.id);
      return admissionFailure("Student record setup failed", studentError, "Unable to create the student record.");
    }

    // Keep the student department, subject choices, and guardian relationship
    // in student-owned tables. They must never be inferred from a teacher.
    if (departmentId) {
      const { error: departmentWriteError } = await admin.from("students").update({ department_id: departmentId }).eq("id", studentId);
      if (departmentWriteError) {
        await deleteCreatedUser(admin, user.id);
        return admissionFailure("Student department setup failed", departmentWriteError, "Unable to save the department.");
      }
    }

    if (subjectIds.length) {
      const { error: subjectsWriteError } = await admin.from("student_subjects").upsert(
        subjectIds.map((subject_id) => ({ student_id: studentId, subject_id })),
        { onConflict: "student_id,subject_id" },
      );
      if (subjectsWriteError) {
        await deleteCreatedUser(admin, user.id);
        return admissionFailure("Student subject setup failed", subjectsWriteError, "Unable to save subjects.");
      }
    }

    if (parentId) {
      const { error: parentWriteError } = await admin.from("parent_students").upsert(
        { parent_id: parentId, student_id: studentId, relationship: parentRelationship },
        { onConflict: "parent_id,student_id" },
      );
      if (parentWriteError) {
        await deleteCreatedUser(admin, user.id);
        return admissionFailure("Parent connection setup failed", parentWriteError, "Unable to link the parent or guardian.");
      }
    }

    const { data: student, error: fetchError } = await admin
      .from("students")
      .select("*, profiles:profile_id(first_name,last_name,email,phone), classes:class_id(id,class_name), departments:department_id(id,name)")
      .eq("id", studentId)
      .single();

    const generatedStudentId = student?.student_no || student?.admission_number;
    return json({
      success: true,
      message: generatedStudentId
        ? `Student admitted successfully. Student ID: ${generatedStudentId}`
        : "Student admitted successfully.",
      student: fetchError ? { id: studentId } : student,
    });
  } catch (error) {
    console.error("admit-student failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to admit student." }, 500);
  }
});
