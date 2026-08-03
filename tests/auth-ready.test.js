const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'auth.js'), 'utf8');

  const context = {
    window: {
      location: { origin: 'http://localhost' },
      supabaseClient: {
        auth: {
          onAuthStateChange: () => {},
          getUser: async () => ({ data: { user: { id: 'u1', email: 'user@example.com', email_confirmed_at: new Date().toISOString() } }, error: null }),
          getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }),
          signOut: async () => {}
        },
        from: () => ({
          upsert: async () => ({ error: null }),
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { role: 'teacher' }, error: null })
            })
          }),
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        storage: {
          from: () => ({
            upload: async () => ({ error: null }),
            getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/avatar.png' } })
          })
        }
      },
      currentSession: null,
      location: { origin: 'http://localhost' },
      localStorage: { removeItem: () => {} },
      sessionStorage: { clear: () => {} },
      CONFIG: { SESSION_KEY: 'test-session' }
    },
    document: {
      addEventListener: () => {},
      querySelectorAll: () => []
    },
    console,
    setTimeout,
    clearTimeout,
    Object,
    Date,
    localStorage: { removeItem: () => {} },
    sessionStorage: { clear: () => {} },
    CONFIG: { SESSION_KEY: 'test-session' }
  };

  context.window.window = context.window;
  context.window.document = context.document;
  context.window.console = console;
  context.window.localStorage = context.window.localStorage;
  context.window.sessionStorage = context.window.sessionStorage;
  context.window.CONFIG = context.window.CONFIG;

  const vmContext = vm.createContext(context);
  vm.runInContext(code, vmContext);

  const Auth = vm.runInContext('Auth', vmContext);
  const result = await Auth.ready();

  assert.strictEqual(result, true, 'Auth.ready should complete successfully without throwing');
  console.log('auth ready regression test passed');
})();
