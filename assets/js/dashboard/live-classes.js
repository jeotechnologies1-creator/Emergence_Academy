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
  static getAgoraConfig() {
    const config = window.CONFIG?.AGORA || {};
    return {
      appId: String(config.APP_ID || window.AGORA_APP_ID || "").trim(),
      channelPrefix: String(config.CHANNEL_PREFIX || "emergence-live-class").trim() || "emergence-live-class"
    };
  }
  static async requestAgoraToken(channelName, uid = 0, liveClassId = null, role = "join") {
    const route = role === "create" ? "agora-create-room" : "agora-join-room";
    const payload = { channel_name: channelName, uid };
    if (liveClassId) payload.live_class_id = liveClassId;
    const { data, error } = await API.db.functions.invoke(route, {
      body: payload
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "Unable to generate an Agora token.");
    }
    if (!data?.token) {
      throw new Error("Agora token generation returned no token.");
    }
    return data;
  }
  static async ensureAgoraSDK() {
    if (window.AgoraRTC) return;
    if (document.querySelector("script[data-agora-sdk='true']")) {
      await new Promise((resolve) => {
        const poll = setInterval(() => {
          if (window.AgoraRTC) {
            clearInterval(poll);
            resolve();
          }
        }, 150);
      });
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.21.3.js";
      script.async = true;
      script.dataset.agoraSdk = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Unable to load the Agora Web SDK."));
      document.head.appendChild(script);
    });
  }
  static sanitizeChannelName(value) {
    const cleaned = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return cleaned || "emergence-live-class";
  }
  static openAgoraRoom(session) {
    const channel = this.sanitizeChannelName(`${this.getAgoraConfig().channelPrefix}-${session?.id || session?.title || "room"}`);
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm";
    modal.innerHTML = `
      <div class="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-950/25">
        <div class="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-4 text-white">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">Agora live class</p>
            <h3 class="mt-1 text-xl font-bold">${this.safe(session?.title || "Live class")}</h3>
          </div>
          <button type="button" data-close-agora class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20">Close</button>
        </div>
        <div class="grid gap-4 p-5 lg:grid-cols-[1.5fr_0.8fr]">
          <div class="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),transparent_42%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)]">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(96,165,250,0.18),transparent_60%)]"></div>
            <div id="agora-remote-player" class="absolute inset-0"></div>
            <div class="absolute inset-x-0 top-4 flex justify-between px-4">
              <span class="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-100">Live</span>
              <span class="rounded-full border border-white/10 bg-slate-900/50 px-3 py-1 text-xs font-medium text-slate-200">${this.safe(channel)}</span>
            </div>
            <div class="absolute bottom-4 right-4 h-40 w-28 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-slate-950/60">
              <div id="agora-local-player" class="h-full w-full bg-slate-800"></div>
            </div>
          </div>
          <aside class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-200">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Session</p>
              <p class="mt-2 text-lg font-semibold text-white">${this.safe(session?.subject_name || "Live class")}</p>
              <p class="mt-1 text-sm text-slate-300">${this.safe(this.format(session?.starts_at))} to ${this.safe(this.format(session?.ends_at))}</p>
            </div>
            <div class="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3">
              <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">Agora status</p>
              <p data-agora-status class="mt-2 text-sm text-slate-100">Connecting...</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm text-slate-300">
              <p class="font-medium text-white">Required setup</p>
              <p class="mt-2">Add your Agora App ID in <strong>assets/js/config.js</strong> under <strong>CONFIG.AGORA</strong>; the token is fetched securely from the backend.</p>
            </div>
            <div class="mt-auto flex gap-2">
              <button type="button" data-agora-toggle-mic class="flex-1 rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700">Mute</button>
              <button type="button" data-agora-toggle-camera class="flex-1 rounded-xl bg-cyan-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500">Camera off</button>
            </div>
          </aside>
        </div>
      </div>
    `;
    const closeButton = modal.querySelector("[data-close-agora]");
    closeButton?.addEventListener("click", () => this.closeAgoraRoom(modal));
    modal.dataset.channel = channel;
    document.body.appendChild(modal);
    return modal;
  }
  static async connectAgoraRoom(session) {
    const { appId } = this.getAgoraConfig();
    if (!appId) {
      throw new Error("Agora App ID is missing. Add it to CONFIG.AGORA.APP_ID in assets/js/config.js.");
    }
    await this.ensureAgoraSDK();
    const modal = this.openAgoraRoom(session);
    const client = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    const channel = modal.dataset.channel;
    const uid = Number(String(session?.id || Date.now()).replace(/\D/g, "")) || 0;
    const status = modal.querySelector("[data-agora-status]");
    status.textContent = "Fetching secure token...";
    const isTeacherHost = this.canSchedule() && String(session?.teacher_id) === String(this.state.teacher?.id);
    const tokenResponse = await this.requestAgoraToken(channel, uid, session?.id || null, isTeacherHost ? "create" : "join");
    const token = tokenResponse.token;
    const localAudioTrack = await window.AgoraRTC.createMicrophoneAudioTrack();
    const localVideoTrack = await window.AgoraRTC.createCameraVideoTrack();
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video" && user.videoTrack) {
        user.videoTrack.play("agora-remote-player");
      }
      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    });
    client.on("user-left", () => {
      status.textContent = "Remote participant left the room.";
    });
    const micButton = modal.querySelector("[data-agora-toggle-mic]");
    const cameraButton = modal.querySelector("[data-agora-toggle-camera]");
    let micEnabled = true;
    let cameraEnabled = true;
    micButton?.addEventListener("click", () => {
      micEnabled = !micEnabled;
      localAudioTrack.setEnabled(micEnabled);
      micButton.textContent = micEnabled ? "Mute" : "Unmute";
    });
    cameraButton?.addEventListener("click", () => {
      cameraEnabled = !cameraEnabled;
      localVideoTrack.setEnabled(cameraEnabled);
      cameraButton.textContent = cameraEnabled ? "Camera off" : "Camera on";
    });
    await client.join(appId, channel, token, Number(uid));
    await client.publish([localAudioTrack, localVideoTrack]);
    localVideoTrack.play("agora-local-player");
    status.textContent = "Connected to Agora";
    modal.__agora = { client, localAudioTrack, localVideoTrack };
    return modal;
  }
  static closeAgoraRoom(modal) {
    if (!modal) return;
    const session = modal.__agora;
    if (session?.client) {
      session.client.leave();
    }
    if (session?.localAudioTrack) session.localAudioTrack.close();
    if (session?.localVideoTrack) session.localVideoTrack.close();
    modal.remove();
  }
  static async render(container) { this.state.container = container; container.innerHTML = '<div class="bg-white rounded-xl p-8 text-slate-500 shadow">Loading live classes...</div>'; try { await this.load(); this.draw(); } catch (error) { console.error(error); container.innerHTML = `<div class="bg-white rounded-xl p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load live classes.")}</div>`; } }
  static draw() {
    const sessions = this.state.sessions.map((session) => this.card(session)).join("") || '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No live classes are scheduled for you yet.</div>';
    this.state.container.innerHTML = `<div class="space-y-6"><div class="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-6 text-white shadow"><h2 class="text-3xl font-bold">Live Classes</h2><p class="mt-2 text-indigo-100">${this.canSchedule() ? "Create secure Google Meet sessions for subjects assigned to you." : "Join Google Meet sessions for subjects in which you are enrolled."}</p></div>${this.canSchedule() ? this.form() : ""}<section><h3 class="mb-3 text-xl font-bold text-slate-800">My Live Classes</h3><div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${sessions}</div></section></div>`;
    this.bind();
  }
  static form() {
    const subjects = this.assignmentSubjects(), classes = this.assignmentClasses();
    const disabled = !this.state.teacher || !subjects.length || !classes.length;
    const subjectOptions = subjects.map((subject) => {
      const assignedClassIds = this.state.assignments
        .filter((assignment) => String(assignment.teacher_id) === String(this.state.teacher?.id) && String(assignment.subject_id) === String(subject.id))
        .map((assignment) => String(assignment.class_id));
      return `<option value="${this.safe(subject.id)}" data-class-ids="${this.safe(assignedClassIds.join(","))}" disabled>${this.safe(subject.subject_name)}</option>`;
    }).join("");
    const students = this.state.students.map((student) => {
      const name = `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() || student.profiles?.email || "Student";
      const studentNumber = String(student.student_no || student.admission_number || "").trim();
      const label = studentNumber ? `${name} (${studentNumber})` : name;
      return `<label data-approved-student data-class-id="${this.safe(student.class_id)}" class="hidden items-center gap-2 rounded border p-2 text-sm"><input disabled type="checkbox" name="approved_student_ids" value="${this.safe(student.id)}"><span>${this.safe(label)}</span></label>`;
    }).join("") || '<p class="text-sm text-slate-500">No students are enrolled in your assigned classes.</p>';
    return `<section class="rounded-xl bg-white p-5 shadow"><h3 class="text-xl font-bold text-slate-800">Schedule a Google Meet class</h3>${disabled ? '<p class="mt-2 text-sm text-amber-700">You need an administrator assignment for a subject and class before scheduling.</p>' : ""}<form id="live-class-form" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><label><span class="text-sm">Class *</span><select required name="class_id" id="live-class-id" class="mt-1 w-full rounded-lg border p-2.5"><option value="">Select class</option>${classes.map((row) => `<option value="${this.safe(row.id)}">${this.safe(row.class_name)}</option>`).join("")}</select></label><label><span class="text-sm">Subject *</span><select required name="subject_id" id="live-subject-id" disabled class="mt-1 w-full rounded-lg border p-2.5 disabled:bg-slate-100"><option value="">Select a class first</option>${subjectOptions}</select></label><label class="md:col-span-2"><span class="text-sm">Class title *</span><input required name="title" class="mt-1 w-full rounded-lg border p-2.5" placeholder="Introduction to Algebra"></label><label class="md:col-span-2"><span class="text-sm">Description</span><textarea name="description" rows="2" class="mt-1 w-full rounded-lg border p-2.5"></textarea></label><label><span class="text-sm">Start time *</span><input required name="starts_at" type="datetime-local" class="mt-1 w-full rounded-lg border p-2.5"></label><label><span class="text-sm">End time *</span><input required name="ends_at" type="datetime-local" class="mt-1 w-full rounded-lg border p-2.5"></label><fieldset class="md:col-span-2"><legend class="text-sm font-medium">Students approved for this live class *</legend><p class="mb-2 text-xs text-slate-500">Choose students enrolled in the selected class. Only they can join this session.</p><div id="approved-students" class="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">${students}</div></fieldset><div id="live-class-error" class="hidden md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"></div><div class="md:col-span-2"><button ${disabled ? "disabled" : ""} class="rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">Schedule & Open Google Meet</button></div></form></section>`;
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
    const subjectSelect = this.state.container.querySelector("#live-subject-id");
    const updateEligibleStudents = () => {
      const classId = String(classSelect?.value || "");
      const subjectId = String(subjectSelect?.value || "");
      this.state.container.querySelectorAll("[data-approved-student]").forEach((label) => {
        const allowed = Boolean(classId && subjectId) && String(label.dataset.classId) === classId;
        label.classList.toggle("hidden", !allowed);
        label.querySelector("input").disabled = !allowed;
        if (!allowed) label.querySelector("input").checked = false;
      });
    };
    classSelect?.addEventListener("change", () => {
      const classId = String(classSelect.value || "");
      subjectSelect.disabled = !classId;
      subjectSelect.querySelectorAll("option[data-class-ids]").forEach((option) => {
        const allowed = String(option.dataset.classIds || "").split(",").includes(classId);
        option.hidden = !allowed;
        option.disabled = !allowed;
        if (!allowed && option.selected) subjectSelect.value = "";
      });
      subjectSelect.querySelector("option[value='']").textContent = classId ? "Select subject" : "Select a class first";
      updateEligibleStudents();
    });
    subjectSelect?.addEventListener("change", updateEligibleStudents);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorBox = this.state.container.querySelector("#live-class-error");
      const data = new FormData(event.currentTarget);
      const approvedStudentIds = data.getAll("approved_student_ids");
      try {
        if (!approvedStudentIds.length) throw new Error("Select at least one approved student.");
        const startsAt = new Date(String(data.get("starts_at") || ""));
        const endsAt = new Date(String(data.get("ends_at") || ""));
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Enter valid start and end times.");
        const result = await API.db.functions.invoke("schedule-live-class", { body: { ...Object.fromEntries(data), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), approved_student_ids: approvedStudentIds } });
        if (result.error || result.data?.error) {
          const message = result.data?.error || await API.functionErrorMessage(
            result.error,
            "Unable to schedule the class."
          );
          throw new Error(message);
        }
        window.Utils?.success?.("Class scheduled. Agora room is ready when you start the lesson.");
        await this.render(this.state.container);
      } catch (error) {
        errorBox.textContent = error.message || "Unable to create the class.";
        errorBox.classList.remove("hidden");
      }
    });
    this.state.container.querySelectorAll("[data-live-action]").forEach((button) => button.addEventListener("click", async () => { try { const action = button.dataset.liveAction, id = button.dataset.id; const session = this.state.sessions.find((item) => String(item.id) === String(id)); if (!session) throw new Error("Live class session was not found."); if (action === "join") { const result = await API.db.functions.invoke("join-live-class", { body: { live_class_id: id } }); if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message); await this.connectAgoraRoom(session); return; } const status = action === "start" ? "live" : action === "end" ? "ended" : "cancelled"; const { error } = await API.db.rpc("set_live_class_status", { p_live_class_id: id, p_status: status }); if (error) throw error; if (action === "start") { const result = await API.db.functions.invoke("join-live-class", { body: { live_class_id: id } }); if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message); await this.connectAgoraRoom(session); } await this.render(this.state.container); } catch (error) { window.Utils?.error?.(error.message || "Unable to update the class.") || window.alert(error.message); } }));
  }
}
window.LiveClassesModule = LiveClassesModule;
