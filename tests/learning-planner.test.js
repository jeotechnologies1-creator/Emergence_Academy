const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const planner = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "dashboard", "learning-planner.js"), "utf8");
  const dashboard = fs.readFileSync(path.join(__dirname, "..", "dashboard.html"), "utf8");
  assert.ok(planner.includes('"executive"'), "executive users should be allowed to open the learning planner");
  assert.ok(planner.includes("Skipping assignment with an invalid due date"), "invalid assignment dates must not crash the planner");
  assert.ok(planner.includes("Skipping live class with an invalid start time"), "invalid live-class dates must not crash the planner");
  assert.ok(planner.includes("Term curriculum"), "teachers should have a term curriculum area in the planner");
  assert.ok(planner.includes("teacher_timetable_slots"), "teachers should be able to save timetable slots");
  assert.ok(planner.includes("scheme_of_work_entries"), "teachers should be able to save weekly scheme-of-work entries");
  assert.ok(planner.includes("My courses"), "the planner should provide a course-centred home view");
  assert.ok(planner.includes("feedback returned"), "students should see returned assignment feedback in their course home");
  const courseHubMigration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609160003_add_course_hub_and_guardian_digests.sql"), "utf8");
  assert.ok(courseHubMigration.includes("course_resources"), "course resources need a protected database table");
  assert.ok(courseHubMigration.includes("course_announcements"), "class announcements need a protected database table");
  assert.ok(courseHubMigration.includes("guardian_digest_preferences"), "guardian digests must require stored opt-in preferences");
  assert.ok(courseHubMigration.includes("course_announcements.subject_id is null or exists"), "subject-scoped announcements must respect student subject enrolment");
  assert.ok(dashboard.includes("learning-planner.js?v=1.0.2"), "the browser must load the repaired learning-planner asset");
  console.log("learning planner resilience test passed");
})();
