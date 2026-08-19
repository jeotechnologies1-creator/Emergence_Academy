import { adminClient, caller, corsHeaders, json, normalizedRole } from "../_shared/live-class.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed." }, 405);
  try {
    const user = await caller(req);
    if (!user) return json({ error: "Authentication is required." }, 401);
    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (normalizedRole(profile?.role) !== "teacher") return json({ error: "Only teachers can load scheduling options." }, 403);
    const { data: teacher } = await admin.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
    if (!teacher) return json({ error: "Your teacher record could not be found." }, 403);
    const { data: assignments, error: assignmentError } = await admin
      .from("teacher_subjects").select("teacher_id,subject_id,class_id").eq("teacher_id", teacher.id);
    if (assignmentError) throw assignmentError;
    const subjectIds = [...new Set((assignments || []).map((row) => row.subject_id))];
    const classIds = [...new Set((assignments || []).map((row) => row.class_id))];
    const [subjectsResult, classesResult, studentsResult, enrollmentsResult] = await Promise.all([
      subjectIds.length ? admin.from("subjects").select("id,subject_name").in("id", subjectIds) : { data: [], error: null },
      classIds.length ? admin.from("classes").select("id,class_name").in("id", classIds) : { data: [], error: null },
      classIds.length ? admin.from("students").select("id,student_no,admission_number,class_id,profiles:profile_id(first_name,last_name,email)").in("class_id", classIds) : { data: [], error: null },
      subjectIds.length ? admin.from("student_subjects").select("student_id,subject_id").in("subject_id", subjectIds) : { data: [], error: null },
    ]);
    if (subjectsResult.error || classesResult.error || studentsResult.error || enrollmentsResult.error) throw subjectsResult.error || classesResult.error || studentsResult.error || enrollmentsResult.error;

    const assignmentPairs = new Set((assignments || []).map((row) => `${row.class_id}:${row.subject_id}`));
    const subjectIdsByStudent = new Map<string, string[]>();
    (enrollmentsResult.data || []).forEach((row) => {
      const studentId = String(row.student_id);
      const enrolledSubjects = subjectIdsByStudent.get(studentId) || [];
      enrolledSubjects.push(String(row.subject_id));
      subjectIdsByStudent.set(studentId, enrolledSubjects);
    });
    const students = (studentsResult.data || []).flatMap((student) => {
      const enrolledSubjects = [...new Set(subjectIdsByStudent.get(String(student.id)) || [])]
        .filter((subjectId) => assignmentPairs.has(`${student.class_id}:${subjectId}`));
      return enrolledSubjects.length ? [{ ...student, subject_ids: enrolledSubjects }] : [];
    });

    return json({ success: true, teacher, assignments: assignments || [], subjects: subjectsResult.data || [], classes: classesResult.data || [], students });
  } catch (error) {
    console.error("live-class-options failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to load live class scheduling options." }, 500);
  }
});
