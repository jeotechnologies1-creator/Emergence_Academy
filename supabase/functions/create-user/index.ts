import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

/* ==========================================================
   EMERGENCE ACADEMY
   CREATE USER EDGE FUNCTION
   ==========================================================
   Profile creation is handled exclusively by:

   auth.users
       ↓
   on_auth_user_created
       ↓
   handle_new_user()
       ↓
   public.profiles

   IMPORTANT:
   - full_name is NOT written to public.profiles.
   - first_name and last_name are used instead.
   ========================================================== */

const FUNCTION_VERSION = "2026-08-18-ENROLLMENT-01";
const DEFAULT_RESET_PASSWORD = "Emergence2026!";

const ALLOWED_ROLES = new Set([
  "ceo",
  "admin",
  "executive",
  "teacher",
  "student",
  "parent",
  "finance",
  "hr",
  "admission",
  "exam",
  "library",
]);

// These are accounts created for school offices. Learners, parents, and
// teachers use their normal account flows and are not forced through the
// office-password hand-off.
const OFFICE_ROLES = new Set([
  "ceo", "admin", "executive", "finance", "hr", "admission", "exam", "library",
]);

const ROLE_ALIASES: Record<string, string> = {
  "administrator": "admin",
  "super admin": "admin",
  "ceo office": "ceo",
  "executive office": "executive",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

/* ==========================================================
   RESPONSE HELPER
========================================================== */

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

/* ==========================================================
   ROLE NORMALIZATION
========================================================== */

function normalizeRole(value: unknown): string {
  const role = String(value ?? "student")
    .trim()
    .toLowerCase()
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ");

  const normalized = ROLE_ALIASES[role] || role;

  return ALLOWED_ROLES.has(normalized)
    ? normalized
    : "student";
}

/* ==========================================================
   NAME NORMALIZATION
========================================================== */

function normalizeName(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function generateEmployeeId(): string {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `EA-EMP-${year}-${suffix}`;
}

async function deleteCreatedUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  // Do not assume the profile foreign key has ON DELETE CASCADE. This makes
  // failures after the auth trigger atomic from the caller's perspective.
  await admin.from("parents").delete().eq("profile_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

/* ==========================================================
   MAIN EDGE FUNCTION
========================================================== */

Deno.serve(async (req: Request): Promise<Response> => {
  /* ========================================================
     CORS
  ======================================================== */

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed.",
        function_version: FUNCTION_VERSION,
      },
      405,
    );
  }

  try {
    console.log(
      `[${FUNCTION_VERSION}] create-user request received`,
    );

    /* ======================================================
       ENVIRONMENT
    ====================================================== */

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !anonKey
    ) {
      console.error(
        `[${FUNCTION_VERSION}] Missing Supabase environment variables`,
      );

      return jsonResponse(
        {
          error:
            "Supabase environment variables are missing.",
          function_version: FUNCTION_VERSION,
        },
        500,
      );
    }

    /* ======================================================
       ADMIN CLIENT
    ====================================================== */

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /* ======================================================
       VERIFY AUTHORIZATION HEADER
    ====================================================== */

    const authorization =
      req.headers.get("Authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        {
          error:
            "Authentication is required.",
          function_version: FUNCTION_VERSION,
        },
        401,
      );
    }

    const accessToken = authorization
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!accessToken) {
      return jsonResponse(
        {
          error:
            "Authentication token is missing.",
          function_version: FUNCTION_VERSION,
        },
        401,
      );
    }

    /* ======================================================
       CALLER CLIENT
    ====================================================== */

    const callerClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /* ======================================================
       VERIFY CALLER
    ====================================================== */

    const {
      data: callerAuth,
      error: callerAuthError,
    } = await callerClient.auth.getUser();

    if (
      callerAuthError ||
      !callerAuth?.user
    ) {
      console.error(
        `[${FUNCTION_VERSION}] Caller authentication failed:`,
        callerAuthError,
      );

      return jsonResponse(
        {
          error:
            "Invalid or expired authentication session.",
          function_version: FUNCTION_VERSION,
        },
        401,
      );
    }

    const callerId =
      callerAuth.user.id;

    /* ======================================================
       VERIFY CALLER PROFILE
    ====================================================== */

    const {
      data: callerProfile,
      error: callerProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status")
      .eq("id", callerId)
      .maybeSingle();

    if (callerProfileError) {
      console.error(
        `[${FUNCTION_VERSION}] Caller profile query failed:`,
        callerProfileError,
      );

      return jsonResponse(
        {
          error:
            callerProfileError.message,
          function_version: FUNCTION_VERSION,
        },
        500,
      );
    }

    if (!callerProfile) {
      return jsonResponse(
        {
          error:
            "Caller profile could not be found.",
          function_version: FUNCTION_VERSION,
        },
        403,
      );
    }

    const callerRole = normalizeRole(callerProfile.role);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must contain valid JSON.", function_version: FUNCTION_VERSION }, 400);
    }

    const operation = String(body.operation || "").trim().toLowerCase();

    /* ======================================================
       ONLY ADMIN / CEO CAN CREATE USERS
    ====================================================== */

    if (
      callerRole !== "admin" &&
      callerRole !== "ceo" &&
      operation !== "change-initial-password"
    ) {
      return jsonResponse(
        {
          error:
            "Only Admin or CEO can create users.",
          function_version: FUNCTION_VERSION,
        },
        403,
      );
    }

    /* ======================================================
       REQUEST BODY
    ====================================================== */

    if (operation === "delete-teacher") {
      const teacherId = String(body.teacher_id || "").trim();
      const profileId = String(body.profile_id || "").trim();

      if (!teacherId || !profileId) {
        return jsonResponse({ error: "Teacher and profile IDs are required.", function_version: FUNCTION_VERSION }, 400);
      }
      if (profileId === callerId) {
        return jsonResponse({ error: "You cannot delete your own signed-in account.", function_version: FUNCTION_VERSION }, 400);
      }

      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("id, profile_id")
        .eq("id", teacherId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (teacherError || !teacher) {
        return jsonResponse({ error: "Teacher account was not found.", function_version: FUNCTION_VERSION }, 404);
      }

      // teacher_subjects is removed by its foreign-key cascade. If the teacher
      // owns live classes or other protected history, preserve it and return
      // the database constraint error instead of partially deleting the login.
      const { error: teacherDeleteError } = await supabaseAdmin
        .from("teachers")
        .delete()
        .eq("id", teacher.id);
      if (teacherDeleteError) {
        return jsonResponse({ error: `Cannot delete this teacher: ${teacherDeleteError.message}`, function_version: FUNCTION_VERSION }, 409);
      }

      const { error: profileDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", profileId);
      if (profileDeleteError) {
        return jsonResponse({ error: `Teacher record was removed, but the account profile could not be deleted: ${profileDeleteError.message}`, function_version: FUNCTION_VERSION }, 409);
      }

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profileId);
      if (authDeleteError) {
        return jsonResponse({ error: `Teacher record was removed, but the login could not be deleted: ${authDeleteError.message}`, function_version: FUNCTION_VERSION }, 500);
      }

      return jsonResponse({ success: true, message: "Teacher account deleted successfully.", function_version: FUNCTION_VERSION });
    }

    // Profile deletion must be performed server-side so a browser never gets
    // access to Auth Admin credentials. It is intentionally limited to the
    // same CEO/Admin roles already verified above.
    if (String(body.operation || "").trim().toLowerCase() === "delete-profile") {
      const targetId = String(body.profile_id || "").trim();
      if (!targetId) return jsonResponse({ error: "Profile ID is required.", function_version: FUNCTION_VERSION }, 400);
      if (targetId === callerId) return jsonResponse({ error: "You cannot delete your own signed-in account.", function_version: FUNCTION_VERSION }, 400);

      const { data: targetProfile, error: targetError } = await supabaseAdmin
        .from("profiles").select("id").eq("id", targetId).maybeSingle();
      if (targetError || !targetProfile) return jsonResponse({ error: "Profile was not found.", function_version: FUNCTION_VERSION }, 404);

      // Role records are deleted first. A foreign-key-protected academic
      // history causes a clear error instead of bypassing database integrity.
      for (const table of ["students", "teachers", "parents"]) {
        const { error } = await supabaseAdmin.from(table).delete().eq("profile_id", targetId);
        if (error) return jsonResponse({ error: `Cannot delete this profile while related ${table} records are in use: ${error.message}`, function_version: FUNCTION_VERSION }, 409);
      }
      const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", targetId);
      if (profileDeleteError) return jsonResponse({ error: profileDeleteError.message, function_version: FUNCTION_VERSION }, 409);
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (authDeleteError) return jsonResponse({ error: `Profile was removed, but its Auth login could not be removed: ${authDeleteError.message}`, function_version: FUNCTION_VERSION }, 500);
      return jsonResponse({ success: true, message: "User profile and login deleted successfully.", function_version: FUNCTION_VERSION });
    }

    // Profile edits also update Auth so the email and trusted role claim stay
    // aligned with public.profiles. This endpoint is reached only after the
    // Admin/CEO check above and never exposes Auth Admin credentials.
    if (String(body.operation || "").trim().toLowerCase() === "update-profile") {
      const targetId = String(body.profile_id || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const firstName = normalizeName(body.first_name);
      const lastName = normalizeName(body.last_name);
      const phone = String(body.phone || "").trim() || null;
      const role = normalizeRole(body.role);
      const status = String(body.status || "").trim().toLowerCase();

      if (!targetId || !email || !firstName || !lastName || !role || !status) {
        return jsonResponse({ error: "First name, last name, email, role, and status are required.", function_version: FUNCTION_VERSION }, 400);
      }
      if (!ALLOWED_ROLES.has(role)) {
        return jsonResponse({ error: "Select a valid role.", function_version: FUNCTION_VERSION }, 400);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin
        .from("profiles").select("id").eq("id", targetId).maybeSingle();
      if (targetError || !targetProfile) return jsonResponse({ error: "Profile was not found.", function_version: FUNCTION_VERSION }, 404);

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
        email,
        app_metadata: { role },
        user_metadata: { first_name: firstName, last_name: lastName, phone }
      });
      if (authUpdateError) return jsonResponse({ error: `Unable to update the login account: ${authUpdateError.message}`, function_version: FUNCTION_VERSION }, 400);

      const { data: profile, error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({ first_name: firstName, last_name: lastName, email, phone, role, status, updated_at: new Date().toISOString() })
        .eq("id", targetId)
        .select("id,first_name,last_name,email,phone,role,status")
        .single();
      if (profileUpdateError) return jsonResponse({ error: profileUpdateError.message, function_version: FUNCTION_VERSION }, 400);

      return jsonResponse({ success: true, profile, message: "User profile updated successfully.", function_version: FUNCTION_VERSION });
    }

    if (operation === "reset-profile-password") {
      const targetId = String(body.profile_id || "").trim();
      if (!targetId) return jsonResponse({ error: "A target profile is required.", function_version: FUNCTION_VERSION }, 400);
      const { data: target, error: targetError } = await supabaseAdmin.from("profiles")
        .select("id, role").eq("id", targetId).maybeSingle();
      if (targetError || !target) return jsonResponse({ error: "Profile was not found.", function_version: FUNCTION_VERSION }, 404);
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetId, { password: DEFAULT_RESET_PASSWORD });
      if (resetError) return jsonResponse({ error: `Unable to reset password: ${resetError.message}`, function_version: FUNCTION_VERSION }, 400);
      const { error: flagError } = await supabaseAdmin.rpc("set_profile_password_change_flag", {
        target_profile_id: targetId,
        required: true,
      });
      if (flagError) return jsonResponse({ error: flagError.message, function_version: FUNCTION_VERSION }, 500);
      return jsonResponse({ success: true, default_password: DEFAULT_RESET_PASSWORD, message: "Password reset successfully. User must change password after next login.", function_version: FUNCTION_VERSION });
    }

    // A user flagged with must_change_password may replace the
    // administrator-issued temporary password exactly once. This is
    // intentionally server-side so the browser cannot clear the requirement
    // by editing public.profiles directly.
    if (operation === "change-initial-password") {
      const password = String(body.password || "").trim();
      if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters.", function_version: FUNCTION_VERSION }, 400);

      const { data: callerProfileRecord, error: callerProfileError } = await supabaseAdmin
        .from("profiles")
        .select("id, role, must_change_password")
        .eq("id", callerId)
        .maybeSingle();
      if (callerProfileError || !callerProfileRecord) return jsonResponse({ error: "Your profile could not be found.", function_version: FUNCTION_VERSION }, 404);
      if (!callerProfileRecord.must_change_password) return jsonResponse({ error: "Your temporary password has already been changed.", function_version: FUNCTION_VERSION }, 400);

      const { error: authPasswordError } = await supabaseAdmin.auth.admin.updateUserById(callerId, { password });
      if (authPasswordError) return jsonResponse({ error: `Unable to change password: ${authPasswordError.message}`, function_version: FUNCTION_VERSION }, 400);
      const { error: clearFlagError } = await supabaseAdmin.rpc("set_profile_password_change_flag", {
        target_profile_id: callerId,
        required: false,
      });
      if (clearFlagError) return jsonResponse({ error: clearFlagError.message, function_version: FUNCTION_VERSION }, 500);
      return jsonResponse({ success: true, message: "Password changed successfully.", function_version: FUNCTION_VERSION });
    }

    // Add children to an existing parent account without removing its current
    // links. This lets one guardian securely access every child assigned by
    // an administrator.
    if (String(body.operation || "").trim().toLowerCase() === "update-parent-links") {
      const parentId = String(body.parent_id || "").trim();
      const studentIds = normalizeIdList(body.student_ids);
      const occupation = normalizeName(body.occupation) || null;
      const relationship = normalizeName(body.relationship);
      const address = normalizeName(body.address) || null;

      if (!parentId || !relationship) {
        return jsonResponse({ error: "Parent and relationship are required.", function_version: FUNCTION_VERSION }, 400);
      }

      const { data: parentRecord, error: parentError } = await supabaseAdmin
        .from("parents").select("id").eq("id", parentId).maybeSingle();
      if (parentError || !parentRecord) return jsonResponse({ error: "Parent record was not found.", function_version: FUNCTION_VERSION }, 404);

      if (studentIds.length) {
        const { data: students, error: studentsError } = await supabaseAdmin
          .from("students").select("id").in("id", studentIds);
        if (studentsError || (students || []).length !== studentIds.length) {
          return jsonResponse({ error: "One or more selected children are no longer enrolled.", function_version: FUNCTION_VERSION }, 400);
        }
        const { error: linkError } = await supabaseAdmin.from("parent_students").upsert(
          studentIds.map((studentId) => ({ parent_id: parentId, student_id: studentId, relationship })),
          { onConflict: "parent_id,student_id" },
        );
        if (linkError) return jsonResponse({ error: linkError.message, function_version: FUNCTION_VERSION }, 400);
      }

      const { data: parent, error: updateError } = await supabaseAdmin
        .from("parents")
        .update({ occupation, relationship, address })
        .eq("id", parentId)
        .select()
        .single();
      if (updateError) return jsonResponse({ error: updateError.message, function_version: FUNCTION_VERSION }, 400);

      return jsonResponse({ success: true, parent, message: studentIds.length ? "Parent record updated and selected children linked." : "Parent record updated successfully.", function_version: FUNCTION_VERSION });
    }

    /* ======================================================
       BASIC USER DATA
    ====================================================== */

    const email =
      String(body.email ?? "")
        .trim()
        .toLowerCase();

    const password =
      String(body.password ?? "").trim();

    const firstName =
      normalizeName(body.first_name);

    const lastName =
      normalizeName(body.last_name);

    const phone =
      normalizeName(body.phone);

    const role =
      normalizeRole(body.role);

    /* ======================================================
       TEACHER DATA
    ====================================================== */

    const teacherData =
      body.teacher_data;

    const parentData =
      body.parent_data;

    /* ======================================================
       VALIDATION
    ====================================================== */

    if (!email) {
      return jsonResponse(
        {
          error: "Email is required.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    if (!password) {
      return jsonResponse(
        {
          error: "Password is required.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    if (password.length < 8) {
      return jsonResponse(
        {
          error:
            "Password must be at least 8 characters.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    if (!firstName) {
      return jsonResponse(
        {
          error:
            "First name is required.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    if (!lastName) {
      return jsonResponse(
        {
          error:
            "Last name is required.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    // Students must go through admit-student. That transaction creates the
    // auth profile, the class enrollment, the database-issued student number,
    // and optional guardian link together.
    if (role === "student") {
      return jsonResponse(
        {
          error: "Students must be admitted from the Students module.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    if (
      role === "teacher" &&
      (
        !teacherData ||
        typeof teacherData !== "object"
      )
    ) {
      return jsonResponse(
        {
          error:
            "Teacher information is required.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    if (role === "parent" && (!parentData || typeof parentData !== "object")) {
      return jsonResponse(
        { error: "Select at least one enrolled child for this parent.", function_version: FUNCTION_VERSION },
        400,
      );
    }

    /* ======================================================
       CREATE AUTH USER
       
       IMPORTANT:
       DO NOT SEND full_name.
       
       The trigger reads:
       - first_name
       - last_name
       - role
       - phone
    ====================================================== */

    console.log(
      `[${FUNCTION_VERSION}] Creating Auth user`,
      {
        email,
        role,
        first_name: firstName,
        last_name: lastName,
      },
    );

    const {
      data: authResult,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,

        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role,
          phone,
        },
        // RLS reads the trusted app_metadata role; regular users cannot alter
        // this claim with the client SDK.
        app_metadata: { role },
      });

    if (
      authError ||
      !authResult?.user
    ) {
      console.error(
        `[${FUNCTION_VERSION}] Auth user creation failed:`,
        authError,
      );

      return jsonResponse(
        {
          error:
            authError?.message ??
            "Failed to create Auth user.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
    }

    const userId =
      authResult.user.id;

    console.log(
      `[${FUNCTION_VERSION}] Auth user created: ${userId}`,
    );

    /* ======================================================
       VERIFY TRIGGER-CREATED PROFILE
       
       We do NOT INSERT into profiles here.
    ====================================================== */

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, email, role, first_name, last_name, phone, status",
        )
        .eq("id", userId)
        .maybeSingle();

    if (profileError) {
      console.error(
        `[${FUNCTION_VERSION}] Profile verification failed:`,
        profileError,
      );

      /*
       * Clean up the Auth account because
       * the required profile could not be verified.
       */
      await deleteCreatedUser(supabaseAdmin, userId);

      return jsonResponse(
        {
          error:
            profileError.message,
          function_version: FUNCTION_VERSION,
        },
        500,
      );
    }

    if (!profile) {
      console.error(
        `[${FUNCTION_VERSION}] handle_new_user() did not create a profile`,
      );

      await deleteCreatedUser(supabaseAdmin, userId);

      return jsonResponse(
        {
          error:
            "User was created but the profile trigger did not create a profile.",
          function_version: FUNCTION_VERSION,
        },
        500,
      );
    }

    // The account owner, not an administrator, must replace the temporary
    // password after their first sign-in. Password values are never stored in
    // public.profiles or returned by this function.
    const { error: passwordFlagError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: OFFICE_ROLES.has(role) })
      .eq("id", userId);
    if (passwordFlagError) {
      await deleteCreatedUser(supabaseAdmin, userId);
      return jsonResponse({ error: passwordFlagError.message, function_version: FUNCTION_VERSION }, 500);
    }

    /* ======================================================
       CREATE LINKED ROLE RECORDS
    ====================================================== */

    let teacher = null;
    let parent = null;

    if (role === "teacher") {
      const teacherInput =
        teacherData as Record<
          string,
          unknown
        >;

      // Employee IDs are issued by this trusted admin workflow. Do not accept
      // a browser-supplied ID as it can collide with or impersonate a record.
      const employeeId = generateEmployeeId();

      const departmentName =
        normalizeName(
          teacherInput.department_name,
        );

      let departmentId =
        normalizeName(
          teacherInput.department_id,
        ) || null;

      const qualification =
        normalizeName(
          teacherInput.qualification,
        );

      const specialization =
        normalizeName(
          teacherInput.specialization,
        );

      const employmentDate =
        normalizeName(
          teacherInput.employment_date,
        ) || null;

      const teacherStatus =
        normalizeName(
          teacherInput.status,
        ) || "active";

      const classIds = normalizeIdList(teacherInput.class_ids);
      const subjectIds = normalizeIdList(teacherInput.subject_ids);

      if (!classIds.length || !subjectIds.length) {
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: "Assign at least one class and one subject to the teacher.", function_version: FUNCTION_VERSION },
          400,
        );
      }

      const [classesResult, subjectsResult] = await Promise.all([
        supabaseAdmin.from("classes").select("id").in("id", classIds),
        supabaseAdmin.from("subjects").select("id").in("id", subjectIds),
      ]);

      if (classesResult.error || subjectsResult.error ||
        (classesResult.data || []).length !== classIds.length ||
        (subjectsResult.data || []).length !== subjectIds.length) {
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: "One or more selected classes or subjects are no longer available.", function_version: FUNCTION_VERSION },
          400,
        );
      }

      /* ====================================================
         FIND DEPARTMENT
      ==================================================== */

      if (
        !departmentId &&
        departmentName
      ) {
        const {
          data: department,
          error: departmentError,
        } =
          await supabaseAdmin
            .from("departments")
            .select("id")
            .eq(
              "name",
              departmentName,
            )
            .maybeSingle();

        if (departmentError) {
          await deleteCreatedUser(supabaseAdmin, userId);
          return jsonResponse(
            { error: departmentError.message, function_version: FUNCTION_VERSION },
            400,
          );
        }

        if (department) {
          departmentId =
            department.id;
        } else {
          const {
            data: newDepartment,
            error:
              newDepartmentError,
          } =
            await supabaseAdmin
              .from("departments")
              .insert({
                name:
                  departmentName,
              })
              .select("id")
              .single();

          if (newDepartmentError) {
            await deleteCreatedUser(supabaseAdmin, userId);
            return jsonResponse(
              { error: newDepartmentError.message, function_version: FUNCTION_VERSION },
              400,
            );
          }

          departmentId =
            newDepartment.id;
        }
      }

      /* ====================================================
         CREATE TEACHER
      ==================================================== */

      const {
        data: teacherRecord,
        error: teacherError,
      } =
        await supabaseAdmin
          .from("teachers")
          .insert({
            profile_id: userId,
            teacher_no:
              `T-${employeeId}`,
            employee_id:
              employeeId,
            department_id:
              departmentId,
            employment_date:
              employmentDate,
            qualification,
            specialization,
            status:
              teacherStatus,
          })
          .select()
          .single();

      if (teacherError) {
        console.error(
          `[${FUNCTION_VERSION}] Teacher creation failed:`,
          teacherError,
        );

        /*
         * Delete Auth user.
         *
         * The profile belongs to the Auth user and
         * should disappear through the FK cascade
         * if the schema is configured accordingly.
         */
        await deleteCreatedUser(supabaseAdmin, userId);

        return jsonResponse(
          {
            error:
              teacherError.message,
            function_version:
              FUNCTION_VERSION,
          },
          400,
        );
      }

      teacher =
        teacherRecord;

      const teachingAssignments = classIds.flatMap((classId) =>
        subjectIds.map((subjectId) => ({
          teacher_id: teacherRecord.id,
          class_id: classId,
          subject_id: subjectId,
        }))
      );

      const { error: assignmentError } = await supabaseAdmin
        .from("teacher_subjects")
        .upsert(teachingAssignments, { onConflict: "teacher_id,class_id,subject_id" });

      if (assignmentError) {
        console.error(`[${FUNCTION_VERSION}] Teacher assignment creation failed:`, assignmentError);
        await supabaseAdmin.from("teacher_subjects").delete().eq("teacher_id", teacherRecord.id);
        await supabaseAdmin.from("teachers").delete().eq("id", teacherRecord.id);
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: assignmentError.message, function_version: FUNCTION_VERSION },
          400,
        );
      }
    }

    // A parent portal account needs a parents row before it can be selected
    // in Student Admission and linked through parent_students. Creating it
    // here avoids an account that can log in but has no child relationship.
    if (role === "parent") {
      const parentInput = parentData as Record<string, unknown>;
      const studentIds = normalizeIdList(parentInput.student_ids);
      const relationship = normalizeName(parentInput.relationship);

      if (!studentIds.length || !relationship) {
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: "A relationship and at least one enrolled child are required.", function_version: FUNCTION_VERSION },
          400,
        );
      }

      const { data: linkedStudents, error: linkedStudentsError } = await supabaseAdmin
        .from("students")
        .select("id")
        .in("id", studentIds);

      if (linkedStudentsError || (linkedStudents || []).length !== studentIds.length) {
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: "One or more selected children are no longer enrolled.", function_version: FUNCTION_VERSION },
          400,
        );
      }

      const { data: parentRecord, error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          profile_id: userId,
          occupation: normalizeName(parentInput.occupation) || null,
          relationship,
          address: normalizeName(parentInput.address) || null,
        })
        .select()
        .single();

      if (parentError) {
        console.error(`[${FUNCTION_VERSION}] Parent creation failed:`, parentError);
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: parentError.message, function_version: FUNCTION_VERSION },
          400,
        );
      }

      parent = parentRecord;

      const { error: parentLinkError } = await supabaseAdmin
        .from("parent_students")
        .upsert(
          studentIds.map((studentId) => ({
            parent_id: parentRecord.id,
            student_id: studentId,
            relationship,
          })),
          { onConflict: "parent_id,student_id" },
        );

      if (parentLinkError) {
        console.error(`[${FUNCTION_VERSION}] Parent-child link creation failed:`, parentLinkError);
        await supabaseAdmin.from("parent_students").delete().eq("parent_id", parentRecord.id);
        await supabaseAdmin.from("parents").delete().eq("id", parentRecord.id);
        await deleteCreatedUser(supabaseAdmin, userId);
        return jsonResponse(
          { error: parentLinkError.message, function_version: FUNCTION_VERSION },
          400,
        );
      }
    }

    /* ======================================================
       SUCCESS
    ====================================================== */

    console.log(
      `[${FUNCTION_VERSION}] User creation completed`,
    );

    return jsonResponse(
      {
        success: true,

        message:
          "User created successfully.",

        user_id:
          userId,

        role,

        profile,

        teacher,

        parent,

        function_version:
          FUNCTION_VERSION,
      },
      200,
    );
  } catch (error) {
    console.error(
      `[${FUNCTION_VERSION}] CREATE USER ERROR:`,
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",

        function_version:
          FUNCTION_VERSION,
      },
      500,
    );
  }
});
