const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

(() => {
  const parents = read("assets", "js", "dashboard", "parents.js");
  const engine = read("assets", "js", "dashboard", "module-stub.js");
  const finance = read("assets", "js", "dashboard", "finance.js");
  const students = read("assets", "js", "dashboard", "students.js");
  const profileMigration = read("supabase", "migrations", "202608190006_admin_manage_all_profiles.sql");

  ["parent_name", "parent_email", "parent_phone", "children", "transformRows"].forEach((value) => {
    assert.ok(parents.includes(value), `Parents module should display ${value}.`);
  });
  assert.ok(engine.includes("transformRows"), "The module engine should support enriched display rows.");
  assert.ok(finance.includes("data-finance-receipt-path"), "Finance staff should be able to open submitted receipts.");
  assert.ok(finance.includes("parent-payment-submit"), "The parent payment submit action should always be rendered.");
  assert.ok(finance.includes("updateSubmitState"), "The parent payment submit action should react to required fields.");
  assert.ok(finance.includes("form.checkValidity()"), "The parent payment form should enable submission only when valid.");
  assert.ok(finance.includes("payment-plan-submit"), "The admin payment-plan save action should be visible and explicitly submit the form.");
  const api = read("assets", "js", "api", "index.js");
  assert.ok(api.includes('role === "teacher"'), "Teachers should use a student-scoped profile query instead of the admin profile directory.");
  assert.ok(api.includes("profiles:profile_id(id,first_name,last_name,email,phone,avatar_url)"), "Teacher student rows should include their permitted profile details.");
  assert.ok(students.includes("create-parent"), "Admins should be able to start parent creation from a student row.");
  assert.ok(parents.includes("openForStudent"), "The parent form should preselect the student chosen by the admin.");
  assert.ok(parents.includes("parent_students"), "Parent edits should persist parent-student links.");
  assert.ok(parents.includes("Not linked — edit this parent"), "Unlinked parents should be clearly identified for repair.");
  assert.ok(profileMigration.includes("profiles_admin_manage"), "Admin profile management policy should be present.");

  console.log("parent profile and payment visibility regression test passed");
})();
