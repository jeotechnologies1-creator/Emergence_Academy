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
  assert.ok(students.includes('NO_DEPARTMENT_LEVELS'), 'only primary and JSS students should receive the No department option');
  assert.ok(admissionFunction.includes('NO_DEPARTMENT_CLASS_LEVELS'), 'the admission service must enforce the department rule server-side');
  assert.ok(students.includes('Database-connected admission'), 'admission form should clearly identify its live Supabase data connection');
  assert.ok(students.includes('admissionSubmitting'), 'admission form should prevent duplicate submissions while Supabase is processing a request');
  assert.ok(admissionFunction.includes('CLASS_LEVELS'), 'edge function should validate class levels');
  assert.ok(admissionFunction.includes('rpc("admit_student"'), 'edge function should keep using the admission RPC');
  assert.ok(admissionFunction.includes('SUPABASE_SECRET_KEYS'), 'admission should retain a managed-secret fallback for privileged database requests');
  assert.ok(admissionFunction.includes('legacyServiceRoleKey'), 'admission should use the service-role JWT for Auth Admin account creation');
  assert.ok(admissionFunction.includes('/auth/v1/admin/users'), 'admission should call the Auth Admin endpoint with explicit key headers');
  assert.ok(admissionFunction.includes('headers.delete("authorization")'), 'admission must send its server secret only on the apikey header');
  assert.ok(admissionFunction.includes('app_metadata: { role: "student" }'), 'admission must give new students the trusted RLS role claim');
  assert.ok(admissionFunction.includes('Student ID: ${generatedStudentId}'), 'admission should return the database-generated student ID');
  assert.ok(!admissionFunction.includes('withSupabase'), 'edge function should use the current Supabase Edge Runtime pattern');

  assert.ok(teachers.includes('"full_name"'), 'teacher creation should collect a name');
  assert.ok(teachers.includes('emptyOptionLabel: "No department"'), 'teacher department dropdown should allow no department');
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
  assert.ok(admissionFunction.includes('at least one subject are required'), 'admission must require subject enrolment for teacher-student matching');
  assert.ok(students.includes('select required name="subject_ids"'), 'the student admission form must require at least one subject');
  assert.ok(admissionFunction.includes('parent_students'), 'admission should support linking a guardian to the newly admitted student');
  assert.ok(!read('assets', 'js', 'dashboard', 'dashboard-home.js').includes('<option value="student">Student</option>'), 'office account creation must not offer student admission');
  assert.ok(!read('assets', 'js', 'dashboard', 'dashboard-home.js').includes('<option value="teacher">Teacher</option>'), 'office account creation must not bypass the teacher employment workflow');
  assert.ok(createUser.includes('Students must be admitted from the Students module.'), 'the create-user function must reject student creation outside admission');
  assert.ok(createUser.includes('parentData'), 'parent accounts should receive their selected child links in the trusted creation workflow');
  assert.ok(createUser.includes('parent_students'), 'parent creation should persist child links server-side');
  assert.ok(createUser.includes('teacher_subjects'), 'teacher creation should persist selected class and subject assignments');
  assert.ok(teachers.includes('confirmTeacherAssignments'), 'admin teacher creation must verify that selected class/subject assignments were saved');
  assert.ok(teachers.includes('class_ids'), 'teacher enrollment should collect assigned classes');
  assert.ok(teachers.includes('subject_ids'), 'teacher enrollment should collect assigned subjects');
  assert.ok(read('assets', 'js', 'dashboard', 'parents.js').includes('student_ids'), 'parent enrollment should allow selecting linked children');
  assert.ok(read('supabase', 'migrations', '202608140001_enforce_student_identity_integrity.sql').includes('students_student_no_unique'), 'student numbers must be protected by a database uniqueness constraint');
  assert.ok(admissionFunction.includes('triggerProfile?.id'), 'admission should update a trigger-created profile instead of inserting it again');
  assert.ok(students.includes('admittedStudent.student_no || admittedStudent.admission_number'), 'admission success should display the Supabase-generated student ID');
  assert.ok(
    admissionFunction.indexOf('const admin = createClient') < admissionFunction.indexOf('await admin\n      .from("profiles")'),
    'admission must initialize the service-role client before its profile lookup',
  );
  assert.ok(
    admissionFunction.indexOf('const callerUser =') < admissionFunction.indexOf('.eq("id", callerUser.id)'),
    'admission must authenticate the caller before looking up that caller profile',
  );
  const visibilityRepair = read('supabase', 'migrations', '202608250001_repair_student_dashboard_and_teacher_visibility.sql');
  assert.ok(visibilityRepair.includes("when 'administrator' then 'admin'"), 'legacy administrator roles must retain dashboard access');
  assert.ok(visibilityRepair.includes('public.teacher_can_access_student(id)'), 'teacher student visibility must use the assigned-class helper');
  assert.ok(visibilityRepair.includes('public.ensure_student_enrollment'), 'existing students must be backfilled into the current session');

  console.log('admission and teacher workflow regression test passed');
})();
