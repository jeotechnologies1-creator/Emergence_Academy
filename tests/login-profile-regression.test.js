const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "auth.js"), "utf8");
const recoverySource = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "ensure-profile", "index.ts"), "utf8");
const roles = ["ceo", "admin", "executive", "teacher", "student", "parent", "finance", "hr", "admission", "exam", "library"];

function authFor(profile) {
  let signOutCalls = 0;
  const storage = new Map();
  const context = {
    window: {
      location: { pathname: "/login.html", replace() {}, reload() {} },
      CONFIG: { STATUS: { ACTIVE: "active" }, DASHBOARDS: {} },
      localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
      sessionStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), clear: () => storage.clear() },
      supabaseClient: {
        auth: {
          signInWithPassword: async () => ({ data: { user: { id: "user-1", email: "user@example.com" }, session: { access_token: "token" } }, error: null }),
          getUser: async () => ({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null }),
          getSession: async () => ({ data: { session: { access_token: "token" } }, error: null }),
          signOut: async () => { signOutCalls += 1; },
          onAuthStateChange() {}
        },
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: null }) }) }) })
      }
    },
    document: { addEventListener() {} }, console, Date, Object, Promise, setTimeout, clearTimeout
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.console = console;
  const sandbox = vm.createContext(context);
  vm.runInContext(source, sandbox);
  return { Auth: vm.runInContext("Auth", sandbox), signOutCalls: () => signOutCalls };
}

(async () => {
  for (const role of roles) {
    const fixture = authFor({ id: "user-1", role, status: "active" });
    const result = await fixture.Auth.login("user@example.com", "password", "admin");
    assert.strictEqual(result.success, true, `${role} should sign in using its database role`);
    assert.strictEqual(fixture.signOutCalls(), 0, `${role} should not be signed out for a portal-selection mismatch`);
  }

  const missingProfile = authFor(null);
  const missingResult = await missingProfile.Auth.login("user@example.com", "password", "student");
  assert.strictEqual(missingResult.success, false, "a missing profile should show an error");
  assert.strictEqual(missingProfile.signOutCalls(), 0, "a missing profile lookup must not force an immediate logout");

  assert.match(source, /functions\.invoke\("ensure-profile"/, "profile lookup failures should use the trusted recovery function");
  assert.match(recoverySource, /role:\s*"student"/, "recovered missing profiles must start with the least-privileged role");
  assert.doesNotMatch(recoverySource, /roleFor\(metadata\.role\)/, "profile recovery must not trust a caller-controlled role");

  console.log("login profile regression test passed");
})();
