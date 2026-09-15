const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const code = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "dashboard", "dashboard-home.js"), "utf8");
  assert.ok(code.includes("crypto.getRandomValues"), "temporary account passwords must use Web Crypto");
  assert.ok(code.includes("const sanitized = list.map"), "older stored credentials must be scrubbed from local storage");
  assert.ok(code.includes("const { temp_password, ...safeAccount }"), "new recent-account records must omit passwords");
  assert.ok(!code.includes('data-account-action="copy-password"'), "recent account records must not expose saved passwords");
  assert.ok(!code.includes("Invite resend queued"), "the UI must not claim that an unsupported invite was sent");
  console.log("credential storage security regression test passed");
})();
