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
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData?.user) return json({ error: "Invalid authentication session." }, 401);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerProfile, error: callerProfileError } = await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (callerProfileError) return json({ error: callerProfileError.message }, 500);
  if (!['ceo', 'admin'].includes(String(callerProfile?.role || "").toLowerCase())) return json({ error: "Only CEO or Admin accounts can view all user profiles." }, 403);

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id,first_name,last_name,email,role,phone,status,avatar_url,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (profilesError) return json({ error: profilesError.message }, 500);
  return json({ profiles: profiles || [] });
});
