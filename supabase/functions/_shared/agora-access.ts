import { adminClient, normalizedRole } from "./live-class.ts";

export type AgoraAccessRole = "publisher" | "subscriber";

export async function validateAgoraLiveClassAccess(userId: string, liveClassId: string) {
  const admin = adminClient();
  const [{ data: liveClass, error: liveClassError }, { data: profile, error: profileError }] = await Promise.all([
    admin.from("live_classes").select("id,class_id,subject_id,teacher_id,status,starts_at,ends_at").eq("id", liveClassId).maybeSingle(),
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  if (liveClassError) throw liveClassError;
  if (profileError) throw profileError;
  if (!liveClass) throw new Error("Live class was not found.");

  const role = normalizedRole(profile?.role);
  const hasUniversalAccess = ["admin", "ceo", "executive"].includes(role);

  if (hasUniversalAccess || role === "teacher") {
    if (role === "teacher") {
      const { data: teacher, error: teacherError } = await admin.from("teachers").select("id").eq("profile_id", userId).maybeSingle();
      if (teacherError) throw teacherError;
      if (String(teacher?.id) !== String(liveClass.teacher_id)) {
        throw new Error("You are not the teacher assigned to this live class.");
      }
    }
    return { allow: true, role: "publisher" as const, liveClass };
  }

  if (role === "student") {
    const { data: student, error: studentError } = await admin.from("students").select("id,class_id").eq("profile_id", userId).maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new Error("This student profile is not linked to a class record.");

    const { data: enrolled, error: enrollmentError } = await admin.rpc("student_can_access_live_class", {
      p_student_id: student.id,
      p_class_id: liveClass.class_id,
    });

    if (enrollmentError) throw enrollmentError;
    if (!enrolled) throw new Error("You are not enrolled in this class.");

    const { data: approved, error: approvalError } = await admin
      .from("live_class_students")
      .select("student_id")
      .eq("live_class_id", liveClass.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (approvalError) throw approvalError;
    if (!approved) throw new Error("You are not approved for this live class.");

    return { allow: true, role: "subscriber" as const, liveClass };
  }

  throw new Error("You do not have access to this live class room.");
}
