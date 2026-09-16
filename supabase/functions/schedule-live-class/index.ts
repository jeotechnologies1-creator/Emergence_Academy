import { adminClient, caller, corsHeaders, json, normalizedRole } from "../_shared/live-class.ts";

function makeAgoraRoomName(title: string, classId: string, subjectId: string) {
  const base = `${title || "live-class"}-${classId || "class"}-${subjectId || "subject"}-${Date.now()}`;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `emergence-live-class-${Date.now()}`;
}

function makeAgoraRoomUrl(channelName: string) {
  return `https://agora-live.emergence.academy/session/${encodeURIComponent(channelName)}`;
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
    if (!approvedStudentIds.length) return json({ error: "Select at least one enrolled student for this live class." }, 400);

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || String(profile.status).toLowerCase() !== "active") return json({ error: "Your account is not active." }, 403);
    const role = normalizedRole(profile.role);
    let teacherId = "";
    if (role === "teacher") {
      const { data: teacher, error: teacherError } = await admin.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
      if (teacherError) throw teacherError;
      teacherId = String(teacher?.id || "");
      if (!teacherId) return json({ error: "Your teacher record could not be found." }, 403);
      const { data: assignment, error: assignmentError } = await admin.from("teacher_subjects").select("teacher_id").eq("teacher_id", teacherId).eq("subject_id", subjectId).eq("class_id", classId).maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return json({ error: "You are not authorized to schedule a class for this subject and class." }, 403);
    } else if (["admin", "ceo", "executive"].includes(role)) {
      teacherId = String(body.teacher_id || "");
      if (!teacherId) return json({ error: "Select the teacher assigned to this class." }, 400);
    } else return json({ error: "Only an assigned teacher or administrator can schedule live classes." }, 403);

    const { data: approvedStudents, error: studentsError } = await admin
      .from("students")
      .select("id,profile_id")
      .eq("class_id", classId)
      .in("id", approvedStudentIds);
    if (studentsError) throw studentsError;
    if (!approvedStudents?.length || approvedStudents.length !== approvedStudentIds.length) return json({ error: "Every selected student must be enrolled in the selected class." }, 400);

    const roomName = makeAgoraRoomName(title, classId, subjectId);
    const roomUrl = makeAgoraRoomUrl(roomName);
    const { data: liveClass, error } = await admin.from("live_classes").insert({
      title, description: description || null, subject_id: subjectId, class_id: classId, teacher_id: teacherId,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
      meeting_url: roomUrl, agora_channel_name: roomName, status: "scheduled",
    }).select("id,title,subject_id,class_id,teacher_id,starts_at,ends_at,status,created_at").single();
    if (error) throw error;
    const { error: approvalError } = await admin.from("live_class_students").insert(
      approvedStudents.map((student) => ({
        live_class_id: liveClass.id,
        student_id: student.id,
        approved_by: user.id,
      })),
    );
    if (approvalError) {
      await admin.from("live_classes").delete().eq("id", liveClass.id);
      throw approvalError;
    }
    const startsAtLabel = startsAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
    const notificationRows = approvedStudents
      .filter((student) => student.profile_id)
      .map((student) => ({
        user_id: student.profile_id,
        target_role: "student",
        title: `Live class scheduled: ${title}`,
        message: `${title} is scheduled for ${startsAtLabel}. Select Join live class when the teacher starts the Agora session. [live-class:${liveClass.id}]`,
      }));
    if (notificationRows.length) {
      const { error: notificationError } = await admin.from("notifications").insert(notificationRows);
      if (notificationError) {
        await admin.from("live_classes").delete().eq("id", liveClass.id);
        throw notificationError;
      }
    }
    return json({ success: true, live_class: liveClass, meeting_url: roomUrl, channel_name: roomName });
  } catch (error) {
    console.error("schedule-live-class failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to create the Agora live class." }, 500);
  }
});
