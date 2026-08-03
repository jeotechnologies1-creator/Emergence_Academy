class BaseModule {
  static render(container) {
    container.innerHTML = `
      <div class="p-8 bg-white rounded-xl shadow">
        <h2 class="text-2xl font-bold mb-2">${this.title}</h2>
        <p class="text-gray-600">This section is ready for the next implementation step.</p>
      </div>
    `;
  }
}

class TeachersModule extends BaseModule {
  static title = 'Teachers';
}

class ParentsModule extends BaseModule {
  static title = 'Parents';
}

class AttendanceModule extends BaseModule {
  static title = 'Attendance';
}

class AssignmentModule extends BaseModule {
  static title = 'Assignments';
}

class GradesModule extends BaseModule {
  static title = 'Grades';
}

class FinanceModule extends BaseModule {
  static title = 'Finance';
}

class ReportsModule extends BaseModule {
  static title = 'Reports';
}

class NotificationModule extends BaseModule {
  static title = 'Notifications';
}

class AIModule extends BaseModule {
  static title = 'AI Assistant';
}

window.TeachersModule = TeachersModule;
window.ParentsModule = ParentsModule;
window.AttendanceModule = AttendanceModule;
window.AssignmentModule = AssignmentModule;
window.GradesModule = GradesModule;
window.FinanceModule = FinanceModule;
window.ReportsModule = ReportsModule;
window.NotificationModule = NotificationModule;
window.AIModule = AIModule;
