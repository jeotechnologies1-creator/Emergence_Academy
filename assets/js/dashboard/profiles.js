/* ==========================================================
   EMERGENCE ACADEMY
   PROFILES MODULE
========================================================== */

class ProfilesModule {

    static state = {
        container: null,
        profile: null,
        rows: [],
        filters: {
            query: "",
            role: "all",
            status: "all",
            from: "",
            to: ""
        }
    };

    static ALLOWED_ROLES = ["admin", "ceo"];

    static safe(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    static currentRole() {
        return String(this.state.profile?.role || "").trim().toLowerCase();
    }

    static canViewAllProfiles() {
        return this.ALLOWED_ROLES.includes(this.currentRole());
    }

    static showMessage(text, tone = "error") {
        if (tone === "success" && window.Utils?.success) {
            Utils.success(text);
            return;
        }

        if (tone === "error" && window.Utils?.error) {
            Utils.error(text);
            return;
        }

        const targetId = tone === "success" ? "success-message" : "error-message";
        const target = document.getElementById(targetId);

        if (!target) {
            console[tone === "error" ? "error" : "log"](text);
            return;
        }

        target.textContent = text;
        target.classList.remove("hidden");
        setTimeout(() => target.classList.add("hidden"), 3500);
    }

    static loading() {
        return `
<div class="bg-white rounded-xl shadow p-8 text-center text-slate-500">
  Loading profiles...
</div>
`;
    }

    static accessDenied() {
        return `
<div class="bg-white rounded-xl shadow p-8 text-center">
  <h3 class="text-xl font-bold text-slate-800">Access Restricted</h3>
  <p class="mt-2 text-slate-500">Only admin-level accounts can view all created profiles.</p>
</div>
`;
    }

    static error(message = "Unable to load profiles.") {
        return `
<div class="bg-white rounded-xl shadow p-8 text-center text-red-600">
  ${this.safe(message)}
</div>
`;
    }

    static formatDate(value) {
        if (!value) return "-";
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return this.safe(value);
        }

        return date.toLocaleString();
    }

    static getRoleOptions() {
        const configuredRoles = Object.keys(window.RoleRouter?.ROLE_CONFIGS || {});
        const fallbackRoles = ["ceo", "admin", "executive", "teacher", "student", "parent", "finance", "hr", "admission", "exam", "library"];
        const roles = Array.from(new Set([...(configuredRoles.length ? configuredRoles : fallbackRoles)]));

        return roles.map((role) => {
            const selected = this.state.filters.role === role ? "selected" : "";
            const label = role.charAt(0).toUpperCase() + role.slice(1);
            return `<option value="${this.safe(role)}" ${selected}>${this.safe(label)}</option>`;
        }).join("");
    }

    static filterRows() {
        const query = String(this.state.filters.query || "").trim().toLowerCase();
        const role = String(this.state.filters.role || "all").toLowerCase();
        const status = String(this.state.filters.status || "all").toLowerCase();

        const from = this.state.filters.from ? new Date(this.state.filters.from) : null;
        const to = this.state.filters.to ? new Date(`${this.state.filters.to}T23:59:59`) : null;

        return this.state.rows.filter((item) => {
            const createdAt = item.created_at ? new Date(item.created_at) : null;
            const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim();

            if (query) {
                const haystack = [
                    fullName,
                    item.email,
                    item.role,
                    item.status,
                    item.phone
                ].join(" ").toLowerCase();

                if (!haystack.includes(query)) {
                    return false;
                }
            }

            if (role !== "all" && String(item.role || "").toLowerCase() !== role) {
                return false;
            }

            if (status !== "all" && String(item.status || "").toLowerCase() !== status) {
                return false;
            }

            if (from && createdAt && createdAt < from) {
                return false;
            }

            if (to && createdAt && createdAt > to) {
                return false;
            }

            return true;
        });
    }

    static template() {
        const rows = this.filterRows();

        return `
<div class="space-y-6">
  <div class="bg-white rounded-xl shadow p-6">
    <h2 class="text-2xl font-bold text-slate-800">Profiles Directory</h2>
    <p class="text-slate-500 mt-1">View all created user profiles and filter by role, status, and date.</p>

    <form id="profiles-filter-form" class="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      <label class="block xl:col-span-2">
        <span class="text-sm text-slate-700">Search</span>
        <input
          name="query"
          value="${this.safe(this.state.filters.query)}"
          placeholder="Name, email, role, phone"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
        />
      </label>

      <label class="block">
        <span class="text-sm text-slate-700">Role</span>
        <select name="role" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="all">All Roles</option>
          ${this.getRoleOptions()}
        </select>
      </label>

      <label class="block">
        <span class="text-sm text-slate-700">Status</span>
        <select name="status" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="all" ${this.state.filters.status === "all" ? "selected" : ""}>All Status</option>
          <option value="active" ${this.state.filters.status === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${this.state.filters.status === "inactive" ? "selected" : ""}>Inactive</option>
          <option value="pending" ${this.state.filters.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="suspended" ${this.state.filters.status === "suspended" ? "selected" : ""}>Suspended</option>
        </select>
      </label>

      <div class="grid grid-cols-2 gap-2 xl:col-span-1">
        <label class="block">
          <span class="text-sm text-slate-700">From</span>
          <input type="date" name="from" value="${this.safe(this.state.filters.from)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>
        <label class="block">
          <span class="text-sm text-slate-700">To</span>
          <input type="date" name="to" value="${this.safe(this.state.filters.to)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>
      </div>

      <div class="xl:col-span-5 flex items-center justify-end gap-2 mt-1">
        <button type="button" data-profiles-reset class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Reset</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Apply Filter</button>
      </div>
    </form>
  </div>

  <div class="bg-white rounded-xl shadow overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
      <h3 class="font-semibold text-slate-800">Created Profiles</h3>
      <span class="text-sm text-slate-500">${rows.length} profile(s)</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-slate-600">
          <tr>
            <th class="px-4 py-3">Full Name</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Role</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Phone</th>
            <th class="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map((item) => {
              const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim() || "-";
              return `
              <tr class="border-t border-slate-100">
                <td class="px-4 py-3 font-medium text-slate-800">${this.safe(fullName)}</td>
                <td class="px-4 py-3 text-slate-600">${this.safe(item.email || "-")}</td>
                <td class="px-4 py-3 text-slate-600">${this.safe(item.role || "-")}</td>
                <td class="px-4 py-3 text-slate-600">${this.safe(item.status || "-")}</td>
                <td class="px-4 py-3 text-slate-600">${this.safe(item.phone || "-")}</td>
                <td class="px-4 py-3 text-slate-600">${this.safe(this.formatDate(item.created_at))}</td>
              </tr>
              `;
            }).join("") : `
            <tr>
              <td class="px-4 py-8 text-center text-slate-500" colspan="6">No profiles matched your filter.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  </div>
</div>
`;
    }

    static bindEvents() {
        const form = this.state.container?.querySelector("#profiles-filter-form");
        const resetButton = this.state.container?.querySelector("[data-profiles-reset]");

        if (form) {
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                const formData = new FormData(form);

                this.state.filters = {
                    query: String(formData.get("query") || ""),
                    role: String(formData.get("role") || "all"),
                    status: String(formData.get("status") || "all"),
                    from: String(formData.get("from") || ""),
                    to: String(formData.get("to") || "")
                };

                this.redraw();
            });
        }

        if (resetButton) {
            resetButton.addEventListener("click", () => {
                this.state.filters = {
                    query: "",
                    role: "all",
                    status: "all",
                    from: "",
                    to: ""
                };

                this.redraw();
            });
        }
    }

    static redraw() {
        if (!this.state.container) return;
        this.state.container.innerHTML = this.template();
        this.bindEvents();
    }

    static async load() {
        const [profile, profiles] = await Promise.all([
            Auth.profile(),
            API.records.getAll("profiles", {
                orderBy: "created_at",
                ascending: false,
                select: "*"
            })
        ]);

        this.state.profile = profile || null;
        this.state.rows = Array.isArray(profiles) ? profiles : [];
    }

    static async render(container) {
        this.state.container = container;
        container.innerHTML = this.loading();

        try {
            await this.load();

            if (!this.canViewAllProfiles()) {
                container.innerHTML = this.accessDenied();
                return;
            }

            this.redraw();

        } catch (error) {
            console.error("Profiles module render failed:", error);
            this.showMessage(error.message || "Unable to load profiles.", "error");
            container.innerHTML = this.error(error.message);
        }
    }

}

window.ProfilesModule = ProfilesModule;
