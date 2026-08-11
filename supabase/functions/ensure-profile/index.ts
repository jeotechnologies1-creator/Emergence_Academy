import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") || "";
  if (!url || !anonKey || !serviceRoleKey) return json({ error: "Supabase function environment is not configured." }, 500);
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  const user = callerData?.user;
  if (callerError || !user) return json({ error: "Invalid authentication session." }, 401);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error: existingError } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existingError) return json({ error: existingError.message }, 500);
  if (existing) return json({ profile: existing });

  const metadata = user.user_metadata || {};
  const values = {
    id: user.id,
    email: user.email || "",
    first_name: String(metadata.first_name || metadata.full_name || "").trim() || null,
    last_name: String(metadata.last_name || "").trim() || null,
    phone: String(metadata.phone || "").trim() || null,
    // Auth metadata is user-controlled. A recovery-created record is always
    // least-privileged; an administrator can assign another role afterward.
    role: "student",
    status: "active",
  };
  const { data: profile, error: writeError } = await admin.from("profiles").upsert(values, { onConflict: "id" }).select("*").single();
  if (writeError) return json({ error: writeError.message }, 500);
  return json({ profile, repaired: true });
});
