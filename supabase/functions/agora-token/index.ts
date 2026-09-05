import { adminClient, caller, corsHeaders, json, normalizedRole } from "../_shared/live-class.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-access-token@2.8.0";

function roleForToken(profileRole: unknown) {
  const role = normalizedRole(profileRole);
  if (role === "teacher" || role === "admin" || role === "ceo" || role === "executive") {
    return { role: "publisher", agoraRole: RtcRole.PUBLISHER };
  }
  if (role === "student" || role === "parent") {
    return { role: "subscriber", agoraRole: RtcRole.SUBSCRIBER };
  }
  return { role: "subscriber", agoraRole: RtcRole.SUBSCRIBER };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const user = await caller(req);
    if (!user) return json({ error: "Authentication is required." }, 401);

    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!appId || !appCertificate) {
      return json({
        error: "Agora project credentials are not configured on the server. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in Supabase Edge Function environment variables.",
      }, 500);
    }

    const { channel_name: channelName, uid = 0 } = await req.json();
    if (!channelName) return json({ error: "Channel name is required." }, 400);

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const tokenPolicy = roleForToken(profile?.role);

    const safeUid = Number(uid) || 0;
    const expirySeconds = 3600;
    const now = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = now + expirySeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      String(channelName),
      safeUid,
      tokenPolicy.agoraRole,
      privilegeExpiredTs,
    );

    return json({
      success: true,
      token,
      app_id: appId,
      channel_name: String(channelName),
      uid: safeUid,
      role: tokenPolicy.role,
      expires_at: privilegeExpiredTs,
    });
  } catch (error) {
    console.error("agora-token failed", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to generate a secure Agora token.",
    }, 500);
  }
});
