const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'auth.js'), 'utf8');
  const context = {
    window: {
      location: { origin: 'http://localhost', href: 'http://localhost/' },
      supabaseClient: {
        auth: {
          onAuthStateChange: () => {},
          signInWithPassword: async () => ({ data: { user: { email_confirmed_at: new Date().toISOString() } }, error: null }),
          signOut: async () => {},
          getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
          getSession: async () => ({ data: { session: { access_token: 't' } }, error: null })
        },
        from: () => ({
          upsert: async () => ({ error: null }),
          select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'teacher' }, error: null }) }) }),
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/avatar.png' } }) }) }
      },
      CONFIG: { DASHBOARDS: { teacher: 'teacher.html', student: 'student.html', admin: 'admin.html' }, SESSION_KEY: 'session' }
    },
    document: { addEventListener() {} },
    console,
    localStorage: { removeItem() {} },
    sessionStorage: { clear() {} },
    setTimeout,
    clearTimeout,
    Date,
    Object,
    Promise
  };

  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.sessionStorage = context.sessionStorage;
  context.window.console = console;
  context.CONFIG = context.window.CONFIG;

  const vmContext = vm.createContext(context);
  vm.runInContext(code, vmContext);
  const Auth = vm.runInContext('Auth', vmContext);

  Auth.profile = async () => ({ role: 'Teacher' });

  const dashboard = await Auth.getDashboard();
  assert.strictEqual(dashboard, 'teacher.html', 'role-based dashboard should resolve from normalized role names');
  console.log('auth dashboard redirect regression test passed');
})();
