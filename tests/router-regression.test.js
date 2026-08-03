const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

(async () => {
  const routerCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'router.js'), 'utf8');
  const dashboardCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'dashboard.js'), 'utf8');

  const document = {
    getElementById: (id) => {
      if (id === 'dashboard-content' || id === 'app') {
        return { innerHTML: '' };
      }
      return null;
    },
    querySelectorAll: () => []
  };

  const context = {
    window: {},
    document,
    console,
    Utils: { showLoader: () => {}, hideLoader: () => {} }
  };
  context.window = context;
  context.window.document = document;
  context.window.Utils = context.Utils;
  context.window.Router = undefined;

  const vmContext = vm.createContext(context);
  vm.runInContext(routerCode, vmContext);
  vm.runInContext(dashboardCode, vmContext);

  class TestModule {
    static loading() {
      return '<div>loaded</div>';
    }

    static async render(container) {
      container.innerHTML = this.loading();
    }
  }

  context.window.DashboardHome = TestModule;
  context.window.StudentsModule = undefined;
  context.window.TeachersModule = undefined;
  context.window.ParentsModule = undefined;
  context.window.AttendanceModule = undefined;
  context.window.AssignmentModule = undefined;
  context.window.GradesModule = undefined;
  context.window.FinanceModule = undefined;
  context.window.ReportsModule = undefined;
  context.window.NotificationModule = undefined;
  context.window.AIModule = undefined;

  const Dashboard = vm.runInContext('Dashboard', vmContext);
  Dashboard.registerModules();

  const container = { innerHTML: '' };
  await vm.runInContext('Router.navigate("dashboard")', vmContext);

  assert.strictEqual(container.innerHTML, '<div>loaded</div>');
  console.log('router regression test passed');
})();
