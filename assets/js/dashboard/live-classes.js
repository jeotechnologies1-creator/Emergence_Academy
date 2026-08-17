/* Google Meet live classes. Meeting links are intentionally never read from
   the database in this browser; the join Edge Function authorizes each use. */
class LiveClassesModule {
  static state = { container: null, profile: null, teacher: null, subjects: [], classes: [], assignments: [], students: [], sessions: [] };
  static safe(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  static role() { return String(this.state.profile?.role || "").toLowerCase(); }
  static canSchedule() { return this.role() === "teacher"; }
  static async load() {
    const profile = await Auth.profile(true);
    if (!profile?.id) throw new Error("Your profile is required to access live classes.");
    this.state.profile = profile;
    const [result, options] = await Promise.all([
      API.db.rpc("get_live_classes"),
      this.canSchedule() ? API.db.functions.invoke("live-class-options", { body: {} }) : Promise.resolve({ data: null, error: null })
    ]);
    if (result.error) throw result.error;
    if (options.error || options.data?.error) throw new Error(options.data?.error || options.error?.message);
    this.state.teacher = options.data?.teacher || null;
    this.state.subjects = options.data?.subjects || []; this.state.classes = options.data?.classes || [];
    this.state.assignments = options.data?.assignments || []; this.state.students = options.data?.students || [];
    this.state.sessions = (result.data || []).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }
  static assignmentSubjects() { const ids = new Set(this.state.assignments.filter((row) => String(row.teacher_id) === String(this.state.teacher?.id)).map((row) => String(row.subject_id))); return this.state.subjects.filter((row) => ids.has(String(row.id))); }
  static assignmentClasses() { const ids = new Set(this.state.assignments.filter((row) => String(row.teacher_id) === String(this.state.teacher?.id)).map((row) => String(row.class_id))); return this.state.classes.filter((row) => ids.has(String(row.id))); }
  static format(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unscheduled" : date.toLocaleString(); }
  static async render(container) { this.state.container = container; container.innerHTML = '<div class="bg-white rounded-xl p-8 text-slate-500 shadow">Loading live classes...</div>'; try { await this.load(); this.draw(); } catch (error) { console.error(error); container.innerHTML = `<div class="bg-white rounded-xl p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load live classes.")}</div>`; } }
  static draw() {
    const sessions = this.state.sessions.map((session) => this.card(session)).join("") || '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No live classes are scheduled for you yet.</div>';
    this.state.container.innerHTML = `<div class="space-y-6"><div class="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-6 text-white shadow"><h2 class="text-3xl font-bold">Live Classes</h2><p class="mt-2 text-indigo-100">${this.canSchedule() ? "Create secure Google Meet sessions for subjects assigned to you." : "Join Google Meet sessions for subjects in which you are enrolled."}</p></div>${this.canSchedule() ? this.form() : ""}<section><h3 class="mb-3 text-xl font-bold text-slate-800">My Live Classes</h3><div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${sessions}</div></section></div>`;
    this.bind();
  }
  static form() {
    const subjects = this.assignmentSubjects(), classes = this.assignmentClasses();
    const disabled = !this.state.teacher || !subjects.length || !classes.length;
    const students = this.state.students.map((student) => {
      const name = `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() || student.profiles?.email || "Student";
      const studentNumber = String(student.student_no || student.admission_number || "").trim();
      const label = studentNumber ? `${name} (${studentNumber})` : name;
      return `<label data-approved-student data-class-id="${this.safe(student.class_id)}" class="flex items-center gap-2 rounded border p-2 text-sm opacity-50"><input disabled type="checkbox" name="approved_student_ids" value="${this.safe(student.id)}"><span>${this.safe(label)}</span></label>`;
    }).join("") || '<p class="text-sm text-slate-500">No students are available for your assigned classes.</p>';
    return `<section class="rounded-xl bg-white p-5 shadow"><h3 class="text-xl font-bold text-slate-800">Schedule a Google Meet class</h3>${disabled ? '<p class="mt-2 text-sm text-amber-700">You need an administrator assignment for a subject and class before scheduling.</p>' : ""}<form id="live-class-form" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><label><span class="text-sm">Subject *</span><select required name="subject_id" class="mt-1 w-full rounded-lg border p-2.5"><option value="">Select subject</option>${subjects.map((row) => `<option value="${this.safe(row.id)}">${this.safe(row.subject_name)}</option>`).join("")}</select></label><label><span class="text-sm">Class *</span><select required name="class_id" id="live-class-id" class="mt-1 w-full rounded-lg border p-2.5"><option value="">Select class</option>${classes.map((row) => `<option value="${this.safe(row.id)}">${this.safe(row.class_name)}</option>`).join("")}</select></label><label class="md:col-span-2"><span class="text-sm">Class title *</span><input required name="title" class="mt-1 w-full rounded-lg border p-2.5" placeholder="Introduction to Algebra"></label><label class="md:col-span-2"><span class="text-sm">Description</span><textarea name="description" rows="2" class="mt-1 w-full rounded-lg border p-2.5"></textarea></label><label><span class="text-sm">Start time *</span><input required name="starts_at" type="datetime-local" class="mt-1 w-full rounded-lg border p-2.5"></label><label><span class="text-sm">End time *</span><input required name="ends_at" type="datetime-local" class="mt-1 w-full rounded-lg border p-2.5"></label><fieldset class="md:col-span-2"><legend class="text-sm font-medium">Approved students *</legend><p class="mb-2 text-xs text-slate-500">Select a class to choose the students approved to join this session.</p><div id="approved-students" class="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">${students}</div></fieldset><div id="live-class-error" class="hidden md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"></div><div class="md:col-span-2"><button ${disabled ? "disabled" : ""} class="rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">Schedule & Open Google Meet</button></div></form></section>`;
  }
  static card(session) {
    const status = String(session.status || "upcoming").toLowerCase(), teacherControls = this.canSchedule() && String(session.teacher_id) === String(this.state.teacher?.id);
    const joinable = status === "live";
    const teacherName = `${session.teacher_first_name || ""} ${session.teacher_last_name || ""}`.trim() || "Assigned teacher";
    const employeeId = String(session.teacher_employee_id || "").trim();
    const teacherLabel = employeeId ? `${teacherName} (${employeeId})` : teacherName;
    const teacherActions = teacherControls && status === "upcoming"
      ? `<button data-live-action="start" data-id="${this.safe(session.id)}" class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Start class</button><button data-live-action="cancel" data-id="${this.safe(session.id)}" class="rounded-lg border px-3 py-2 text-sm">Cancel</button>`
      : teacherControls && status === "live"
        ? `<button data-live-action="end" data-id="${this.safe(session.id)}" class="rounded-lg border px-3 py-2 text-sm">End class</button>`
        : "";
    return `<article class="rounded-xl bg-white p-5 shadow"><div class="flex justify-between gap-3"><div><h4 class="font-bold text-slate-800">${this.safe(session.title)}</h4><p class="mt-1 text-sm text-slate-500">${this.safe(session.subject_name || "Subject")}</p></div><span class="rounded-full px-3 py-1 text-xs font-medium ${status === "live" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}">${this.safe(status === "live" ? "LIVE NOW" : status)}</span></div><p class="mt-3 text-sm text-slate-600"><strong>Teacher:</strong> ${this.safe(teacherLabel)}<br><strong>Time:</strong> ${this.safe(this.format(session.starts_at))} – ${this.safe(this.format(session.ends_at))}</p>${session.description ? `<p class="mt-2 text-sm text-slate-600">${this.safe(session.description)}</p>` : ""}<div class="mt-4 flex flex-wrap gap-2"><button data-live-action="join" data-id="${this.safe(session.id)}" ${joinable ? "" : "disabled"} class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">${joinable ? "Join Class" : status === "ended" ? "Class Ended" : status === "cancelled" ? "Cancelled" : "Not started"}</button>${teacherActions}</div></article>`;
  }
  static bind() {
    const form = this.state.container.querySelector("#live-class-form");
    const classSelect = this.state.container.querySelector("#live-class-id");
    classSelect?.addEventListener("change", () => {
      this.state.container.querySelectorAll("[data-approved-student]").forEach((label) => {
        const allowed = String(label.dataset.classId) === String(classSelect.value);
        label.classList.toggle("hidden", !allowed);
        label.querySelector("input").disabled = !allowed;
        if (!allowed) label.querySelector("input").checked = false;
      });
    });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorBox = this.state.container.querySelector("#live-class-error");
      const data = new FormData(event.currentTarget);
      const approvedStudentIds = data.getAll("approved_student_ids");
      const meetingWindow = window.open("", "_blank", "noopener,noreferrer");
      try {
        if (!approvedStudentIds.length) throw new Error("Select at least one approved student.");
        const startsAt = new Date(String(data.get("starts_at") || ""));
        const endsAt = new Date(String(data.get("ends_at") || ""));
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Enter valid start and end times.");
        const result = await API.db.functions.invoke("schedule-live-class", { body: { ...Object.fromEntries(data), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), approved_student_ids: approvedStudentIds } });
        if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message);
        if (!result.data?.meeting_url) throw new Error("Google Meet was created but no meeting link was returned.");
        if (meetingWindow) meetingWindow.location.href = result.data.meeting_url;
        else window.open(result.data.meeting_url, "_blank", "noopener,noreferrer");
        window.Utils?.success?.("Class scheduled. Google Meet is now open.");
        await this.render(this.state.container);
      } catch (error) {
        meetingWindow?.close();
        errorBox.textContent = error.message || "Unable to create the Google Meet class.";
        errorBox.classList.remove("hidden");
      }
    });
    this.state.container.querySelectorAll("[data-live-action]").forEach((button) => button.addEventListener("click", async () => { try { const action = button.dataset.liveAction, id = button.dataset.id; if (action === "join") { const result = await API.db.functions.invoke("join-live-class", { body: { live_class_id: id } }); if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message); window.open(result.data.meeting_url, "_blank", "noopener,noreferrer"); return; } const status = action === "start" ? "live" : action === "end" ? "ended" : "cancelled"; const { error } = await API.db.rpc("set_live_class_status", { p_live_class_id: id, p_status: status }); if (error) throw error; if (action === "start") { const result = await API.db.functions.invoke("join-live-class", { body: { live_class_id: id } }); if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message); window.open(result.data.meeting_url, "_blank", "noopener,noreferrer"); } await this.render(this.state.container); } catch (error) { window.Utils?.error?.(error.message || "Unable to update the class.") || window.alert(error.message); } }));
  }
}
window.LiveClassesModule = LiveClassesModule;
