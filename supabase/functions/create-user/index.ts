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

const FUNCTION_VERSION = "2026-08-10-FIX-03";

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

    /* ======================================================
       ONLY ADMIN / CEO CAN CREATE USERS
    ====================================================== */

    if (
      callerRole !== "admin" &&
      callerRole !== "ceo"
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

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "Request body must contain valid JSON.",
          function_version: FUNCTION_VERSION,
        },
        400,
      );
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
    }

    // A parent portal account needs a parents row before it can be selected
    // in Student Admission and linked through parent_students. Creating it
    // here avoids an account that can log in but has no child relationship.
    if (role === "parent") {
      const { data: parentRecord, error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({ profile_id: userId, relationship: "guardian" })
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
