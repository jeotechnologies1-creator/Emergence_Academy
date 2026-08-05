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
  const ready = vm.runInContext('window.supabaseReady', vmContext);
  const message = vm.runInContext('window.supabaseInitMessage', vmContext);

  assert.strictEqual(client, null, 'client should be null when SDK is missing');
  assert.strictEqual(ready, false, 'supabaseReady should be false when initialization fails');
  assert.ok(String(message).includes('missing'), 'init message should indicate missing SDK/config');

  console.log('supabase strict initialization test passed');
})();
