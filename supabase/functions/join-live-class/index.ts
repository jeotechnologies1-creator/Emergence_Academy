import { adminClient, caller, corsHeaders, json, normalizedRole, statusFor } from "../_shared/live-class.ts";

function hasMissingColumn(error: unknown, columnName: string) {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  const details = String((error as { details?: string })?.details || "").toLowerCase();
  const hint = String((error as { hint?: string })?.hint || "").toLowerCase();
  const column = columnName.toLowerCase();
  return message.includes(column) || details.includes(column) || hint.includes(column);
}

async function recordStudentAttendanceOnJoin(
  admin: ReturnType<typeof adminClient>,
  input: {
    studentId: string;
    classId: string;
    subjectId: string;
    liveClassId: string;
  },
) {
  const attendanceDate = new Date().toISOString().slice(0, 10);
  const joinRemark = `Auto-recorded from live class join (${input.liveClassId})`;

  const modernPayload = {
    student_id: input.studentId,
    class_id: input.classId,
    subject_id: input.subjectId,
    live_class_id: input.liveClassId,
    date: attendanceDate,
    status: "present",
    remark: joinRemark,
  };

  const legacyPayload = {
    student_id: input.studentId,
    class_id: input.classId,
    date: attendanceDate,
    status: "present",
    remark: joinRemark,
  };

  const modernUpsert = await admin
    .from("attendance")
    .upsert(modernPayload, { onConflict: "live_class_id,student_id" })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!modernUpsert.error) {
    return;
  }

  const missingModernColumns =
    hasMissingColumn(modernUpsert.error, "live_class_id") ||
    hasMissingColumn(modernUpsert.error, "subject_id");

  if (!missingModernColumns) {
    throw modernUpsert.error;
  }

  const existingLegacy = await admin
    .from("attendance")
    .select("id")
    .eq("student_id", input.studentId)
    .eq("class_id", input.classId)
    .eq("date", attendanceDate)
    .eq("remark", joinRemark)
    .limit(1)
    .maybeSingle();

  if (existingLegacy.error) {
    throw existingLegacy.error;
  }

  if (existingLegacy.data?.id) {
    return;
  }

  const legacyInsert = await admin
    .from("attendance")
    .insert(legacyPayload)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (legacyInsert.error) {
    throw legacyInsert.error;
  }
}

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
      admin.from("live_classes").select("id,class_id,subject_id,teacher_id,starts_at,ends_at,status,agora_channel_name").eq("id", id).maybeSingle(),
    ]);
    if (error || !liveClass) return json({ error: "Live class was not found." }, 404);
    const role = normalizedRole(profile?.role);
    // School administrators may observe any active teacher session. Their
    // access is deliberately independent of the class roster or teacher.
    const hasUniversalLiveClassAccess = ["admin", "ceo", "executive"].includes(role);
    if (role === "student") {
      const { data: student } = await admin.from("students").select("id,class_id").eq("profile_id", user.id).maybeSingle();
      const { data: enrolled, error: enrollmentError } = student
        ? await admin.rpc("student_can_access_live_class", { p_student_id: student.id, p_class_id: liveClass.class_id })
        : { data: false, error: null };
      if (enrollmentError) throw enrollmentError;
      if (!enrolled) return json({ error: "You are not enrolled in this course and cannot join this class." }, 403);
      const { data: approval } = await admin
        .from("live_class_students")
        .select("student_id")
        .eq("live_class_id", liveClass.id)
        .eq("student_id", student.id)
        .maybeSingle();
      if (!approval) return json({ error: "You have not been approved for this live class." }, 403);

    } else if (role === "teacher") {
      const { data: teacher } = await admin.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
      if (String(teacher?.id) !== String(liveClass.teacher_id)) return json({ error: "You cannot join another teacher's class." }, 403);
    } else if (!hasUniversalLiveClassAccess) return json({ error: "You do not have access to this live class." }, 403);
    const status = statusFor(liveClass.starts_at, liveClass.ends_at, liveClass.status);
    if (status === "upcoming") return json({ error: "This class has not started yet." }, 409);
    if (status === "ended" || status === "cancelled") return json({ error: status === "ended" ? "This live class has ended." : "This live class was cancelled." }, 409);
    // The saved Agora channel, rather than the legacy meeting_url field, is
    // the authoritative room identity. This keeps valid pre-Agora records
    // from being rejected just because they have no display URL.
    if (!liveClass.agora_channel_name) return json({ error: "The Agora room is currently unavailable." }, 409);
    if (role === "student") {
      const { data: student } = await admin.from("students").select("id").eq("profile_id", user.id).maybeSingle();
      if (!student) return json({ error: "Your student record could not be found." }, 403);
      // Attendance is an audit side effect, not a prerequisite for an
      // already-authorized student's lesson. A historic attendance schema or
      // temporary write failure must never prevent the student joining Agora.
      try {
        await recordStudentAttendanceOnJoin(admin, {
          studentId: String(student.id),
          classId: String(liveClass.class_id),
          subjectId: String(liveClass.subject_id),
          liveClassId: String(liveClass.id),
        });
      } catch (attendanceError) {
        console.error("Live-class attendance recording failed", attendanceError);
      }
    }
    return json({ success: true, agora_channel_name: liveClass.agora_channel_name });
  } catch (error) {
    console.error("join-live-class failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to join the live class." }, 500);
  }
});
