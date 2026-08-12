const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

(() => {
  const students = read('assets', 'js', 'dashboard', 'students.js');
  const teachers = read('assets', 'js', 'dashboard', 'teachers.js');
  const api = read('assets', 'js', 'api', 'index.js');
  const admissionFunction = read('supabase', 'functions', 'admit-student', 'index.ts');
  const createUser = read('supabase', 'functions', 'create-user', 'index.ts');

  ["Primary 3", "Primary 6", "JSS 1", "JSS 3", "SSS 1", "SSS 3"].forEach((level) => {
    assert.ok(students.includes(`"${level}"`), `${level} should be available in student admission`);
  });

  assert.ok(students.includes('class_level'), 'student admission should send an unmapped class level safely');
  assert.ok(admissionFunction.includes('CLASS_LEVELS'), 'edge function should validate class levels');
  assert.ok(admissionFunction.includes('rpc("admit_student"'), 'edge function should keep using the admission RPC');
  assert.ok(!admissionFunction.includes('withSupabase'), 'edge function should use the current Supabase Edge Runtime pattern');

  assert.ok(teachers.includes('"full_name"'), 'teacher creation should collect a name');
  assert.ok(teachers.includes('createAccount(payload)'), 'teacher creation should use the account workflow');
  assert.ok(api.includes('async createAccount(teacherData)'), 'API should implement teacher account creation');
  assert.ok(!teachers.includes('"employee_id",\n                "department_name"'), 'teacher creation form should not require a browser-entered employee ID');
  assert.ok(teachers.includes('payload.employee_id = generatedEmployeeId()'), 'the admin client should include an automatic ID while older functions are being redeployed');
  assert.ok(createUser.includes('generateEmployeeId'), 'the trusted create-user function should generate teacher employee IDs');
  assert.ok(!createUser.includes('Employee ID is required for teachers.'), 'teacher creation should not reject a missing browser employee ID');
  assert.ok(admissionFunction.includes('normalizedRole(callerProfile?.role)'), 'admission authorization should normalize admin role aliases');
  assert.ok(admissionFunction.includes('getUser(accessToken)'), 'admission should verify the request bearer token explicitly');
  assert.ok(api.includes('API.db.auth.refreshSession()'), 'admission should refresh a near-expiry dashboard session');
  assert.ok(api.includes('fetch(functionUrl'), 'admission should send the bearer token directly to the privileged function');
  assert.ok(api.includes('API.db.auth.getUser(accessToken)'), 'admission should reject stale browser sessions before calling the function');
  assert.ok(admissionFunction.includes('selected class is no longer available'), 'admission should fail clearly for a stale class selection');
  assert.ok(admissionFunction.includes('triggerProfile?.id'), 'admission should update a trigger-created profile instead of inserting it again');
  assert.ok(
    admissionFunction.indexOf('const admin = createClient') < admissionFunction.indexOf('await admin\n      .from("profiles")'),
    'admission must initialize the service-role client before its profile lookup',
  );
  assert.ok(
    admissionFunction.indexOf('const callerUser =') < admissionFunction.indexOf('.eq("id", callerUser.id)'),
    'admission must authenticate the caller before looking up that caller profile',
  );

  console.log('admission and teacher workflow regression test passed');
})();
