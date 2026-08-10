import { adminClient, caller, corsHeaders, json, normalizedRole, statusFor } from "../_shared/live-class.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await caller(req);
    if (!user) return json({ error: "Authentication is required." }, 401);
    const { live_class_id: id } = await req.json();
    if (!id) return json({ error: "Live class is required." }, 400);
    const admin = adminClient();
    const [{ data: profile }, { data: liveClass, error }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      admin.from("live_classes").select("id,subject_id,teacher_id,starts_at,ends_at,status,meeting_url").eq("id", id).maybeSingle(),
    ]);
    if (error || !liveClass) return json({ error: "Live class was not found." }, 404);
    const role = normalizedRole(profile?.role);
    if (role === "student") {
      const { data: student } = await admin.from("students").select("id").eq("profile_id", user.id).maybeSingle();
      const { data: enrolled, error: enrollmentError } = student
        ? await admin.rpc("student_can_access_live_class", { p_student_id: student.id, p_class_id: liveClass.class_id })
        : { data: false, error: null };
      if (enrollmentError) throw enrollmentError;
      if (!enrolled) return json({ error: "You are not enrolled in this course and cannot join this class." }, 403);
    } else if (role === "teacher") {
      const { data: teacher } = await admin.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
      if (String(teacher?.id) !== String(liveClass.teacher_id)) return json({ error: "You cannot join another teacher's class." }, 403);
    } else if (!["admin", "ceo", "executive"].includes(role)) return json({ error: "You do not have access to this live class." }, 403);
    const status = statusFor(liveClass.starts_at, liveClass.ends_at, liveClass.status);
    if (status === "upcoming") return json({ error: "This class has not started yet." }, 409);
    if (status === "ended" || status === "cancelled") return json({ error: status === "ended" ? "This live class has ended." : "This live class was cancelled." }, 409);
    if (!liveClass.meeting_url) return json({ error: "The Google Meet link is currently unavailable." }, 409);
    return json({ success: true, meeting_url: liveClass.meeting_url });
  } catch (error) {
    console.error("join-live-class failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to join the live class." }, 500);
  }
});
