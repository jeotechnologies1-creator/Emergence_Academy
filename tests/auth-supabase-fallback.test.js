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
  const client = Auth.ensureSupabaseClient();

  assert.ok(client, 'a client object should be created');
  assert.equal(typeof client.auth.signInWithPassword, 'function', 'signInWithPassword should be available');
  assert.equal(typeof client.auth.signUp, 'function', 'signUp should be available');

  console.log('supabase fallback auth test passed');
})();
