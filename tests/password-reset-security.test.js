const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const functionCode = read("supabase", "functions", "create-user", "index.ts");
  const profileModule = read("assets", "js", "dashboard", "ProfilesModule.js");
  const responseHelper = read("supabase", "functions", "_shared", "response.ts");

  assert.ok(functionCode.includes("generateTemporaryPassword"), "resets must generate a unique temporary password");
  assert.ok(functionCode.includes("temporary_password"), "the one-time password must be returned only to the reset caller");
  assert.ok(!functionCode.includes("DEFAULT_RESET_PASSWORD"), "resets must not reuse a hard-coded password");
  assert.ok(!profileModule.includes("Emergence2026!"), "the browser must not contain a universal reset password");
  assert.ok(profileModule.includes("showTemporaryPassword"), "administrators need a secure one-time hand-off view");
  assert.ok(responseHelper.includes('from "./core.ts"'), "the shared response helper must import its existing CORS module");
  console.log("password reset security regression test passed");
})();
