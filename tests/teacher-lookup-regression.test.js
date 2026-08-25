const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const moduleEngine = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "dashboard", "module-stub.js"),
    "utf8",
  );

  assert.ok(
    moduleEngine.includes('if (key === "employee_id")'),
    "employee_id must not be inferred as an employees-table foreign key",
  );

  console.log("teacher lookup regression test passed");
})();
