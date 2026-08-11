const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'js', 'logout-refresh.js'),
  'utf8'
);

let authListener;
let reloads = 0;
let replacement;
let clears = 0;

const window = {
  addEventListener(name, listener) {
    if (name === 'supabase:auth') authListener = listener;
  },
  sessionStorage: { clear() { clears += 1; } },
  location: {
    pathname: '/dashboard.html',
    replace(url) { replacement = url; },
    reload() { reloads += 1; }
  }
};
window.window = window;

vm.runInContext(code, vm.createContext({ window }));

authListener({ detail: { event: 'SIGNED_OUT' } });
authListener({ detail: { event: 'SIGNED_OUT' } });

assert.strictEqual(clears, 1, 'logout should clear page session state once');
assert.strictEqual(replacement, 'login.html?logout=1', 'logout should load a fresh login page');
assert.strictEqual(reloads, 0, 'dashboard logout should not reload the dashboard');

console.log('logout refresh regression test passed');
