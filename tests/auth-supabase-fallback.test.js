const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
  const authCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'auth.js'), 'utf8');
  const sandbox = {
    window: {},
    document: {
      addEventListener() {}
    },
    console,
    setTimeout,
    clearTimeout
  };

  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const Auth = vm.runInContext('Auth', sandbox);

  assert.throws(
    () => Auth.ensureSupabaseClient(),
    /Supabase client is not initialized/,
    'auth should fail fast when Supabase client is unavailable'
  );

  console.log('supabase strict auth initialization test passed');
})();
