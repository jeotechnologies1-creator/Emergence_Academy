const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const moduleCode = read("assets", "js", "dashboard", "assignments.js");
  const migration = read("supabase", "migrations", "202608190012_add_assignment_questions_and_submissions.sql");
  assert.ok(moduleCode.includes("question_text"), "teachers need multiple question fields");
  assert.ok(moduleCode.includes("question_image"), "teachers need question image uploads");
  assert.ok(moduleCode.includes("answer_text"), "students need a text answer field");
  assert.ok(moduleCode.includes("answer_images"), "students need answer image uploads");
  assert.ok(moduleCode.includes("teacher_subjects"), "teachers must be restricted to assigned class/subject pairs");
  assert.ok(moduleCode.includes("Review assignments given by teachers"), "admins should receive assignment-review copy");
  assert.ok(moduleCode.includes("loadAdmin"), "admins should load assignments and student answers read-only");
  assert.ok(migration.includes("assignment_submissions"), "submissions must be persisted");
  assert.ok(migration.includes("assignment-images"), "attachments need protected storage");
  assert.ok(migration.includes("a.due_date >= current_date"), "the due date must be enforced");
  assert.ok(read("supabase", "migrations", "202608190016_admin_read_assignments_and_submissions.sql").includes("admin_read_assignment_submissions"), "admins need read-only submission access");
  const privacyRepair = read("supabase", "migrations", "202608250002_lock_assignment_visibility_to_teacher_student_admin.sql");
  assert.ok(privacyRepair.includes("assignment_student_read_enrolled_subject"), "students must only read assignments for their enrolled subjects");
  assert.ok(privacyRepair.includes("submission_teacher_read_own_assignment"), "teachers must only read submissions to their own assignments");
  assert.ok(privacyRepair.includes("can_read_assignment_image"), "assignment image access must follow assignment privacy");
  console.log("assignment workflow regression test passed");
})();
