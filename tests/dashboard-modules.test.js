const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(() => {
  const file = path.join(__dirname, '..', 'assets', 'js', 'dashboard', 'module-stub.js');
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

  ['TeachersModule', 'ParentsModule', 'AttendanceModule', 'AssignmentModule', 'GradesModule', 'FinanceModule', 'ReportsModule', 'NotificationModule', 'AIModule'].forEach((name) => {
    assert.ok(context.window[name], `${name} should be registered on window`);
    assert.strictEqual(typeof context.window[name].render, 'function', `${name}.render should be a function`);
  });

  console.log('dashboard module registration test passed');
})();
