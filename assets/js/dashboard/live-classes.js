/* ==========================================================
   EMERGENCE ACADEMY - LIVE CLASSES
   Teachers schedule and start Jitsi sessions for their assigned
   subject/class. Enrolled students join the matching room.
========================================================== */

class LiveClassesModule {
  static state = { container: null, profile: null, teacher: null, student: null, sessions: [], subjects: [], classes: [], assignments: [] };

  static safe(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  static role() {
    return String(this.state.profile?.role || "").trim().toLowerCase();
  }

  static canSchedule() {
    return this.role() === "teacher";
  }

  static async query(table, select = "*") {
    const { data, error } = await API.db.from(table).select(select);
    if (error) throw error;
    return data || [];
  }

  static async load() {
    const profile = await Auth.profile();
    if (!profile?.id) throw new Error("Your profile is required to access live classes.");

    this.state.profile = profile;
    const [teachers, students, subjects, classes, assignments, sessions] = await Promise.all([
      this.query("teachers"), this.query("students"), this.query("subjects"),
      this.query("classes"), this.query("teacher_subjects"), this.query("live_classes")
    ]);

    this.state.teacher = teachers.find((row) => String(row.profile_id) === String(profile.id)) || null;
    this.state.student = students.find((row) => String(row.profile_id) === String(profile.id)) || null;
    this.state.subjects = subjects;
    this.state.classes = classes;
    this.state.assignments = assignments;

    let visible = sessions;
    if (this.role() === "student") {
      visible = this.state.student?.class_id
        ? sessions.filter((row) => String(row.class_id) === String(this.state.student.class_id))
        : [];
    }
    if (this.role() === "teacher") {
      visible = this.state.teacher
        ? sessions.filter((row) => String(row.teacher_id) === String(this.state.teacher.id))
        : [];
    }
    this.state.sessions = visible.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  static label(items, id, key) {
    const item = items.find((row) => String(row.id) === String(id));
    return item?.[key] || "Unknown";
  }

  static eligibleAssignments() {
    if (this.role() !== "teacher" || !this.state.teacher) return this.state.assignments;
    return this.state.assignments.filter((row) => String(row.teacher_id) === String(this.state.teacher.id));
  }

  static meetingUrl(room) {
    return `https://meet.jit.si/${encodeURIComponent(String(room))}`;
  }

  static roomName() {
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return `EmergenceAcademy-${token}`;
  }

  static formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unscheduled" : date.toLocaleString();
  }

  static async render(container) {
    this.state.container = container;
    container.innerHTML = '<div class="bg-white rounded-xl shadow p-8 text-slate-500">Loading live classes...</div>';
    try {
      await this.load();
      this.draw();
    } catch (error) {
      console.error("Live classes load failed:", error);
      container.innerHTML = `<div class="bg-white rounded-xl shadow p-8 text-red-600">${this.safe(error.message || "Unable to load live classes.")}</div>`;
    }
  }

  static draw() {
    const canSchedule = this.canSchedule();
    const sessions = this.state.sessions;
    const schedulePanel = canSchedule ? this.scheduleTemplate() : "";
    const cards = sessions.length ? sessions.map((session) => this.sessionCard(session)).join("") :
      '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No live classes are scheduled for you yet.</div>';

    this.state.container.innerHTML = `
<div class="space-y-6">
  <div class="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-6 text-white shadow">
    <h2 class="text-3xl font-bold">Live Classes</h2>
    <p class="mt-2 text-indigo-100">${canSchedule ? "Schedule a class for students enrolled in your subject and class." : "Join live classes scheduled for your enrolled class."}</p>
  </div>
  ${schedulePanel}
  <section>
    <h3 class="mb-3 text-xl font-bold text-slate-800">Your class sessions</h3>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${cards}</div>
  </section>
</div>`;
    this.bindEvents();
  }

  static scheduleTemplate() {
    const assignments = this.eligibleAssignments();
    const subjectIds = new Set(assignments.map((row) => String(row.subject_id)));
    const classIds = new Set(assignments.map((row) => String(row.class_id)).filter(Boolean));
    const subjects = this.role() === "teacher" ? this.state.subjects.filter((row) => subjectIds.has(String(row.id))) : this.state.subjects;
    const classes = this.role() === "teacher" ? this.state.classes.filter((row) => classIds.has(String(row.id))) : this.state.classes;
    const assignmentNotice = this.role() === "teacher" && !assignments.length
      ? '<p class="mt-2 text-sm text-amber-700">No teacher-subject assignment was found for your profile. Ask an administrator to assign your course before scheduling.</p>' : "";

    return `
<section class="rounded-xl bg-white p-5 shadow">
  <h3 class="text-xl font-bold text-slate-800">Schedule a live class</h3>${assignmentNotice}
  <form id="live-class-form" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
    <label class="block md:col-span-2"><span class="text-sm text-slate-700">Class title *</span><input required name="title" placeholder="e.g. Algebra Revision" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"></label>
    <label class="block"><span class="text-sm text-slate-700">Subject *</span><select required name="subject_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select subject</option>${subjects.map((row) => `<option value="${this.safe(row.id)}">${this.safe(row.subject_name)}</option>`).join("")}</select></label>
    <label class="block"><span class="text-sm text-slate-700">Class *</span><select required name="class_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select class</option>${classes.map((row) => `<option value="${this.safe(row.id)}">${this.safe(row.class_name)}</option>`).join("")}</select></label>
    <label class="block"><span class="text-sm text-slate-700">Start time *</span><input required type="datetime-local" name="starts_at" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"></label>
    <label class="block"><span class="text-sm text-slate-700">Duration (minutes) *</span><input required min="15" max="480" value="60" type="number" name="duration_minutes" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"></label>
    <label class="block md:col-span-2"><span class="text-sm text-slate-700">Notes</span><textarea name="notes" rows="2" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"></textarea></label>
    <div id="live-class-error" class="hidden md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"></div>
    <div class="md:col-span-2"><button ${this.role() === "teacher" && !assignments.length ? "disabled" : ""} class="rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Schedule class</button></div>
  </form>
</section>`;
  }

  static sessionCard(session) {
    const subject = this.label(this.state.subjects, session.subject_id, "subject_name");
    const className = this.label(this.state.classes, session.class_id, "class_name");
    const status = String(session.status || "scheduled").toLowerCase();
    const canManage = this.canSchedule() && (this.role() !== "teacher" || String(session.teacher_id) === String(this.state.teacher?.id));
    const canJoin = status !== "ended" && status !== "cancelled";
    return `
<article class="rounded-xl bg-white p-5 shadow">
  <div class="flex items-start justify-between gap-3"><div><h4 class="font-bold text-slate-800">${this.safe(session.title)}</h4><p class="mt-1 text-sm text-slate-500">${this.safe(subject)} · ${this.safe(className)}</p></div><span class="rounded-full px-3 py-1 text-xs font-medium ${status === "live" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}">${this.safe(status)}</span></div>
  <p class="mt-3 text-sm text-slate-600"><strong>Starts:</strong> ${this.safe(this.formatDate(session.starts_at))} · ${this.safe(session.duration_minutes)} min</p>
  ${session.notes ? `<p class="mt-2 text-sm text-slate-600">${this.safe(session.notes)}</p>` : ""}
  <div class="mt-4 flex flex-wrap gap-2">
    ${canJoin ? `<button data-live-action="join" data-id="${this.safe(session.id)}" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">${canManage ? "Start / Join class" : "Join class"}</button>` : ""}
    ${canManage && status === "scheduled" ? `<button data-live-action="live" data-id="${this.safe(session.id)}" class="rounded-lg border border-green-300 px-3 py-2 text-sm text-green-700 hover:bg-green-50">Mark live</button>` : ""}
    ${canManage && ["scheduled", "live"].includes(status) ? `<button data-live-action="end" data-id="${this.safe(session.id)}" class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">End class</button>` : ""}
  </div>
</article>`;
  }

  static bindEvents() {
    document.getElementById("live-class-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const errorBox = document.getElementById("live-class-error");
      try {
        if (!this.state.teacher && this.role() === "teacher") throw new Error("Your teacher record could not be found.");
        const data = new FormData(form);
        const startsAt = new Date(String(data.get("starts_at") || ""));
        if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) throw new Error("Select a future start time.");
        const teacherId = this.state.teacher?.id || this.state.assignments[0]?.teacher_id;
        if (!teacherId) throw new Error("Select a teacher assignment before scheduling.");
        const payload = { title: String(data.get("title") || "").trim(), subject_id: data.get("subject_id"), class_id: data.get("class_id"), teacher_id: teacherId, starts_at: startsAt.toISOString(), duration_minutes: Number(data.get("duration_minutes")), notes: String(data.get("notes") || "").trim() || null, meeting_room: this.roomName(), status: "scheduled" };
        const allowed = this.eligibleAssignments().some((row) => String(row.subject_id) === String(payload.subject_id) && String(row.class_id) === String(payload.class_id));
        if (this.role() === "teacher" && !allowed) throw new Error("You can only schedule classes for subjects and classes assigned to you.");
        const result = await API.records.create("live_classes", payload);
        if (!result?.success) throw new Error(result?.message || "Unable to schedule the class.");
        await this.render(this.state.container);
      } catch (error) {
        errorBox.textContent = error.message || "Unable to schedule the class.";
        errorBox.classList.remove("hidden");
      }
    });

    this.state.container.querySelectorAll("[data-live-action]").forEach((button) => button.addEventListener("click", async () => {
      const session = this.state.sessions.find((row) => String(row.id) === String(button.dataset.id));
      if (!session) return;
      const action = button.dataset.liveAction;
      if (action === "join") window.open(this.meetingUrl(session.meeting_room), "_blank", "noopener");
      if (action === "live" || action === "end") {
        const result = await API.records.update("live_classes", session.id, { status: action === "live" ? "live" : "ended" });
        if (!result?.success) return alert(result?.message || "Unable to update the session.");
        await this.render(this.state.container);
      }
    }));
  }
}

window.LiveClassesModule = LiveClassesModule;
