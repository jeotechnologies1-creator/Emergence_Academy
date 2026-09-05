import { caller, corsHeaders, json } from "../_shared/live-class.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-access-token@2.8.0";
import { adminClient } from "../_shared/live-class.ts";

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

    const body = await req.json();
    const liveClassId = String(body.live_class_id || body.liveClassId || "").trim();
    const channelName = String(body.channel_name || body.channelName || "").trim();
    if (!liveClassId) return json({ error: "Live class ID is required." }, 400);
    if (!channelName) return json({ error: "Channel name is required." }, 400);

    const admin = adminClient();
    const [{ data: profile, error: profileError }, { data: liveClass, error: liveClassError }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      admin.from("live_classes").select("id,teacher_id").eq("id", liveClassId).maybeSingle(),
    ]);

    if (profileError) throw profileError;
    if (liveClassError) throw liveClassError;
    if (!liveClass) return json({ error: "Live class was not found." }, 404);

    const role = String(profile?.role || "").trim().toLowerCase();
    const isTeacher = ["teacher", "admin", "ceo", "executive"].includes(role);
    if (!isTeacher) return json({ error: "Only teachers and administrators can create an Agora room." }, 403);

    if (role === "teacher") {
      const { data: teacher, error: teacherError } = await admin.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (String(teacher?.id) !== String(liveClass.teacher_id)) {
        return json({ error: "You are not the assigned teacher for this live class." }, 403);
      }
    }

    const uid = Number(body.uid) || 0;
    const expirySeconds = 3600;
    const now = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = now + expirySeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
    );

    return json({
      success: true,
      token,
      app_id: appId,
      channel_name: channelName,
      uid,
      role: "publisher",
      live_class_id: liveClassId,
      expires_at: privilegeExpiredTs,
    });
  } catch (error) {
    console.error("agora-create-room failed", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to create the Agora room.",
    }, 500);
  }
});
