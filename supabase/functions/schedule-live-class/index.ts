import { adminClient, caller, corsHeaders, json, normalizedRole } from "../_shared/live-class.ts";

async function createGoogleMeet(title: string, description: string, startsAt: string, endsAt: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Calendar integration is not configured.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) {
    const detail = String(token?.error_description || token?.error || "Google rejected the saved OAuth credentials.");
    throw new Error(`Unable to authorize Google Calendar: ${detail}`);
  }

  const eventResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title,
      description,
      start: { dateTime: startsAt },
      end: { dateTime: endsAt },
      conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
  });
  const event = await eventResponse.json();
  const meetingUrl = event.hangoutLink || event.conferenceData?.entryPoints?.find((entry: { entryPointType: string }) => entry.entryPointType === "video")?.uri;
  if (!eventResponse.ok || !event.id || !meetingUrl) throw new Error("Google Calendar did not return a Google Meet link.");
  return { eventId: event.id as string, meetingUrl: meetingUrl as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await caller(req);
    if (!user) return json({ error: "Authentication is required." }, 401);
    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const subjectId = String(body.subject_id || "").trim();
    const classId = String(body.class_id || "").trim();
    const startsAt = new Date(String(body.starts_at || ""));
    const endsAt = new Date(String(body.ends_at || ""));
    const approvedStudentIds = Array.isArray(body.approved_student_ids)
      ? [...new Set(body.approved_student_ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];
    if (!title || !subjectId || !classId || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt <= new Date() || endsAt <= startsAt) return json({ error: "Provide a title, subject, class, and valid future start/end times." }, 400);
    if (!approvedStudentIds.length) return json({ error: "Approve at least one enrolled student for this live class." }, 400);

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    if (!profile || String(profile.status).toLowerCase() !== "active") return json({ error: "Your account is not active." }, 403);
    const role = normalizedRole(profile.role);
    let teacherId = "";
    if (role === "teacher") {
      const { data: teacher } = await admin.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
      teacherId = String(teacher?.id || "");
      if (!teacherId) return json({ error: "Your teacher record could not be found." }, 403);
      const { data: assignment } = await admin.from("teacher_subjects").select("teacher_id").eq("teacher_id", teacherId).eq("subject_id", subjectId).eq("class_id", classId).maybeSingle();
      if (!assignment) return json({ error: "You are not authorized to schedule a class for this subject and class." }, 403);
    } else if (["admin", "ceo", "executive"].includes(role)) {
      teacherId = String(body.teacher_id || "");
      if (!teacherId) return json({ error: "Select the teacher assigned to this class." }, 400);
    } else return json({ error: "Only an assigned teacher or administrator can schedule live classes." }, 403);

    const { data: eligibleStudents, error: studentsError } = await admin
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .in("id", approvedStudentIds);
    if (studentsError) throw studentsError;
    const eligibleIds = new Set((eligibleStudents || []).map((student) => String(student.id)));
    if (eligibleIds.size !== approvedStudentIds.length) {
      return json({ error: "Every approved student must belong to the selected class." }, 400);
    }

    const meet = await createGoogleMeet(title, description, startsAt.toISOString(), endsAt.toISOString());
    const { data: liveClass, error } = await admin.from("live_classes").insert({
      title, description: description || null, subject_id: subjectId, class_id: classId, teacher_id: teacherId,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
      meeting_url: meet.meetingUrl, google_event_id: meet.eventId, status: "scheduled",
    }).select("id,title,subject_id,class_id,teacher_id,starts_at,ends_at,status,created_at").single();
    if (error) throw error;
    const { error: approvalError } = await admin.from("live_class_students").insert(
      approvedStudentIds.map((studentId) => ({
        live_class_id: liveClass.id,
        student_id: studentId,
        approved_by: user.id,
      })),
    );
    if (approvalError) {
      await admin.from("live_classes").delete().eq("id", liveClass.id);
      throw approvalError;
    }
    return json({ success: true, live_class: liveClass, meeting_url: meet.meetingUrl });
  } catch (error) {
    console.error("schedule-live-class failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to create the Google Meet class." }, 500);
  }
});
