const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const studentAccess = read("supabase", "migrations", "202608190009_match_teacher_students_by_assigned_class_and_subject.sql");
  const recordAccess = read("supabase", "migrations", "202608190008_teacher_record_access_for_assigned_students.sql");
  const scheduling = read("supabase", "functions", "schedule-live-class", "index.ts");

  assert.ok(studentAccess.includes("on ts.class_id = s.class_id"), "Teachers should see only students in an assigned class.");
  assert.ok(studentAccess.includes("and ss.subject_id = ts.subject_id"), "Teachers should see only students offering the assigned subject.");
  assert.ok(recordAccess.includes("teacher_can_access_student(student_id)"), "Attendance and grades should use the same scoped teacher student access.");
  assert.ok(recordAccess.includes("join public.student_subjects ss"), "Grades must require the student to offer the graded subject.");
  assert.ok(scheduling.includes("teacher_subjects"), "Live class scheduling must remain restricted to the teacher's assignments.");
  assert.ok(scheduling.includes("approved_student_ids"), "Teachers should be able to approve eligible students for live classes.");

  console.log("teacher student record access regression test passed");
})();
