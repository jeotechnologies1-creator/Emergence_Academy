const assert = require('assert');
const fs = require('fs');
const path = require('path');

(() => {
  const root = path.join(__dirname, '..');
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
  const moduleCode = read('assets', 'js', 'dashboard', 'live-classes.js');
  const schedule = read('supabase', 'functions', 'schedule-live-class', 'index.ts');
  const join = read('supabase', 'functions', 'join-live-class', 'index.ts');
  const migration = read('supabase', 'migrations', '202608100005_upgrade_live_classes_google_meet.sql');

  assert.ok(schedule.includes('oauth2.googleapis.com/token'), 'scheduling must exchange a server-side refresh token');
  assert.ok(schedule.includes('conferenceDataVersion=1'), 'scheduling must request a Google Meet conference');
  assert.ok(schedule.includes('teacher_subjects'), 'server must verify teacher assignment');
  assert.ok(join.includes('student_can_access_live_class'), 'server must verify student enrollment before returning a link');
  assert.ok(moduleCode.includes('join-live-class'), 'browser must use the protected join endpoint');
  assert.ok(!moduleCode.includes('meet.jit.si'), 'Jitsi room generation must not remain');
  assert.ok(migration.includes('get_live_classes'), 'database must expose an enrollment-scoped class listing');
  console.log('live classes Google Meet regression test passed');
})();
