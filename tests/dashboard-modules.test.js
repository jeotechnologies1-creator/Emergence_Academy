const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(() => {
  const file = path.join(__dirname, '..', 'assets', 'js', 'dashboard', 'module-stub.js');
  const dashboardHomeFile = path.join(__dirname, '..', 'assets', 'js', 'dashboard', 'dashboard-home.js');
  assert.ok(fs.existsSync(file), 'module stub file should exist');

  const code = fs.readFileSync(file, 'utf8');
  const context = {
    window: {},
    document: { createElement: () => ({ style: {}, className: '' }) },
    console
  };
  context.window.window = context.window;

  const vmContext = vm.createContext(context);
  vm.runInContext(code, vmContext);

  const dashboardHome = fs.readFileSync(dashboardHomeFile, 'utf8');
  const dashboardStyles = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'dashboard.css'), 'utf8');
  assert.ok(dashboardHome.includes('static enrolledStudentsCard(value)'), 'The enrolled-student dashboard card should only receive the count.');
  assert.ok(!dashboardHome.includes('API.dashboard.enrolledStudents()'), 'The dashboard should not fetch or render enrolled student names in the count card.');
  assert.ok(dashboardStyles.includes('table-layout: fixed'), 'parent records should wrap long values instead of overflowing on desktop');

  ['TeachersModule', 'ParentsModule', 'AttendanceModule', 'AssignmentModule', 'GradesModule', 'FinanceModule', 'ReportsModule', 'NotificationModule', 'AIModule'].forEach((name) => {
    assert.ok(context.window[name], `${name} should be registered on window`);
    assert.strictEqual(typeof context.window[name].render, 'function', `${name}.render should be a function`);
  });

  console.log('dashboard module registration test passed');
})();
