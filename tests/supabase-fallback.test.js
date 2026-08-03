const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'supabase.js'), 'utf8');
  const context = {
    window: {
      CONFIG: {
        SUPABASE: { URL: 'https://example.supabase.co', ANON_KEY: 'key' }
      },
      localStorage: {
        store: {},
        getItem(key) { return this.store[key] ?? null; },
        setItem(key, value) { this.store[key] = String(value); },
        removeItem(key) { delete this.store[key]; }
      },
      sessionStorage: {
        store: {},
        getItem(key) { return this.store[key] ?? null; },
        setItem(key, value) { this.store[key] = String(value); },
        removeItem(key) { delete this.store[key]; }
      },
      console,
      supabase: undefined
    },
    console,
    localStorage: null,
    sessionStorage: null
  };
  context.window.window = context.window;
  context.window.localStorage = context.window.localStorage;
  context.window.sessionStorage = context.window.sessionStorage;
  context.localStorage = context.window.localStorage;
  context.sessionStorage = context.window.sessionStorage;

  const vmContext = vm.createContext(context);
  vm.runInContext(source, vmContext);

  const client = vm.runInContext('window.supabaseClient', vmContext);
  assert.ok(client.auth.signInWithPassword, 'fallback client should expose signInWithPassword');
  assert.ok(client.auth.signUp, 'fallback client should expose signUp');

  const adminResult = await client.auth.signInWithPassword({ email: 'admin@emergence.edu', password: 'Emergence2026!' });
  assert.strictEqual(adminResult.data.user.email, 'admin@emergence.edu', 'admin fallback login should work');

  console.log('supabase fallback auth test passed');
})();
