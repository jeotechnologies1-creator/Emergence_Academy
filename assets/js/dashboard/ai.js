class AIModule {
  static STORAGE_KEY = "emergence_ai_assistant_history";

  static async render(container) {
    const [profile, stats] = await Promise.all([
      Auth.profile(),
      API.dashboard.stats()
    ]);

    container.innerHTML = this.template(profile, stats);
    this.bindEvents(profile, stats);
  }

  static safe(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  static history() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static save(entry) {
    const items = this.history();
    const next = [entry, ...items].slice(0, 12);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(next));
  }

  static insight(profile, stats, prompt) {
    const role = String(profile?.role || "staff").toUpperCase();
    const top = [
      `Students: ${stats.students}`,
      `Teachers: ${stats.teachers}`,
      `Attendance: ${stats.attendance}`,
      `Assignments: ${stats.assignments}`,
      `Grades: ${stats.grades}`,
      `Finance: ${stats.finance}`,
      `Notifications: ${stats.notifications}`
    ].join(" | ");

    return `Role: ${role}. Prompt: ${prompt}. Live KPI Summary -> ${top}. Suggested next step: prioritize the lowest-performing operational area and issue a targeted notification to responsible staff.`;
  }

  static template(profile, stats) {
    const history = this.history();
    const firstName = this.safe(profile?.first_name || "User");
    const role = this.safe(String(profile?.role || "staff").toUpperCase());

    return `
<div class="space-y-6">
  <div class="bg-white rounded-xl shadow p-6">
    <h2 class="text-3xl font-bold text-slate-800">AI Assistant</h2>
    <p class="text-slate-600 mt-2">Personalized guidance for ${firstName} (${role}) using live dashboard metrics.</p>
    <div class="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
      Students: <strong>${stats.students}</strong> | Teachers: <strong>${stats.teachers}</strong> | Attendance: <strong>${stats.attendance}</strong> | Finance: <strong>${stats.finance}</strong>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow p-6">
    <label for="aiPrompt" class="block text-sm font-medium text-slate-700">Ask Assistant</label>
    <textarea id="aiPrompt" rows="4" class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Example: Suggest actions to improve attendance this week."></textarea>
    <div class="mt-3 flex items-center gap-3">
      <button id="aiRun" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Generate Insight</button>
      <button id="aiClear" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Clear History</button>
    </div>
    <div id="aiOutput" class="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 hidden"></div>
  </div>

  <div class="bg-white rounded-xl shadow p-6">
    <h3 class="text-lg font-semibold text-slate-800">Recent AI Insights</h3>
    <div id="aiHistory" class="space-y-3 mt-4">
      ${history.length ? history.map((item) => `<div class="rounded-lg border border-slate-200 p-3"><div class="text-xs text-slate-500">${this.safe(item.created_at)}</div><div class="mt-1 text-slate-700">${this.safe(item.response)}</div></div>`).join("") : `<div class="text-slate-500">No AI insights yet.</div>`}
    </div>
  </div>
</div>
`;
  }

  static bindEvents(profile, stats) {
    const promptInput = document.getElementById("aiPrompt");
    const run = document.getElementById("aiRun");
    const clear = document.getElementById("aiClear");
    const output = document.getElementById("aiOutput");

    run?.addEventListener("click", () => {
      const prompt = String(promptInput?.value || "").trim();

      if (!prompt) {
        output.textContent = "Please enter a question or instruction for the assistant.";
        output.classList.remove("hidden");
        return;
      }

      const response = this.insight(profile, stats, prompt);
      this.save({
        prompt,
        response,
        created_at: new Date().toLocaleString()
      });

      output.textContent = response;
      output.classList.remove("hidden");

      const historyContainer = document.getElementById("aiHistory");
      if (historyContainer) {
        historyContainer.innerHTML = this.history().map((item) => `<div class="rounded-lg border border-slate-200 p-3"><div class="text-xs text-slate-500">${this.safe(item.created_at)}</div><div class="mt-1 text-slate-700">${this.safe(item.response)}</div></div>`).join("");
      }
    });

    clear?.addEventListener("click", () => {
      localStorage.removeItem(this.STORAGE_KEY);
      const historyContainer = document.getElementById("aiHistory");
      if (historyContainer) {
        historyContainer.innerHTML = '<div class="text-slate-500">No AI insights yet.</div>';
      }
    });
  }
}

window.AIModule = AIModule;
