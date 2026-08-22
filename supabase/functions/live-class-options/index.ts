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
    const [subjectsResult, classesResult, studentsResult] = await Promise.all([
      subjectIds.length ? admin.from("subjects").select("id,subject_name").in("id", subjectIds) : { data: [], error: null },
      classIds.length ? admin.from("classes").select("id,class_name").in("id", classIds) : { data: [], error: null },
      classIds.length ? admin.from("students").select("id,student_no,admission_number,class_id,profiles:profile_id(first_name,last_name,email)").in("class_id", classIds) : { data: [], error: null },
    ]);
    if (subjectsResult.error || classesResult.error || studentsResult.error) throw subjectsResult.error || classesResult.error || studentsResult.error;

    // Student participation follows class enrolment. Subject enrolment is not
    // required for a class teacher to manage attendance, grades, or sessions.
    const students = studentsResult.data || [];

    return json({ success: true, teacher, assignments: assignments || [], subjects: subjectsResult.data || [], classes: classesResult.data || [], students });
  } catch (error) {
    console.error("live-class-options failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to load live class scheduling options." }, 500);
  }
});
