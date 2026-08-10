const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(() => {
  const root = path.join(__dirname, '..');
  const configCode = fs.readFileSync(path.join(root, 'assets/js/config.js'), 'utf8');
  const serviceCode = fs.readFileSync(path.join(root, 'assets/js/services/DashboardService.js'), 'utf8');
  const context = {
    window: { __EMERGENCE_CONFIG__: {} },
    document: { querySelectorAll: () => [] },
    console,
    Object
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(configCode, context);
  vm.runInContext(serviceCode, context);

  assert.equal(context.window.normalizeEmergenceRole('Super_Admin'), 'admin');
  assert.equal(context.window.normalizeEmergenceRole('human resources'), 'hr');
  assert.equal(context.window.normalizeEmergenceRole('unknown', 'student'), 'student');
  assert.equal(context.window.DashboardService.ROUTE_PERMISSIONS.students, 'students.view');
  assert.equal(context.window.DashboardService.ROUTE_PERMISSIONS.profiles, 'users.view');
  console.log('authorization regression test passed');
})();
