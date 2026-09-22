const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const examplePath = path.join(root, "supabase/functions/.env.example");
const trackedFiles = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

assert.ok(fs.existsSync(examplePath), "Edge Functions should provide a safe local environment template.");
assert.ok(!trackedFiles.includes("supabase/functions/.env"), "The real Edge Function environment file must not be tracked by Git.");

const example = fs.readFileSync(examplePath, "utf8");
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  assert.match(example, new RegExp(`^${name}=$`, "m"), `${name} should be documented without a value.`);
}

console.log("# edge-function environment configuration regression test passed");
