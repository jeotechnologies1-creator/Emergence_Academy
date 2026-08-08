import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

console.log("========== CREATE USER FUNCTION ==========");

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

function normalizeRole(value: unknown) {
  const role = String(value || "student").trim().toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : "student";
}

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function splitName(firstName: string, lastName: string, fullName: string) {
  const normalizedFirst = String(firstName || "").trim();
  const normalizedLast = String(lastName || "").trim();
  const normalizedFull = String(fullName || "").trim();

  if (normalizedFirst || normalizedLast) {
    return {
      first_name: normalizedFirst,
      last_name: normalizedLast,
      full_name: `${normalizedFirst} ${normalizedLast}`.trim(),
    };
  }

  if (!normalizedFull) {
    return {
      first_name: "",
      last_name: "",
      full_name: "",
    };
  }

  const [first, ...rest] = normalizedFull.split(" ");
  return {
    first_name: first || "",
    last_name: rest.join(" ").trim(),
    full_name: normalizedFull,
  };
}

async function upsertProfileWithFallback(supabaseAdmin: any, payload: Record<string, unknown>) {
  let draft: Record<string, unknown> = { ...payload };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(draft, { onConflict: "id" });

    if (!error) {
      return { success: true, droppedColumns: [] as string[] };
    }

    const message = String(error.message || "");
    const missingColumn = message.match(/column\s+"([^"]+)"/i)?.[1];

    if (missingColumn && Object.prototype.hasOwnProperty.call(draft, missingColumn)) {
      delete draft[missingColumn];
      continue;
    }

    return {
      success: false,
      error,
      droppedColumns: Object.keys(payload).filter((key) => !(key in draft)),
    };
  }

  return {
    success: false,
    error: { message: "Profile insert failed after retries" },
    droppedColumns: Object.keys(payload).filter((key) => !(key in draft)),
  };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    console.log("Function started");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    console.log(
      "SUPABASE_URL:",
      Boolean(SUPABASE_URL)
    );

    console.log(
      "SERVICE_ROLE_KEY:",
      Boolean(SERVICE_ROLE_KEY)
    );

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing Supabase environment variables"
      );
    }


    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * ==========================================================
     * VERIFY CALLER
     * ==========================================================
     *
     * verify_jwt is disabled in config.toml, therefore this
     * function MUST verify the Authorization header itself.
     */

    const authorization =
      req.headers.get("Authorization") || "";

    if (!authorization.startsWith("Bearer ")) {

      return new Response(
        JSON.stringify({
          error: "Authentication is required."
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    }

    const callerToken =
      authorization.replace(
        /^Bearer\s+/i,
        ""
      ).trim();

    if (!callerToken) {

      return new Response(
        JSON.stringify({
          error: "Invalid authentication token."
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    }

    /*
     * Client using the caller's access token.
     */
    const callerClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: {
          headers: {
            Authorization: `Bearer ${callerToken}`
          }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const {
      data: callerAuthData,
      error: callerAuthError
    } = await callerClient.auth.getUser();

    if (
      callerAuthError ||
      !callerAuthData?.user
    ) {

      return new Response(
        JSON.stringify({
          error: "Invalid or expired authentication session."
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    }

    const callerUser =
      callerAuthData.user;

    /*
     * Read caller profile using the service-role
     * client so RLS cannot block authorization.
     */
    const {
      data: callerProfile,
      error: callerProfileError
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status")
      .eq("id", callerUser.id)
      .single();

    if (
      callerProfileError ||
      !callerProfile
    ) {

      return new Response(
        JSON.stringify({
          error: "Caller profile could not be verified."
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    }

    const callerRole =
      String(callerProfile.role || "")
        .trim()
        .toLowerCase();

    /*
     * ==========================================================
     * READ REQUEST
     * ==========================================================
     */

    const body = await req.json();

    const rawEmail =
      String(
        body?.email ??
        body?.user?.email ??
        ""
      )
        .trim()
        .toLowerCase();

    const rawPassword =
      String(
        body?.password ??
        body?.user?.password ??
        ""
      ).trim();

    const full_name =
      body?.full_name;

    const first_name =
      body?.first_name;

    const last_name =
      body?.last_name;

    const role =
      body?.role;

    const phone =
      body?.phone;

    const teacherData =
      body?.teacher_data;

    const normalizedRole =
      normalizeRole(role);

    /*
     * ==========================================================
     * CREATE PERMISSION MATRIX
     * ==========================================================
     */

    const canCreateAnyRole =
      ["ceo", "admin"].includes(
        callerRole
      );

    const allowedRoleMatrix = {

      executive: [
        "teacher",
        "student",
        "parent"
      ],

      hr: [
        "teacher"
      ],

      admission: [
        "student",
        "parent"
      ],

      finance: [],

      exam: [],

      library: [],

      teacher: [],

      student: [],

      parent: []

    };

    const callerAllowedTargets =
      allowedRoleMatrix[
      callerRole as keyof typeof allowedRoleMatrix
      ] || [];

    if (
      !canCreateAnyRole &&
      !callerAllowedTargets.includes(
        normalizedRole
      )
    ) {

      return new Response(
        JSON.stringify({
          error:
            `Role '${callerRole}' is not authorized to create '${normalizedRole}' accounts.`
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    }

    console.log(
      "Request Body:",
      JSON.stringify(body)
    );


    const rawEmail = String(body?.email ?? body?.user?.email ?? "").trim().toLowerCase();
    const rawPassword = String(body?.password ?? body?.user?.password ?? "").trim();
    const full_name = body?.full_name;
    const first_name = body?.first_name;
    const last_name = body?.last_name;
    const role = body?.role;
    const phone = body?.phone;
    const teacherData = body?.teacher_data;

    if (!rawEmail) {
      return new Response(
        JSON.stringify({
          error: "Email is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const generatedPassword = !rawPassword;
    const effectivePassword = rawPassword || generatePassword();

    if (String(effectivePassword).length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 8 characters.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const normalizedRole = normalizeRole(role);
    const nameParts = splitName(
      String(first_name || ""),
      String(last_name || ""),
      String(full_name || "")
    );


    console.log(
      "Checking existing user..."
    );


    // Check if user already exists
    const {
      data: existingUsers,
      error: listError,
    } =
      await supabaseAdmin.auth.admin.listUsers();


    if (listError) {
      console.error(
        "LIST USERS ERROR:",
        JSON.stringify(
          listError,
          null,
          2
        )
      );

      throw listError;
    }


    const existingUser =
      existingUsers.users.find(
        (user) =>
          user.email?.toLowerCase() ===
          rawEmail.toLowerCase()
      );


    if (existingUser) {
      return new Response(
        JSON.stringify({
          error:
            "User already exists",
          user_id:
            existingUser.id,
        }),
        {
          status: 409,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }


    console.log(
      "Creating Auth user..."
    );


    const {
      data: authUser,
      error: createError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email: rawEmail,
          password: effectivePassword,

          // Automatically verify account
          email_confirm: true,

          user_metadata: {
            full_name: nameParts.full_name,
            first_name: nameParts.first_name,
            last_name: nameParts.last_name,
            role: normalizedRole,
            phone:
              phone || "",
          },
        }
      );


    if (createError) {

      console.error(
        "CREATE USER ERROR:",
        JSON.stringify(
          createError,
          null,
          2
        )
      );


      return new Response(
        JSON.stringify({
          error:
            createError.message,
          details:
            createError,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }


    console.log(
      "AUTH USER CREATED:",
      authUser.user?.id
    );


    /*
      Optional:
      Save extra profile information
      in public.users or profiles table

      Change table name if yours differs
    */

    const profilePayload = {
      id: authUser.user!.id,
      email: rawEmail,
      role: normalizedRole,
      status: "active",
      first_name: nameParts.first_name,
      last_name: nameParts.last_name,
      phone: phone || "",
    };

    const profileResult = await upsertProfileWithFallback(
      supabaseAdmin,
      profilePayload
    );

    const profileError = (profileResult as any).error;


    if (profileError) {

      console.error(
        "PROFILE INSERT ERROR:",
        JSON.stringify(
          profileError,
          null,
          2
        )
      );

      await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
      return new Response(
        JSON.stringify({ error: profileError.message || "Unable to create the user profile." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let teacher = null;
    if (normalizedRole === "teacher" && teacherData && typeof teacherData === "object") {
      const record = teacherData as Record<string, unknown>;
      const departmentName = String(record.department_name || "").trim();
      let departmentId = String(record.department_id || "").trim() || null;

      if (departmentName) {
        const { data: existingDepartment, error: findDepartmentError } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("name", departmentName)
          .maybeSingle();

        if (findDepartmentError) {
          await supabaseAdmin.from("profiles").delete().eq("id", authUser.user!.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
          return new Response(JSON.stringify({ error: findDepartmentError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (existingDepartment?.id) {
          departmentId = existingDepartment.id;
        } else {
          const { data: createdDepartment, error: createDepartmentError } = await supabaseAdmin
            .from("departments")
            .insert({ name: departmentName })
            .select("id")
            .single();

          if (createDepartmentError || !createdDepartment?.id) {
            await supabaseAdmin.from("profiles").delete().eq("id", authUser.user!.id);
            await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
            return new Response(JSON.stringify({ error: createDepartmentError?.message || "Unable to create department." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          departmentId = createdDepartment.id;
        }
      }

      const teacherPayload = {
        profile_id: authUser.user!.id,
        teacher_no: `T-${String(record.employee_id || "").trim()}`,
        employee_id: String(record.employee_id || "").trim(),
        department_id: departmentId,
        qualification: String(record.qualification || "").trim(),
        status: String(record.status || "active").trim() || "active",
      };

      const { data: teacherRecord, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .insert(teacherPayload)
        .select()
        .single();

      if (teacherError) {
        await supabaseAdmin.from("profiles").delete().eq("id", authUser.user!.id);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
        return new Response(
          JSON.stringify({ error: teacherError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      teacher = teacherRecord;
    }


    return new Response(
      JSON.stringify({
        success: true,
        message:
          "User created successfully",
        role: normalizedRole,
        profile_saved: !profileError,
        temporary_password: effectivePassword,
        password_generated: generatedPassword,
        teacher,
        user:
          authUser.user,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );


  } catch (error) {

    console.error(
      "FUNCTION ERROR:",
      JSON.stringify(
        error,
        null,
        2
      )
    );


    return new Response(
      JSON.stringify({
        error:
          error.message ||
          "Unexpected server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});
