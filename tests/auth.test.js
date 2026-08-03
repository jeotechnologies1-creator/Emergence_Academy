const assert = require('assert');
const path = require('path');

(async () => {
  require(path.join(__dirname, '..', 'assets', 'js', 'database.js'));
  const { registerUser } = require(path.join(__dirname, '..', 'assets', 'js', 'auth.js'));

  const user = await registerUser({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'secret123',
    role: 'Student'
  }, { persistLocal: false });

  assert.ok(user.id, 'registration should create an id');
  assert.equal(user.email, 'jane@example.com');
  assert.equal(user.role, 'Student');
  assert.equal(user.dept, 'General');
  console.log('auth registration test passed');
})();
