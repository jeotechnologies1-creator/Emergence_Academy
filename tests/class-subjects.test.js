const assert = require("assert");
const fs = require("fs");
const path = require("path");
(() => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const moduleCode = read("assets", "js", "dashboard", "subjects.js");
  const migration = read("supabase", "migrations", "202608190013_add_class_subjects.sql");
  assert.ok(moduleCode.includes("class_subjects"), "admin subject UI must use class-subject mappings");
  assert.ok(moduleCode.includes("Add subject"), "admins must be able to add a subject to a class");
  assert.ok(migration.includes("unique (class_id, subject_id)"), "a subject should only be added once per class");
  assert.ok(migration.includes("class_subjects_admin_manage"), "only office administrators may manage class subjects");
  console.log("class subject mapping regression test passed");
})();
