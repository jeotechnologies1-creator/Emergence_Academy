import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

console.log("========== CREATE USER FUNCTION ==========");

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


    // Admin Supabase Client
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


    const body = await req.json();

    console.log(
      "Request Body:",
      JSON.stringify(body)
    );


    const {
      email,
      password,
      full_name,
      role,
      phone,
    } = body;


    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error:
            "Email and password are required",
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
          email.toLowerCase()
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
          email,
          password,

          // Automatically verify account
          email_confirm: true,

          user_metadata: {
            full_name:
              full_name || "",
            role:
              role || "student",
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

    const { error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id:
            authUser.user!.id,
          email,
          full_name:
            full_name || "",
          role:
            role || "student",
          phone:
            phone || "",
        });


    if (profileError) {

      console.error(
        "PROFILE INSERT ERROR:",
        JSON.stringify(
          profileError,
          null,
          2
        )
      );

      // Do not delete auth user here
      // because account was already created
    }


    return new Response(
      JSON.stringify({
        success: true,
        message:
          "User created successfully",
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