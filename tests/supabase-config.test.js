const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'supabase.js'), 'utf8');

  const captured = [];
  const context = {
    window: {
      supabase: {
        createClient: (url, key, options) => {
          captured.push({ url, key, options });
          return { auth: { onAuthStateChange: () => {} }, from: () => ({}) };
        }
      },
      CONFIG: {
        SUPABASE: {
          URL: 'https://custom.supabase.co',
          ANON_KEY: 'custom-anon-key'
        }
      }
    },
    document: { addEventListener() {} },
    console,
    localStorage: { removeItem() {} },
    sessionStorage: { clear() {} },
    setTimeout,
    clearTimeout,
    Date,
    Object,
    Array,
    Promise
  };

  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.sessionStorage = context.sessionStorage;
  context.window.console = console;

  const vmContext = vm.createContext(context);
  vm.runInContext(code, vmContext);

  assert.strictEqual(captured.length, 1, 'expected one Supabase client initialization');
  assert.strictEqual(captured[0].url, 'https://custom.supabase.co');
  assert.strictEqual(captured[0].key, 'custom-anon-key');
  console.log('supabase config regression test passed');
})();
