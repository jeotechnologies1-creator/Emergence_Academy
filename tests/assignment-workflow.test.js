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
  console.log("assignment workflow regression test passed");
})();
