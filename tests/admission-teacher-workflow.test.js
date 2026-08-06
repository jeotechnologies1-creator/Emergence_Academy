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

  console.log('admission and teacher workflow regression test passed');
})();
