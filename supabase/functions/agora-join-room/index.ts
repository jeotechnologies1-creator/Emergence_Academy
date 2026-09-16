import { caller, corsHeaders, json, adminClient } from "../_shared/live-class.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.6";

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
      admin.from("live_classes").select("id,class_id,teacher_id,agora_channel_name").eq("id", liveClassId).maybeSingle(),
    ]);

    if (profileError) throw profileError;
    if (liveClassError) throw liveClassError;
    if (!liveClass) return json({ error: "Live class was not found." }, 404);
    if (channelName !== String(liveClass.agora_channel_name || "")) return json({ error: "Invalid Agora channel for this live class." }, 403);

    const role = String(profile?.role || "").trim().toLowerCase();
    if (["admin", "ceo", "executive"].includes(role)) {
      // Administrators may assist or monitor but they are still treated as subscriber access for the student room.
    } else if (role !== "student") {
      return json({ error: "Only approved students or administrators may join this room." }, 403);
    }

    if (role === "student") {
      const { data: student, error: studentError } = await admin.from("students").select("id,class_id").eq("profile_id", user.id).maybeSingle();
      if (studentError) throw studentError;
      if (!student) return json({ error: "This student profile is not linked to a class record." }, 403);

      const { data: enrolled, error: enrollmentError } = await admin.rpc("student_can_access_live_class", {
        p_student_id: student.id,
        p_class_id: liveClass.class_id,
      });
      if (enrollmentError) throw enrollmentError;
      if (!enrolled) return json({ error: "You are not enrolled in this class." }, 403);

      const { data: approval, error: approvalError } = await admin
        .from("live_class_students")
        .select("student_id")
        .eq("live_class_id", liveClass.id)
        .eq("student_id", student.id)
        .maybeSingle();
      if (approvalError) throw approvalError;
      if (!approval) return json({ error: "You are not approved for this live class." }, 403);
    }

    // Approved students participate in this classroom, rather than watching a
    // one-way broadcast, so they need the same publisher privilege as the
    // teacher. Administrators remain observer-only on this join route.
    const agoraRole = role === "student" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const roomRole = role === "student" ? "publisher" : "subscriber";
    const uid = Number(body.uid) || 0;
    const expirySeconds = 3600;
    const now = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = now + expirySeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs,
    );

    return json({
      success: true,
      token,
      app_id: appId,
      channel_name: channelName,
      uid,
      role: roomRole,
      live_class_id: liveClassId,
      expires_at: privilegeExpiredTs,
    });
  } catch (error) {
    console.error("agora-join-room failed", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to authorize room join.",
    }, 500);
  }
});
