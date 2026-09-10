/* Administrator settings for non-secret, school-wide application preferences. */
(function () {
  "use strict";

  class AdminSettingsModule {
    static state = { container: null, profile: null, settingsRow: null, sessions: [] };

    static safe(value) {
      return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    static canManage() {
      return ["admin", "ceo"].includes(String(this.state.profile?.role || "").toLowerCase());
    }

    static defaults() {
      const config = window.CONFIG?.APP_DETAILS || {};
      return {
        school_name: config.SCHOOL_NAME || "Emergence Academy",
        school_motto: config.MOTTO || "",
        contact_email: config.CONTACT_EMAIL || "",
        contact_phone: config.CONTACT_PHONE || "",
        address: config.ADDRESS || "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
        currency: "NGN",
        attendance_threshold: 75,
        assignment_reminder_days: 2,
        live_class_reminder_minutes: 30,
        guardian_digest_enabled: false
      };
    }

    static async load() {
      this.state.profile = await Auth.profile(true);
      if (!this.canManage()) throw new Error("Only school administrators can manage application settings.");
      const [settingsResult, sessionsResult] = await Promise.all([
        API.db.from("school_settings").select("id,current_session,app_settings,updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        API.db.from("academic_sessions").select("id,session_name,is_current,created_at").order("created_at", { ascending: false })
      ]);
      if (settingsResult.error || sessionsResult.error) throw settingsResult.error || sessionsResult.error;
      this.state.settingsRow = settingsResult.data || null;
      this.state.sessions = sessionsResult.data || [];
    }

    static template() {
      const values = { ...this.defaults(), ...(this.state.settingsRow?.app_settings || {}) };
      const currentSession = String(this.state.settingsRow?.current_session || "");
      const options = this.state.sessions.map((session) => `<option value="${this.safe(session.id)}" ${String(session.id) === currentSession ? "selected" : ""}>${this.safe(session.session_name || "Academic session")}${session.is_current ? " (marked current)" : ""}</option>`).join("");
      return `<div class="space-y-6">
        <header class="rounded-2xl bg-gradient-to-r from-slate-800 to-indigo-800 p-6 text-white shadow">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Administration</p>
          <h2 class="mt-2 text-3xl font-bold">Application Settings</h2>
          <p class="mt-2 max-w-3xl text-indigo-100">Manage school-wide, non-secret settings. API keys, passwords, and Agora credentials remain protected in Supabase server settings.</p>
        </header>
        <form id="admin-settings-form" class="space-y-6">
          <section class="rounded-xl bg-white p-5 shadow"><h3 class="text-xl font-bold text-slate-800">School profile</h3><div class="mt-4 grid gap-4 md:grid-cols-2">
            <label class="md:col-span-2 block text-sm font-medium">School name<input required name="school_name" value="${this.safe(values.school_name)}" maxlength="120" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="md:col-span-2 block text-sm font-medium">Motto<input name="school_motto" value="${this.safe(values.school_motto)}" maxlength="180" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="block text-sm font-medium">Contact email<input name="contact_email" type="email" value="${this.safe(values.contact_email)}" maxlength="254" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="block text-sm font-medium">Contact phone<input name="contact_phone" value="${this.safe(values.contact_phone)}" maxlength="40" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="md:col-span-2 block text-sm font-medium">School address<input name="address" value="${this.safe(values.address)}" maxlength="300" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
          </div></section>
          <section class="rounded-xl bg-white p-5 shadow"><h3 class="text-xl font-bold text-slate-800">Academic operations</h3><div class="mt-4 grid gap-4 md:grid-cols-2">
            <label class="block text-sm font-medium">Current academic session<select name="current_session" class="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="">Choose a session</option>${options}</select><span class="mt-1 block text-xs font-normal text-amber-700">Changing this session enrolls existing students in the selected session.</span></label>
            <label class="block text-sm font-medium">Timezone<input name="timezone" value="${this.safe(values.timezone)}" placeholder="Africa/Lagos" maxlength="80" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="block text-sm font-medium">Currency<select name="currency" class="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="NGN" ${values.currency === "NGN" ? "selected" : ""}>Nigerian naira (NGN)</option><option value="USD" ${values.currency === "USD" ? "selected" : ""}>US dollar (USD)</option><option value="GBP" ${values.currency === "GBP" ? "selected" : ""}>Pound sterling (GBP)</option></select></label>
            <label class="block text-sm font-medium">Attendance threshold (%)<input name="attendance_threshold" type="number" min="0" max="100" value="${this.safe(values.attendance_threshold)}" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
          </div></section>
          <section class="rounded-xl bg-white p-5 shadow"><h3 class="text-xl font-bold text-slate-800">Communication preferences</h3><div class="mt-4 grid gap-4 md:grid-cols-2">
            <label class="block text-sm font-medium">Assignment reminder (days before due date)<input name="assignment_reminder_days" type="number" min="0" max="30" value="${this.safe(values.assignment_reminder_days)}" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="block text-sm font-medium">Live-class reminder (minutes before start)<input name="live_class_reminder_minutes" type="number" min="0" max="10080" value="${this.safe(values.live_class_reminder_minutes)}" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label>
            <label class="md:col-span-2 flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm"><input name="guardian_digest_enabled" type="checkbox" ${values.guardian_digest_enabled ? "checked" : ""}><span><strong>Enable guardian summaries</strong><br><span class="text-slate-500">Stores the preference only. Email or WhatsApp delivery must be configured separately with guardian consent.</span></span></label>
          </div></section>
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 p-4"><p id="admin-settings-status" class="text-sm text-slate-600">Settings are visible to administrators only.</p><button class="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">Save application settings</button></div>
        </form>
      </div>`;
    }

    static number(value, fallback, min, max) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    static bind() {
      const form = this.state.container.querySelector("#admin-settings-form");
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type='submit'], button:not([type])");
        const status = form.querySelector("#admin-settings-status");
        try {
          button.disabled = true;
          const data = new FormData(form);
          const app_settings = {
            school_name: String(data.get("school_name") || "").trim(), school_motto: String(data.get("school_motto") || "").trim(),
            contact_email: String(data.get("contact_email") || "").trim(), contact_phone: String(data.get("contact_phone") || "").trim(),
            address: String(data.get("address") || "").trim(), timezone: String(data.get("timezone") || "Africa/Lagos").trim(), currency: String(data.get("currency") || "NGN"),
            attendance_threshold: this.number(data.get("attendance_threshold"), 75, 0, 100),
            assignment_reminder_days: this.number(data.get("assignment_reminder_days"), 2, 0, 30),
            live_class_reminder_minutes: this.number(data.get("live_class_reminder_minutes"), 30, 0, 10080),
            guardian_digest_enabled: data.get("guardian_digest_enabled") === "on"
          };
          if (!app_settings.school_name) throw new Error("Enter the school name.");
          const payload = { app_settings, current_session: String(data.get("current_session") || "") || null };
          const request = this.state.settingsRow?.id
            ? API.db.from("school_settings").update(payload).eq("id", this.state.settingsRow.id)
            : API.db.from("school_settings").insert(payload);
          const { data: saved, error } = await request.select("id,current_session,app_settings,updated_at").single();
          if (error) throw error;
          this.state.settingsRow = saved;
          status.textContent = "Saved just now.";
          window.Utils?.success?.("Application settings saved.");
        } catch (error) {
          status.textContent = error?.message || "Unable to save settings.";
          window.Utils?.error?.(status.textContent);
        } finally { button.disabled = false; }
      });
    }

    static async render(container) {
      this.state.container = container;
      container.innerHTML = '<div class="rounded-xl bg-white p-8 text-slate-500 shadow">Loading application settings…</div>';
      try { await this.load(); container.innerHTML = this.template(); this.bind(); }
      catch (error) { container.innerHTML = `<div class="rounded-xl bg-white p-8 text-red-600 shadow">${this.safe(error?.message || "Unable to load application settings.")}</div>`; }
    }
  }

  window.AdminSettingsModule = AdminSettingsModule;
}());
