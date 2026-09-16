import { caller, corsHeaders, json, statusFor } from "../_shared/live-class.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.6";
import { validateAgoraLiveClassAccess } from "../_shared/agora-access.ts";

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

    const { live_class_id: liveClassId, liveClassId: camelLiveClassId, channel_name: channelName, channelName: camelChannelName, uid = 0 } = await req.json();
    const requestedLiveClassId = String(liveClassId || camelLiveClassId || "").trim();
    const requestedChannelName = String(channelName || camelChannelName || "").trim();
    if (!requestedLiveClassId) return json({ error: "Live class ID is required." }, 400);
    if (!requestedChannelName) return json({ error: "Channel name is required." }, 400);

    const access = await validateAgoraLiveClassAccess(user.id, requestedLiveClassId);
    if (requestedChannelName !== String(access.liveClass.agora_channel_name || "")) {
      return json({ error: "Invalid Agora channel for this live class." }, 403);
    }
    const sessionStatus = statusFor(access.liveClass.starts_at, access.liveClass.ends_at, access.liveClass.status);
    if (sessionStatus !== "live") {
      return json({ error: sessionStatus === "ended" ? "This live class has ended." : "This class has not started yet." }, 409);
    }
    const agoraRole = access.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const safeUid = Number(uid) || 0;
    const expirySeconds = 3600;
    const now = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = now + expirySeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      requestedChannelName,
      safeUid,
      agoraRole,
      privilegeExpiredTs,
    );

    return json({
      success: true,
      token,
      app_id: appId,
      channel_name: requestedChannelName,
      uid: safeUid,
      role: access.role,
      live_class_id: requestedLiveClassId,
      expires_at: privilegeExpiredTs,
    });
  } catch (error) {
    console.error("agora-token failed", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to generate a secure Agora token.",
    }, 500);
  }
});
