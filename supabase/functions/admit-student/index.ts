import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admission-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMISSION_ROLES = new Set(["ceo", "admin", "executive", "admission"]);
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

function normalizedRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase().replace(/[\-_]+/g, " ").replace(/\s+/g, " ");
  return ROLE_ALIASES[role] || role;
}

async function deleteCreatedUser(admin: any, userId: string) {
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    console.log("ADMISSION_AUTH_DEBUG", {
      hasAuthorization: !!req.headers.get("authorization"),
      hasAdmissionToken: !!req.headers.get("x-admission-token"),
      hasApiKey: !!req.headers.get("apikey"),
      authorizationPrefix: req.headers.get("authorization")?.slice(0, 20),
      admissionTokenPrefix: req.headers.get("x-admission-token")?.slice(0, 20),
    });
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

    console.log("ADMISSION_AUTH_RESULT", {
      hasUser: !!callerData?.user,
      userId: callerData?.user?.id || null,
      errorMessage: callerAuthError?.message || null,
      errorName: callerAuthError?.name || null,
      errorStatus: callerAuthError?.status || null,
    });
    const admin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: callerProfile,
      error: profileLookupError,
    } = await admin
      .from("profiles")
      .select("id, role, email")
      .eq("id", callerUser.id)
      .single();

    console.log("ADMISSION_PROFILE_RESULT", {
      hasProfile: !!callerProfile,
      profileId: callerProfile?.id || null,
      role: callerProfile?.role || null,
      email: callerProfile?.email || null,
      error: profileLookupError?.message || null,
      errorCode: profileLookupError?.code || null,
      errorDetails: profileLookupError?.details || null,
      errorHint: profileLookupError?.hint || null,
    });
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
      return json({ error: "Your sign-in session is invalid or expired. Please sign out and sign in again." }, 401);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (profileLookupError || !ADMISSION_ROLES.has(normalizedRole(callerProfile?.role))) {
      return json({ error: "You do not have permission to admit students." }, 403);
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const firstName = String(body?.first_name || "").trim();
    const lastName = String(body?.last_name || "").trim();
    const phone = String(body?.phone || "").trim();
    const classLevel = String(body?.class_level || "").trim();
    let classId = String(body?.class_id || "").trim();
    const departmentId = String(body?.department_id || "").trim() || null;
    const parentId = String(body?.parent_id || "").trim() || null;
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

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, role: "student" },
    });
    const user = authData?.user;
    if (authError || !user) return json({ error: authError?.message || "Unable to create the student account." }, 400);

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
      return json({ error: triggerProfileError.message }, 400);
    }

    const profileValues = {
      email, role: "student", first_name: firstName, last_name: lastName, phone, status: "active",
    };
    const profileWrite = triggerProfile?.id
      ? await admin.from("profiles").update(profileValues).eq("id", user.id)
      : await admin.from("profiles").insert({ id: user.id, ...profileValues });

    if (profileWrite.error) {
      await admin.auth.admin.deleteUser(user.id);
      return json({ error: profileWrite.error.message }, 400);
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
      return json({ error: studentError?.message || "Unable to create the student record." }, 400);
    }

    // Keep the student department, subject choices, and guardian relationship
    // in student-owned tables. They must never be inferred from a teacher.
    if (departmentId) {
      const { error: departmentWriteError } = await admin.from("students").update({ department_id: departmentId }).eq("id", studentId);
      if (departmentWriteError) {
        await deleteCreatedUser(admin, user.id);
        return json({ error: departmentWriteError.message }, 400);
      }
    }

    if (subjectIds.length) {
      const { error: subjectsWriteError } = await admin.from("student_subjects").upsert(
        subjectIds.map((subject_id) => ({ student_id: studentId, subject_id })),
        { onConflict: "student_id,subject_id" },
      );
      if (subjectsWriteError) {
        await deleteCreatedUser(admin, user.id);
        return json({ error: subjectsWriteError.message }, 400);
      }
    }

    if (parentId) {
      const { error: parentWriteError } = await admin.from("parent_students").upsert(
        { parent_id: parentId, student_id: studentId },
        { onConflict: "parent_id,student_id" },
      );
      if (parentWriteError) {
        await deleteCreatedUser(admin, user.id);
        return json({ error: parentWriteError.message }, 400);
      }
    }

    const { data: student, error: fetchError } = await admin
      .from("students")
      .select("*, profiles:profile_id(first_name,last_name,email,phone), classes:class_id(id,class_name), departments:department_id(id,name)")
      .eq("id", studentId)
      .single();

    return json({ success: true, student: fetchError ? { id: studentId } : student });
  } catch (error) {
    console.error("admit-student failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to admit student." }, 500);
  }
});
