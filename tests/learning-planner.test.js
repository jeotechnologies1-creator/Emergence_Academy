const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const planner = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "dashboard", "learning-planner.js"), "utf8");
  const dashboard = fs.readFileSync(path.join(__dirname, "..", "dashboard.html"), "utf8");
  assert.ok(planner.includes('"executive"'), "executive users should be allowed to open the learning planner");
  assert.ok(planner.includes("Skipping assignment with an invalid due date"), "invalid assignment dates must not crash the planner");
  assert.ok(planner.includes("Skipping live class with an invalid start time"), "invalid live-class dates must not crash the planner");
  assert.ok(dashboard.includes("learning-planner.js?v=1.0.1"), "the browser must load the repaired learning-planner asset");
  console.log("learning planner resilience test passed");
})();
