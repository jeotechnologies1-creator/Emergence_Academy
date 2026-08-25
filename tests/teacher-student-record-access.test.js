const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const studentAccess = read("supabase", "migrations", "202608190011_match_teacher_students_by_assigned_class.sql");
  const assignedClassRepair = read("supabase", "migrations", "202608250003_show_assigned_class_students_to_teachers.sql");
  const recordAccess = studentAccess;
  const scheduling = read("supabase", "functions", "schedule-live-class", "index.ts");

  assert.ok(studentAccess.includes("on ts.class_id = s.class_id"), "Teachers should see only students in an assigned class.");
  assert.ok(!studentAccess.includes("student_subjects"), "Teachers should see every student enrolled in an assigned class, without a subject-enrolment filter.");
  assert.ok(recordAccess.includes("teacher_can_access_student(student_id)"), "Attendance and grades should use the same scoped teacher student access.");
  assert.ok(recordAccess.includes("ts.class_id = s.class_id"), "Grades must stay within the teacher's assigned class.");
  assert.ok(scheduling.includes("teacher_subjects"), "Live class scheduling must remain restricted to the teacher's assignments.");
  assert.ok(scheduling.includes("approved_student_ids"), "Teachers should be able to approve eligible students for live classes.");
  assert.ok(assignedClassRepair.includes("join public.teacher_subjects ts on ts.class_id = s.class_id"), "new teacher assignments must immediately expose students in the assigned class");
  assert.ok(assignedClassRepair.includes("teacher_read_assigned_student_profiles"), "teachers must receive the linked student profiles in their dashboard list");

  console.log("teacher student record access regression test passed");
})();
