/* A single, role-safe view of the work and live sessions already available
   to the signed-in user. Data access remains enforced by existing RLS/RPCs. */
class LearningPlannerModule {
  static state = { container: null, profile: null, items: [], filter: "all", warning: "" };

  static safe(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  static role() { return String(this.state.profile?.role || "").trim().toLowerCase(); }
  static canUse() { return ["student", "teacher", "admin", "ceo", "executive"].includes(this.role()); }
  static day(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unscheduled" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  static time(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  static dateKey(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "9999-12-31" : date.toISOString().slice(0, 10); }

  static async load() {
    this.state.profile = await Auth.profile(true);
    if (!this.canUse()) throw new Error("Your role does not have access to the learning planner.");
    this.state.warning = "";
    const [assignmentsResult, sessionsResult] = await Promise.all([
      API.db.from("assignments")
        .select("id,title,due_date,status,subjects:subject_id(subject_name),classes:class_id(class_name)")
        .in("status", ["published", "closed"])
        .order("due_date", { ascending: true }),
      API.db.rpc("get_live_classes")
    ]);
    if (assignmentsResult.error) throw assignmentsResult.error;
    // Assignments and live sessions are separate features.  In particular,
    // an older deployment can be missing the newer live-class RPC columns.
    // Do not make a teacher's whole planner unusable in that case.
    if (sessionsResult.error) {
      console.error("Unable to load live classes for learning planner:", sessionsResult.error);
      this.state.warning = "Live classes could not be loaded right now. Your assignments are still available below.";
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + 30);
    const assignments = (assignmentsResult.data || []).flatMap((assignment) => {
      const dueAt = new Date(`${String(assignment.due_date || "").slice(0, 10)}T23:59:59`);
      // Older records may not have a due date. Do not let one incomplete
      // assignment make the entire planner module fail to render.
      if (Number.isNaN(dueAt.getTime())) {
        console.warn("Skipping assignment with an invalid due date in learning planner:", assignment.id);
        return [];
      }
      return {
        id: assignment.id, type: "assignment", title: assignment.title, at: dueAt.toISOString(),
        meta: `${assignment.subjects?.subject_name || "Subject"} · ${assignment.classes?.class_name || "Class"}`,
        detail: `Due ${this.day(dueAt)} at 11:59 PM`, overdue: dueAt < today
      };
    });
    const sessions = (sessionsResult.data || []).flatMap((session) => {
      if (Number.isNaN(new Date(session.starts_at).getTime())) {
        console.warn("Skipping live class with an invalid start time in learning planner:", session.id);
        return [];
      }
      return {
        id: session.id, type: "live", title: session.title, at: session.starts_at,
        meta: `${session.subject_name || "Live class"} · ${session.status === "live" ? "Live now" : "Scheduled"}`,
        detail: `${this.day(session.starts_at)} · ${this.time(session.starts_at)}–${this.time(session.ends_at)}`,
        live: session.status === "live", ended: ["ended", "cancelled"].includes(String(session.status || "").toLowerCase())
      };
    });
    this.state.items = [...assignments, ...sessions]
      .filter((item) => item.live || (!item.ended && new Date(item.at) <= cutoff && new Date(item.at) >= new Date(today.getTime() - 86400000)))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  static item(item) {
    const tone = item.type === "live" ? "border-cyan-200 bg-cyan-50" : item.overdue ? "border-red-200 bg-red-50" : "border-indigo-200 bg-indigo-50";
    const label = item.type === "live" ? (item.live ? "Live now" : "Live class") : item.overdue ? "Overdue assignment" : "Assignment";
    const route = item.type === "live" ? "live-classes" : "assignments";
    return `<article class="rounded-xl border p-4 ${tone}"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${this.safe(label)}</p><h3 class="mt-1 text-lg font-bold text-slate-900">${this.safe(item.title)}</h3><p class="mt-1 text-sm text-slate-600">${this.safe(item.meta)}</p><p class="mt-2 text-sm font-medium ${item.overdue ? "text-red-700" : "text-slate-700"}">${this.safe(item.detail)}</p></div><button type="button" data-planner-route="${route}" class="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50">Open</button></div></article>`;
  }

  static template() {
    const filters = [["all", "All"], ["assignment", "Assignments"], ["live", "Live classes"]];
    const items = this.state.items.filter((item) => this.state.filter === "all" || item.type === this.state.filter);
    const upcoming = this.state.items.filter((item) => !item.overdue && !item.ended).length;
    const live = this.state.items.filter((item) => item.live).length;
    return `<div class="space-y-6"><section class="rounded-2xl bg-gradient-to-r from-indigo-700 to-cyan-600 p-6 text-white shadow"><p class="text-sm font-semibold uppercase tracking-[.18em] text-cyan-100">Your learning schedule</p><h2 class="mt-2 text-3xl font-bold">Learning Planner</h2><p class="mt-2 max-w-2xl text-indigo-100">Assignments and live classes in one focused timeline for the next 30 days.</p><div class="mt-5 flex flex-wrap gap-3 text-sm"><span class="rounded-full bg-white/15 px-3 py-1.5">${upcoming} upcoming items</span>${live ? `<span class="rounded-full bg-emerald-500/90 px-3 py-1.5">${live} class live now</span>` : ""}</div></section>${this.state.warning ? `<p class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">${this.safe(this.state.warning)}</p>` : ""}<section class="rounded-xl bg-white p-5 shadow"><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="text-xl font-bold text-slate-800">Upcoming work</h3><p class="mt-1 text-sm text-slate-500">Open an item to continue in its secure workspace.</p></div><div class="flex flex-wrap gap-2" role="group" aria-label="Planner filters">${filters.map(([key, label]) => `<button type="button" data-planner-filter="${key}" aria-pressed="${this.state.filter === key}" class="rounded-full px-3 py-1.5 text-sm font-medium ${this.state.filter === key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}">${label}</button>`).join("")}</div></div><div class="mt-5 space-y-3">${items.length ? items.map((item) => this.item(item)).join("") : '<div class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Nothing is scheduled in the next 30 days.</div>'}</div></section></div>`;
  }

  static bind() {
    this.state.container.querySelectorAll("[data-planner-filter]").forEach((button) => button.addEventListener("click", () => {
      this.state.filter = button.dataset.plannerFilter || "all";
      this.state.container.innerHTML = this.template(); this.bind();
    }));
    this.state.container.querySelectorAll("[data-planner-route]").forEach((button) => button.addEventListener("click", () => Router.navigate(button.dataset.plannerRoute)));
  }

  static async render(container) {
    this.state.container = container;
    container.innerHTML = '<div class="rounded-xl bg-white p-8 text-slate-500 shadow">Loading your learning planner…</div>';
    try { await this.load(); container.innerHTML = this.template(); this.bind(); }
    catch (error) { console.error(error); container.innerHTML = `<div class="rounded-xl bg-white p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load the learning planner.")}</div>`; }
  }
}

window.LearningPlannerModule = LearningPlannerModule;
