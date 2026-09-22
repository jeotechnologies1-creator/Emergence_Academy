/* A single, role-safe view of the work and live sessions already available
   to the signed-in user. Data access remains enforced by existing RLS/RPCs. */
class LearningPlannerModule {
  static state = { container: null, profile: null, items: [], filter: "all", warning: "", curriculum: null, submissions: [] };

  static safe(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  static role() { return String(this.state.profile?.role || "").trim().toLowerCase(); }
  static canUse() { return ["student", "teacher", "admin", "ceo", "executive"].includes(this.role()); }
  static day(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unscheduled" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  static time(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  static dateKey(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "9999-12-31" : date.toISOString().slice(0, 10); }

  static async load() {
    this.state.profile = await Auth.profile(true);
    if (!this.canUse()) throw new Error("Your role does not have access to the learning planner.");
    this.state.warning = ""; this.state.submissions = [];
    const [assignmentsResult, sessionsResult] = await Promise.all([
      API.db.from("assignments")
        .select("id,title,due_date,status,class_id,subject_id,subjects:subject_id(subject_name),classes:class_id(class_name)")
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

    if (this.role() === "student") {
      const { data: student, error: studentError } = await API.db.from("students").select("id").eq("profile_id", this.state.profile.id).maybeSingle();
      if (studentError || !student) this.state.warning ||= "Your student record is unavailable, so assignment progress cannot be shown.";
      else {
        const { data: submissions, error: submissionsError } = await API.db.from("assignment_submissions")
          .select("assignment_id,status,score,feedback,reviewed_at,submitted_at").eq("student_id", student.id);
        if (submissionsError) this.state.warning ||= "Assignment progress could not be loaded right now.";
        else this.state.submissions = submissions || [];
      }
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
        id: assignment.id, type: "assignment", title: assignment.title, at: dueAt.toISOString(), classId: assignment.class_id, subjectId: assignment.subject_id,
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
        id: session.id, type: "live", title: session.title, at: session.starts_at, classId: session.class_id, subjectId: session.subject_id,
        meta: `${session.subject_name || "Live class"} · ${session.status === "live" ? "Live now" : "Scheduled"}`,
        detail: `${this.day(session.starts_at)} · ${this.time(session.starts_at)}–${this.time(session.ends_at)}`,
        live: session.status === "live", ended: ["ended", "cancelled"].includes(String(session.status || "").toLowerCase())
      };
    });
    this.state.items = [...assignments, ...sessions]
      .filter((item) => item.live || (!item.ended && new Date(item.at) <= cutoff && new Date(item.at) >= new Date(today.getTime() - 86400000)))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
    await this.loadTeacherCurriculum();
  }

  static async loadTeacherCurriculum() {
    this.state.curriculum = null;
    if (this.role() !== "teacher") return;
    const { data: teacher, error: teacherError } = await API.db.from("teachers").select("id").eq("profile_id", this.state.profile.id).maybeSingle();
    if (teacherError || !teacher) {
      this.state.warning ||= "Your teacher record is unavailable, so term curriculum planning cannot be loaded.";
      return;
    }
    const [pairsResult, termsResult, slotsResult, schemeResult] = await Promise.all([
      API.db.from("teacher_subjects").select("class_id,subject_id,classes:class_id(class_name),subjects:subject_id(subject_name)").eq("teacher_id", teacher.id),
      API.db.from("terms").select("id,term_name,sort_order").order("sort_order"),
      API.db.from("teacher_timetable_slots").select("id,term_id,day_of_week,starts_at,ends_at,room,classes:class_id(class_name),subjects:subject_id(subject_name)").eq("teacher_id", teacher.id).order("day_of_week").order("starts_at"),
      API.db.from("scheme_of_work_entries").select("id,term_id,week_number,topic,objectives,classes:class_id(class_name),subjects:subject_id(subject_name)").eq("teacher_id", teacher.id).order("week_number")
    ]);
    const error = pairsResult.error || termsResult.error || slotsResult.error || schemeResult.error;
    if (error) {
      console.error("Unable to load term curriculum planning:", error);
      this.state.warning ||= "Term curriculum planning is unavailable until the latest school database update is applied.";
      return;
    }
    this.state.curriculum = { teacherId: teacher.id, pairs: pairsResult.data || [], terms: termsResult.data || [], slots: slotsResult.data || [], scheme: schemeResult.data || [] };
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
    return `<div class="space-y-6"><section class="rounded-2xl bg-gradient-to-r from-indigo-700 to-cyan-600 p-6 text-white shadow"><p class="text-sm font-semibold uppercase tracking-[.18em] text-cyan-100">Your learning schedule</p><h2 class="mt-2 text-3xl font-bold">Learning Planner</h2><p class="mt-2 max-w-2xl text-indigo-100">Assignments and live classes in one focused timeline for the next 30 days.</p><div class="mt-5 flex flex-wrap gap-3 text-sm"><span class="rounded-full bg-white/15 px-3 py-1.5">${upcoming} upcoming items</span>${live ? `<span class="rounded-full bg-emerald-500/90 px-3 py-1.5">${live} class live now</span>` : ""}</div></section>${this.state.warning ? `<p class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">${this.safe(this.state.warning)}</p>` : ""}${this.courseHomeTemplate()}${this.curriculumTemplate()}<section class="rounded-xl bg-white p-5 shadow"><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="text-xl font-bold text-slate-800">Upcoming work</h3><p class="mt-1 text-sm text-slate-500">Open an item to continue in its secure workspace.</p></div><div class="flex flex-wrap gap-2" role="group" aria-label="Planner filters">${filters.map(([key, label]) => `<button type="button" data-planner-filter="${key}" aria-pressed="${this.state.filter === key}" class="rounded-full px-3 py-1.5 text-sm font-medium ${this.state.filter === key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}">${label}</button>`).join("")}</div></div><div class="mt-5 space-y-3">${items.length ? items.map((item) => this.item(item)).join("") : '<div class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Nothing is scheduled in the next 30 days.</div>'}</div></section></div>`;
  }

  static courseHomeTemplate() {
    const courses = new Map();
    this.state.items.forEach((item) => {
      const key = `${item.classId || ""}|${item.subjectId || ""}`;
      if (!courses.has(key)) courses.set(key, { name: item.type === "assignment" ? item.meta : item.meta?.split(" · ")[0] || "Course", items: [] });
      courses.get(key).items.push(item);
    });
    const cards = [...courses.values()].map((course) => {
      const assignments = course.items.filter((item) => item.type === "assignment");
      const sessions = course.items.filter((item) => item.type === "live" && !item.ended);
      const returned = assignments.map((item) => this.state.submissions.find((submission) => String(submission.assignment_id) === String(item.id))).filter((submission) => submission?.status === "returned");
      const missing = this.role() === "student" ? assignments.filter((item) => item.overdue && !this.state.submissions.some((submission) => String(submission.assignment_id) === String(item.id))).length : 0;
      const next = [...course.items].filter((item) => !item.ended).sort((a, b) => new Date(a.at) - new Date(b.at))[0];
      return `<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="flex items-start justify-between gap-3"><div><h3 class="text-lg font-bold text-slate-900">${this.safe(course.name)}</h3><p class="mt-1 text-sm text-slate-500">${next ? `${this.safe(next.type === "live" ? "Next live class" : "Next assignment")}: ${this.safe(this.day(next.at))}` : "No upcoming activity"}</p></div><button type="button" data-planner-route="assignments" class="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">Open course work</button></div><div class="mt-4 flex flex-wrap gap-2 text-sm"><span class="rounded-full bg-indigo-50 px-3 py-1 text-indigo-800">${assignments.length} assignment${assignments.length === 1 ? "" : "s"}</span>${sessions.length ? `<span class="rounded-full bg-cyan-50 px-3 py-1 text-cyan-800">${sessions.length} live session${sessions.length === 1 ? "" : "s"}</span>` : ""}${returned.length ? `<span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">${returned.length} feedback returned</span>` : ""}${missing ? `<span class="rounded-full bg-red-50 px-3 py-1 text-red-800">${missing} missing</span>` : ""}</div></article>`;
    }).join("");
    return cards ? `<section class="rounded-xl bg-slate-50 p-5 shadow"><div><h3 class="text-xl font-bold text-slate-800">My courses</h3><p class="mt-1 text-sm text-slate-500">See the next action, live sessions, and returned feedback for each class and subject.</p></div><div class="mt-4 grid gap-4 lg:grid-cols-2">${cards}</div></section>` : "";
  }

  static curriculumTemplate() {
    const data = this.state.curriculum;
    if (!data) return "";
    const terms = data.terms.map((term) => `<option value="${this.safe(term.id)}">${this.safe(term.term_name)}</option>`).join("");
    const pairs = data.pairs.map((pair) => `<option value="${this.safe(pair.class_id)}|${this.safe(pair.subject_id)}">${this.safe(pair.classes?.class_name || "Class")} · ${this.safe(pair.subjects?.subject_name || "Subject")}</option>`).join("");
    const slotRows = data.slots.map((slot) => `<li class="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>${this.safe(slot.day_of_week)}</strong> · ${this.safe(String(slot.starts_at).slice(0, 5))}–${this.safe(String(slot.ends_at).slice(0, 5))}<br>${this.safe(slot.classes?.class_name || "Class")} · ${this.safe(slot.subjects?.subject_name || "Subject")}${slot.room ? ` · ${this.safe(slot.room)}` : ""}</li>`).join("") || '<li class="text-sm text-slate-500">No timetable slots set yet.</li>';
    const schemeRows = data.scheme.map((entry) => `<li class="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Week ${this.safe(entry.week_number)}: ${this.safe(entry.topic)}</strong><br>${this.safe(entry.classes?.class_name || "Class")} · ${this.safe(entry.subjects?.subject_name || "Subject")}${entry.objectives ? `<p class="mt-1 text-slate-500">${this.safe(entry.objectives)}</p>` : ""}</li>`).join("") || '<li class="text-sm text-slate-500">No scheme-of-work entries set yet.</li>';
    const disabled = !terms || !pairs;
    return `<section class="rounded-xl bg-white p-5 shadow"><div><h3 class="text-xl font-bold text-slate-800">Term curriculum</h3><p class="mt-1 text-sm text-slate-500">Set your timetable and weekly scheme of work for classes assigned to you.</p></div>${disabled ? '<p class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">An administrator must assign you a class, subject, and active term before planning can begin.</p>' : `<div class="mt-5 grid gap-5 xl:grid-cols-2"><form data-timetable-form class="rounded-xl border border-slate-200 p-4"><h4 class="font-semibold text-slate-800">Add timetable slot</h4><div class="mt-3 grid gap-3 sm:grid-cols-2"><select required name="term_id" class="rounded-lg border p-2"><option value="">Term</option>${terms}</select><select required name="pair" class="rounded-lg border p-2"><option value="">Class & subject</option>${pairs}</select><select required name="day_of_week" class="rounded-lg border p-2"><option value="">Day</option>${["Monday","Tuesday","Wednesday","Thursday","Friday"].map((day) => `<option>${day}</option>`).join("")}</select><input required name="room" placeholder="Room / location" class="rounded-lg border p-2"><input required type="time" name="starts_at" class="rounded-lg border p-2"><input required type="time" name="ends_at" class="rounded-lg border p-2"></div><button class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Save slot</button><ul class="mt-4 space-y-2">${slotRows}</ul></form><form data-scheme-form class="rounded-xl border border-slate-200 p-4"><h4 class="font-semibold text-slate-800">Add scheme of work</h4><div class="mt-3 grid gap-3 sm:grid-cols-2"><select required name="term_id" class="rounded-lg border p-2"><option value="">Term</option>${terms}</select><select required name="pair" class="rounded-lg border p-2"><option value="">Class & subject</option>${pairs}</select><input required min="1" max="20" type="number" name="week_number" placeholder="Week" class="rounded-lg border p-2"><input required name="topic" placeholder="Topic" class="rounded-lg border p-2"><textarea name="objectives" placeholder="Learning objectives" class="rounded-lg border p-2 sm:col-span-2"></textarea><textarea name="learning_activities" placeholder="Learning activities" class="rounded-lg border p-2 sm:col-span-2"></textarea><input name="resources" placeholder="Resources" class="rounded-lg border p-2"><input name="assessment" placeholder="Assessment" class="rounded-lg border p-2"></div><button class="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white">Save week plan</button><ul class="mt-4 space-y-2">${schemeRows}</ul></form></div>`}</section>`;
  }

  static bind() {
    this.state.container.querySelectorAll("[data-planner-filter]").forEach((button) => button.addEventListener("click", () => {
      this.state.filter = button.dataset.plannerFilter || "all";
      this.state.container.innerHTML = this.template(); this.bind();
    }));
    this.state.container.querySelectorAll("[data-planner-route]").forEach((button) => button.addEventListener("click", () => Router.navigate(button.dataset.plannerRoute)));
    this.state.container.querySelector("[data-timetable-form]")?.addEventListener("submit", (event) => this.saveCurriculum(event, "teacher_timetable_slots"));
    this.state.container.querySelector("[data-scheme-form]")?.addEventListener("submit", (event) => this.saveCurriculum(event, "scheme_of_work_entries"));
  }

  static async saveCurriculum(event, table) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type=submit], button:not([type])");
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const [class_id, subject_id] = String(values.pair || "").split("|");
      if (!class_id || !subject_id || !values.term_id) throw new Error("Select a term and assigned class subject.");
      const payload = { ...values, teacher_id: this.state.curriculum.teacherId, class_id, subject_id };
      delete payload.pair;
      if (table === "scheme_of_work_entries") payload.week_number = Number(values.week_number);
      if (table === "teacher_timetable_slots" && String(values.ends_at) <= String(values.starts_at)) throw new Error("End time must be after start time.");
      submit.disabled = true;
      const { error } = await API.db.from(table).insert(payload);
      if (error) throw error;
      window.Utils?.success?.(table === "teacher_timetable_slots" ? "Timetable slot saved." : "Weekly scheme saved.");
      await this.load();
      this.state.container.innerHTML = this.template();
      this.bind();
    } catch (error) {
      window.Utils?.error?.(error.message || "Unable to save term curriculum.") || window.alert(error.message || "Unable to save term curriculum.");
      submit.disabled = false;
    }
  }

  static async render(container) {
    this.state.container = container;
    container.innerHTML = '<div class="rounded-xl bg-white p-8 text-slate-500 shadow">Loading your learning planner…</div>';
    try { await this.load(); container.innerHTML = this.template(); this.bind(); }
    catch (error) { console.error(error); container.innerHTML = `<div class="rounded-xl bg-white p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load the learning planner.")}</div>`; }
  }
}

window.LearningPlannerModule = LearningPlannerModule;
