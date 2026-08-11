import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase function environment is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function caller(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") || "";
  if (!url || !anonKey || !authorization.startsWith("Bearer ")) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export function normalizedRole(value: unknown) {
  const aliases: Record<string, string> = {
    administrator: "admin", "super admin": "admin", admissions: "admission",
    accounting: "finance", accounts: "finance", librarian: "library",
    exams: "exam", "human resources": "hr",
  };
  const valueText = String(value || "").trim().toLowerCase().replace(/[\-_]+/g, " ").replace(/\s+/g, " ");
  return aliases[valueText] || valueText;
}

export function statusFor(startsAt: string, endsAt: string, stored: unknown) {
  const status = String(stored || "scheduled").toLowerCase();
  if (status === "cancelled" || status === "ended") return status;
  const now = Date.now();
  if (now >= new Date(endsAt).getTime()) return "ended";
  if (status === "live") return "live";
  if (now >= new Date(startsAt).getTime()) return "live";
  return "upcoming";
}
