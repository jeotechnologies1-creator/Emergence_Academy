import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization") || "";

    if (!url || !serviceRoleKey) {
      return json({ error: "Supabase function environment is not configured." }, 500);
    }
    if (!authHeader) return json({ error: "Authentication is required." }, 401);

    const callerClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: "Invalid authentication session." }, 401);

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
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

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, role: "student" },
    });
    const user = authData?.user;
    if (authError || !user) return json({ error: authError?.message || "Unable to create the student account." }, 400);

    // Some projects create a profile automatically from an auth.users trigger.
    // Upsert supports both that setup and projects without the trigger.
    const { error: createProfileError } = await admin.from("profiles").upsert({
      id: user.id, email, role: "student", first_name: firstName, last_name: lastName, phone, status: "active",
    }, { onConflict: "id" });
    if (createProfileError) {
      await admin.auth.admin.deleteUser(user.id);
      return json({ error: createProfileError.message }, 400);
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

    const { data: student, error: fetchError } = await admin
      .from("students")
      .select("*, profiles:profile_id(first_name,last_name,email,phone), classes:class_id(id,class_name)")
      .eq("id", studentId)
      .single();

    return json({ success: true, student: fetchError ? { id: studentId } : student });
  } catch (error) {
    console.error("admit-student failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to admit student." }, 500);
  }
});
