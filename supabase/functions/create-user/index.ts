import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

/* ==========================================================
   EMERGENCE ACADEMY
   CREATE USER EDGE FUNCTION
   Profile creation is handled by handle_new_user()
========================================================== */

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function response(
  data: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function normalizeRole(value: unknown) {

  const role =
    String(value || "student")
      .trim()
      .toLowerCase();

  return ALLOWED_ROLES.has(role)
    ? role
    : "student";
}

function splitName(
  firstName: unknown,
  lastName: unknown,
  fullName: unknown
) {

  const first =
    String(firstName || "").trim();

  const last =
    String(lastName || "").trim();

  const full =
    String(fullName || "").trim();

  if (first || last) {

    return {
      first_name: first,
      last_name: last,
    };

  }

  if (!full) {

    return {
      first_name: "",
      last_name: "",
    };

  }

  const parts =
    full.split(/\s+/);

  return {
    first_name:
      parts.shift() || "",

    last_name:
      parts.join(" ").trim(),
  };

}

/* ==========================================================
   MAIN
========================================================== */

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {

    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );

  }

  try {

    /* ======================================================
       ENVIRONMENT
    ====================================================== */

    const SUPABASE_URL =
      Deno.env.get("SUPABASE_URL");

    const SERVICE_ROLE_KEY =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    const SUPABASE_ANON_KEY =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      );

    if (
      !SUPABASE_URL ||
      !SERVICE_ROLE_KEY ||
      !SUPABASE_ANON_KEY
    ) {

      return response(
        {
          error:
            "Supabase environment variables are missing.",
        },
        500
      );

    }

    /* ======================================================
       ADMIN CLIENT
    ====================================================== */

    const supabaseAdmin =
      createClient(
        SUPABASE_URL,
        SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    /* ======================================================
       VERIFY CALLER
    ====================================================== */

    const authorization =
      req.headers.get(
        "Authorization"
      ) || "";

    if (
      !authorization.startsWith(
        "Bearer "
      )
    ) {

      return response(
        {
          error:
            "Authentication is required.",
        },
        401
      );

    }

    const accessToken =
      authorization
        .replace(
          /^Bearer\s+/i,
          ""
        )
        .trim();

    const callerClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
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
        }
      );

    const {
      data: callerAuth,
      error: callerAuthError,
    } =
      await callerClient.auth.getUser();

    if (
      callerAuthError ||
      !callerAuth?.user
    ) {

      return response(
        {
          error:
            "Invalid or expired authentication session.",
        },
        401
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
    } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, role, status"
        )
        .eq(
          "id",
          callerId
        )
        .single();

    if (
      callerProfileError ||
      !callerProfile
    ) {

      console.error(
        "Caller profile error:",
        callerProfileError
      );

      return response(
        {
          error:
            "Caller profile could not be verified.",
        },
        403
      );

    }

    const callerRole =
      String(
        callerProfile.role || ""
      )
        .trim()
        .toLowerCase();

    if (
      !["ceo", "admin"].includes(
        callerRole
      )
    ) {

      return response(
        {
          error:
            "Only CEO or Admin can create users.",
        },
        403
      );

    }

    /* ======================================================
       REQUEST BODY
    ====================================================== */

    const body =
      await req.json();

    const email =
      String(
        body?.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body?.password || ""
      ).trim();

    const role =
      normalizeRole(
        body?.role
      );

    const phone =
      String(
        body?.phone || ""
      ).trim();

    const {
      first_name,
      last_name,
    } =
      splitName(
        body?.first_name,
        body?.last_name,
        body?.full_name
      );

    const teacherData =
      body?.teacher_data;

    /* ======================================================
       VALIDATION
    ====================================================== */

    if (!email) {

      return response(
        {
          error:
            "Email is required.",
        },
        400
      );

    }

    if (!password) {

      return response(
        {
          error:
            "Password is required.",
        },
        400
      );

    }

    if (
      password.length < 8
    ) {

      return response(
        {
          error:
            "Password must be at least 8 characters.",
        },
        400
      );

    }

    /* ======================================================
       CREATE AUTH USER
       The database trigger automatically creates profiles.
    ====================================================== */

    const {
      data: authResult,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password,

          email_confirm:
            true,

          user_metadata: {

            /*
             * full_name is Auth metadata only.
             *
             * It is NOT a profiles column.
             */
            full_name:
              [
                first_name,
                last_name,
              ]
                .filter(Boolean)
                .join(" "),

            first_name,

            last_name,

            role,

            phone,

          },
        }
      );

    if (
      authError ||
      !authResult?.user
    ) {

      console.error(
        "Auth user creation error:",
        authError
      );

      return response(
        {
          error:
            authError?.message ||
            "Failed to create Auth user.",
        },
        400
      );

    }

    const userId =
      authResult.user.id;

    /* ======================================================
       PROFILE
       handle_new_user() already created it.
    ====================================================== */

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq(
          "id",
          userId
        )
        .maybeSingle();

    if (profileError) {

      console.error(
        "Profile verification error:",
        profileError
      );

      return response(
        {
          error:
            profileError.message,
        },
        500
      );

    }

    /*
     * In the unlikely event the trigger did not
     * create the profile, create it here using
     * ONLY valid profiles columns.
     *
     * full_name is deliberately NOT included.
     */

    let finalProfile =
      profile;

    if (!finalProfile) {

      const {
        data: fallbackProfile,
        error: fallbackError,
      } =
        await supabaseAdmin
          .from("profiles")
          .insert({

            id:
              userId,

            email,

            first_name,

            last_name,

            role,

            status:
              "active",

            phone,

          })
          .select()
          .single();

      if (fallbackError) {

        console.error(
          "Fallback profile creation error:",
          fallbackError
        );

        /*
         * Remove Auth user because
         * profile provisioning failed.
         */
        await supabaseAdmin
          .auth.admin.deleteUser(
            userId
          );

        return response(
          {
            error:
              fallbackError.message,
          },
          400
        );

      }

      finalProfile =
        fallbackProfile;

    }

    /* ======================================================
       TEACHER
    ====================================================== */

    let teacher = null;

    if (
      role === "teacher" &&
      teacherData &&
      typeof teacherData === "object"
    ) {

      const teacherInput =
        teacherData as Record<
          string,
          unknown
        >;

      const employeeId =
        String(
          teacherInput.employee_id ||
          ""
        ).trim();

      const departmentName =
        String(
          teacherInput.department_name ||
          ""
        ).trim();

      let departmentId =
        String(
          teacherInput.department_id ||
          ""
        ).trim() || null;

      const qualification =
        String(
          teacherInput.qualification ||
          ""
        ).trim();

      const teacherStatus =
        String(
          teacherInput.status ||
          "active"
        ).trim();

      if (!employeeId) {

        return response(
          {
            error:
              "Employee ID is required for teachers.",
          },
          400
        );

      }

      /* ----------------------------------------------------
         Find department
      ---------------------------------------------------- */

      if (
        departmentName &&
        !departmentId
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
              departmentName
            )
            .maybeSingle();

        if (departmentError) {

          throw departmentError;

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

          if (
            newDepartmentError
          ) {

            throw newDepartmentError;

          }

          departmentId =
            newDepartment.id;

        }

      }

      /* ----------------------------------------------------
         Create teacher
      ---------------------------------------------------- */

      const {
        data: teacherRecord,
        error: teacherError,
      } =
        await supabaseAdmin
          .from("teachers")
          .insert({

            profile_id:
              userId,

            teacher_no:
              `T-${employeeId}`,

            employee_id:
              employeeId,

            department_id:
              departmentId,

            qualification,

            status:
              teacherStatus,

          })
          .select()
          .single();

      if (teacherError) {

        console.error(
          "Teacher creation error:",
          teacherError
        );

        /*
         * Remove Auth user. The profile
         * will cascade if configured,
         * otherwise remove it explicitly.
         */
        await supabaseAdmin
          .from("profiles")
          .delete()
          .eq(
            "id",
            userId
          );

        await supabaseAdmin
          .auth.admin.deleteUser(
            userId
          );

        return response(
          {
            error:
              teacherError.message,
          },
          400
        );

      }

      teacher =
        teacherRecord;

    }

    /* ======================================================
       SUCCESS
    ====================================================== */

    return response(
      {
        success:
          true,

        message:
          "User created successfully.",

        user_id:
          userId,

        role,

        profile:
          finalProfile,

        teacher,

      },
      200
    );

  } catch (error) {

    console.error(
      "CREATE USER ERROR:",
      error
    );

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );

  }

});