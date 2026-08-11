const assert = require('assert');
const fs = require('fs');
const path = require('path');

(() => {
  const root = path.join(__dirname, '..');
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
  const moduleCode = read('assets', 'js', 'dashboard', 'live-classes.js');
  const schedule = read('supabase', 'functions', 'schedule-live-class', 'index.ts');
  const join = read('supabase', 'functions', 'join-live-class', 'index.ts');
  const options = read('supabase', 'functions', 'live-class-options', 'index.ts');
  const migration = read('supabase', 'migrations', '202608100005_upgrade_live_classes_google_meet.sql');
  const classAndTeacherMigration = read('supabase', 'migrations', '202608110004_seed_standard_classes_and_teacher_ids.sql');

  assert.ok(schedule.includes('oauth2.googleapis.com/token'), 'scheduling must exchange a server-side refresh token');
  assert.ok(schedule.includes('conferenceDataVersion=1'), 'scheduling must request a Google Meet conference');
  assert.ok(schedule.includes('teacher_subjects'), 'server must verify teacher assignment');
  assert.ok(join.includes('student_can_access_live_class'), 'server must verify student enrollment before returning a link');
  assert.ok(join.includes('live_class_students'), 'server must verify explicit class approval before returning a link');
  assert.ok(schedule.includes('approved_student_ids'), 'scheduling must persist the teacher-approved student roster');
  assert.ok(options.includes('teacher_subjects'), 'scheduling options must be scoped to the authenticated teacher');
  assert.ok(moduleCode.includes('approved_student_ids'), 'teacher form must submit approved students');
  assert.ok(join.includes('id,class_id,subject_id'), 'join authorization must load the live class class_id');
  assert.ok(moduleCode.includes('join-live-class'), 'browser must use the protected join endpoint');
  assert.ok(!moduleCode.includes('meet.jit.si'), 'Jitsi room generation must not remain');
  assert.ok(migration.includes('get_live_classes'), 'database must expose an enrollment-scoped class listing');
  assert.ok(classAndTeacherMigration.includes("'Primary 3'"), 'standard class options must be seeded for class selectors');
  assert.ok(classAndTeacherMigration.includes("'SSS 3'"), 'senior class options must be seeded for class selectors');
  assert.ok(classAndTeacherMigration.includes('teacher_employee_id'), 'live classes must return the generated teacher employee ID');
  assert.ok(moduleCode.includes('teacher_employee_id'), 'live class cards must display the generated teacher employee ID');
  console.log('live classes Google Meet regression test passed');
})();
