/* ==========================================================
   EMERGENCE ACADEMY
   PROFILES MODULE
========================================================== */

(function () {

    "use strict";

    class ProfilesModule {

        static profiles = [];

        static safe(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        static async render(container) {

            container.innerHTML = `
                <div class="space-y-6">

                    <div class="flex justify-between items-center">

                        <div>
                            <h1 class="text-3xl font-bold">
                                User Profiles
                            </h1>

                            <p class="text-gray-500">
                                Manage all registered users.
                            </p>
                        </div>


                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Total Users</h4>
                            <h2 id="total-users" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Students</h4>
                            <h2 id="student-count" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Teachers</h4>
                            <h2 id="teacher-count" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Parents</h4>
                            <h2 id="parent-count" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Administrators</h4>
                            <h2 id="admin-count" class="text-3xl font-bold">0</h2>
                        </div>

                    </div>

                    <div class="bg-white rounded-xl shadow p-6">

                        <div class="flex gap-4 mb-6">

                            <input
                                id="profile-search"
                                type="text"
                                placeholder="Search users..."
                                class="border rounded-lg px-4 py-2 flex-1"
                            >

                            <select
                                id="role-filter"
                                class="border rounded-lg px-4 py-2"
                            >
                                <option value="">All Roles</option>
                            </select>

                            <select
                                id="status-filter"
                                class="border rounded-lg px-4 py-2"
                            >
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                                <option value="suspended">Suspended</option>
                            </select>

                        </div>

                        <div class="overflow-auto">

                            <table class="min-w-full text-sm">

                                <thead class="bg-gray-100">

                                    <tr>

                                        <th class="p-3 text-left">Photo</th>

                                        <th class="p-3 text-left">Name</th>

                                        <th class="p-3 text-left">Email</th>

                                        <th class="p-3 text-left">Role</th>

                                        <th class="p-3 text-left">Phone</th>

                                        <th class="p-3 text-left">Status</th>

                                        <th class="p-3 text-left">Password</th>

                                        <th class="p-3 text-left">Actions</th>

                                    </tr>

                                </thead>

                                <tbody id="profiles-table">

                                </tbody>

                            </table>

                        </div>

                    </div>

                </div>
            `;

            await this.loadProfiles();

            this.bindEvents();

        }

        static async loadProfiles() {

            try {

                const { data, error } = await API.db.functions.invoke("list-profiles", { body: {} });
                if (error) {
                    const message = typeof API.functionErrorMessage === "function"
                        ? await API.functionErrorMessage(error, "Failed to load users.")
                        : error.message;
                    throw new Error(message || "Failed to load users.");
                }
                if (data?.error) throw new Error(data.error);
                const profiles = data?.profiles || [];

                this.profiles = Array.isArray(profiles) ? profiles : [];

                this.renderTable(this.profiles);

                this.renderStatistics(this.profiles);

                this.populateRoleFilter(this.profiles);

            }

            catch (error) {

                console.error(error);

                window.Utils?.toast?.(
                    "Failed to load users.",
                    "error"
                );

            }

        }

        static renderTable(profiles) {

            const tbody = document.getElementById("profiles-table");

            tbody.innerHTML = "";

            profiles.forEach(profile => {

                tbody.innerHTML += `

                    <tr class="border-b">

                        <td class="p-3">

                            <img
                                src="${this.safe(profile.avatar_url || 'assets/images/logo.png')}"
                                class="w-10 h-10 rounded-full object-cover"
                            >

                        </td>

                        <td class="p-3">

                            ${this.safe(profile.first_name || "")}

                            ${this.safe(profile.last_name || "")}

                        </td>

                        <td class="p-3">

                            ${this.safe(profile.email || "-")}

                        </td>

                        <td class="p-3">

                            ${this.safe(profile.role || "-")}

                        </td>

                        <td class="p-3">

                            ${this.safe(profile.phone || "-")}

                        </td>

                        <td class="p-3">

                            ${this.safe(profile.status || "-")}

                        </td>

                        <td class="p-3 text-xs text-slate-500">
                            ${profile.must_change_password ? "Temporary — change required" : "Protected"}
                        </td>

                        <td class="p-3 flex gap-2">

                            <button
                                class="view-btn text-blue-600"
                                data-id="${this.safe(profile.id)}"
                            >
                                View
                            </button>

                            <button
                                class="edit-btn text-green-600"
                                data-id="${this.safe(profile.id)}"
                            >
                                Edit
                            </button>

                            <button
                                class="delete-btn text-red-600"
                                data-id="${this.safe(profile.id)}"
                            >
                                Delete
                            </button>

                            <button
                                class="reset-password-btn text-amber-700"
                                data-id="${this.safe(profile.id)}"
                            >
                                Reset password
                            </button>

                        </td>

                    </tr>

                `;

            });

        }

        static filterProfiles() {
            const query = String(document.getElementById("profile-search")?.value || "").trim().toLowerCase();
            const role = String(document.getElementById("role-filter")?.value || "").toLowerCase();
            const status = String(document.getElementById("status-filter")?.value || "").toLowerCase();

            const rows = this.profiles.filter((profile) => {
                const text = [profile.first_name, profile.last_name, profile.email, profile.phone, profile.role, profile.status]
                    .join(" ")
                    .toLowerCase();
                return (!query || text.includes(query))
                    && (!role || String(profile.role || "").toLowerCase() === role)
                    && (!status || String(profile.status || "").toLowerCase() === status);
            });
            this.renderTable(rows);
        }

        static notify(message, tone = "success") {
            if (tone === "success" && window.Utils?.success) return Utils.success(message);
            if (tone === "error" && window.Utils?.error) return Utils.error(message);
            window.alert(message);
        }

        static closeModal() {
            document.getElementById("profile-action-modal")?.remove();
        }

        static openPasswordReset(profile) {
            const modal = document.createElement("div");
            modal.id = "profile-action-modal";
            modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4";
            modal.innerHTML = `<form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 class="text-xl font-bold">Set temporary password</h3><p class="mt-2 text-sm text-slate-600">For ${this.safe(profile.email)}. Share it securely; it is never stored or shown again.</p><label class="mt-4 block">Temporary password<input name="password" type="password" minlength="8" required class="mt-1 w-full rounded border px-3 py-2" /></label><p data-reset-error class="hidden mt-3 text-sm text-red-600"></p><div class="mt-5 flex justify-end gap-2"><button type="button" data-profile-close class="rounded border px-4 py-2">Cancel</button><button class="rounded bg-amber-600 px-4 py-2 text-white">Set password</button></div></form>`;
            document.body.appendChild(modal);
            modal.querySelector("[data-profile-close]")?.addEventListener("click", () => this.closeModal());
            modal.querySelector("form")?.addEventListener("submit", async (event) => {
                event.preventDefault();
                const password = String(new FormData(event.currentTarget).get("password") || "");
                const errorBox = modal.querySelector("[data-reset-error]");
                const { data, error } = await API.db.functions.invoke("create-user", { body: { operation: "reset-profile-password", profile_id: profile.id, password } });
                if (error || data?.error) { errorBox.textContent = data?.error || error?.message || "Unable to reset password."; errorBox.classList.remove("hidden"); return; }
                this.closeModal();
                await this.loadProfiles();
                this.notify("Temporary password set. Share it with the user securely.");
            });
        }

        static openModal(mode, profile = null) {
            const isCreate = mode === "create";
            const title = isCreate ? "Create User" : mode === "view" ? "User Profile" : "Edit User";
            const readOnly = mode === "view";
            const value = (key) => this.safe(profile?.[key] || "");
            // Student and teacher accounts need their dedicated admission and
            // employment workflows, which also create linked records.
            const roles = ["admin", "executive", "finance", "hr", "admission", "exam", "library", "parent"];

            const modal = document.createElement("div");
            modal.id = "profile-action-modal";
            modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4";
            modal.innerHTML = `
              <div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
                <div class="mb-4 flex items-center justify-between"><h3 class="text-xl font-bold">${title}</h3><button type="button" data-profile-close>Close</button></div>
                <form id="profile-action-form" class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label>First name<input name="first_name" value="${value("first_name")}" ${readOnly ? "readonly" : "required"} class="mt-1 w-full rounded border px-3 py-2" /></label>
                  <label>Last name<input name="last_name" value="${value("last_name")}" ${readOnly ? "readonly" : "required"} class="mt-1 w-full rounded border px-3 py-2" /></label>
                  <label class="md:col-span-2">Email<input name="email" type="email" value="${value("email")}" ${readOnly ? "readonly" : "required"} class="mt-1 w-full rounded border px-3 py-2" /></label>
                  <label>Phone<input name="phone" value="${value("phone")}" ${readOnly ? "readonly" : ""} class="mt-1 w-full rounded border px-3 py-2" /></label>
                  <label>Role<select name="role" ${readOnly ? "disabled" : ""} class="mt-1 w-full rounded border px-3 py-2">${roles.map((role) => `<option value="${role}" ${String(profile?.role || "student") === role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
                  <label>Status<select name="status" ${readOnly ? "disabled" : ""} class="mt-1 w-full rounded border px-3 py-2">${["active", "inactive", "pending", "suspended"].map((status) => `<option value="${status}" ${String(profile?.status || "active") === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
                  ${isCreate ? `<label>Password<div class="relative mt-1"><input name="password" type="password" minlength="8" required class="w-full rounded border px-3 py-2 pr-16" /><button type="button" data-password-toggle class="absolute inset-y-0 right-2 text-sm text-blue-700 hover:text-blue-900" aria-label="Show password">Show</button></div></label>` : ""}
                  <div class="md:col-span-2 flex justify-end gap-2"><button type="button" data-profile-close class="rounded border px-4 py-2">Cancel</button>${readOnly ? "" : '<button class="rounded bg-blue-600 px-4 py-2 text-white">Save</button>'}</div>
                </form>
              </div>`;
            document.body.appendChild(modal);

            modal.querySelectorAll("[data-profile-close]").forEach((button) => button.addEventListener("click", () => this.closeModal()));
            modal.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
                const input = button.parentElement?.querySelector('input[type="password"], input[type="text"]');
                if (!input) return;
                const hidden = input.type === "password";
                input.type = hidden ? "text" : "password";
                button.textContent = hidden ? "Hide" : "Show";
                button.setAttribute("aria-label", `${hidden ? "Hide" : "Show"} password`);
            }));
            modal.addEventListener("click", (event) => { if (event.target === modal) this.closeModal(); });
            modal.querySelector("form")?.addEventListener("submit", async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const payload = Object.fromEntries(form.entries());
                try {
                    if (isCreate) {
                        const result = await Auth.createOfficeAccount(payload);
                        if (!result?.success) throw new Error(result?.message || "Unable to create user.");
                    } else {
                        const { data, error } = await API.db.functions.invoke("create-user", {
                            body: {
                                operation: "update-profile",
                                profile_id: profile.id,
                                first_name: payload.first_name,
                                last_name: payload.last_name,
                                email: payload.email,
                                phone: payload.phone,
                                role: payload.role,
                                status: payload.status
                            }
                        });
                        if (error) throw new Error(error.message || "Unable to update profile.");
                        if (data?.error) throw new Error(data.error);
                    }
                    this.closeModal();
                    await this.loadProfiles();
                    this.notify(isCreate ? "User created successfully." : "Profile updated successfully.");
                } catch (error) {
                    this.notify(error.message || "Unable to save profile.", "error");
                }
            });
        }

        static bindEvents() {
            document.getElementById("create-user-btn")?.addEventListener("click", () => this.openModal("create"));
            ["profile-search", "role-filter", "status-filter"].forEach((id) => {
                document.getElementById(id)?.addEventListener(id === "profile-search" ? "input" : "change", () => this.filterProfiles());
            });
            document.getElementById("profiles-table")?.addEventListener("click", async (event) => {
                const button = event.target.closest("button[data-id]");
                if (!button) return;
                const profile = this.profiles.find((item) => String(item.id) === String(button.dataset.id));
                if (!profile) return;
                if (button.classList.contains("view-btn")) return this.openModal("view", profile);
                if (button.classList.contains("edit-btn")) return this.openModal("edit", profile);
                if (button.classList.contains("reset-password-btn")) return this.openPasswordReset(profile);
                if (button.classList.contains("delete-btn")) {
                    if (!window.confirm(`Permanently delete ${profile.email}? This removes the login and cannot be undone.`)) return;
                    try {
                        const { data, error } = await API.db.functions.invoke("create-user", {
                            body: { operation: "delete-profile", profile_id: profile.id }
                        });
                        if (error) {
                            const message = typeof API.functionErrorMessage === "function"
                                ? await API.functionErrorMessage(error, "Unable to delete user.")
                                : error.message;
                            throw new Error(message);
                        }
                        if (data?.error) throw new Error(data.error);
                        await this.loadProfiles();
                        this.notify(data?.message || "User profile deleted successfully.");
                    } catch (error) {
                        this.notify(error.message || "Unable to delete user.", "error");
                    }
                }
            });
        }

        static renderStatistics(profiles) {

            document.getElementById("total-users").textContent =
                profiles.length;

            document.getElementById("student-count").textContent =
                profiles.filter(x => x.role === "student").length;

            document.getElementById("teacher-count").textContent =
                profiles.filter(x => x.role === "teacher").length;

            document.getElementById("parent-count").textContent =
                profiles.filter(x => x.role === "parent").length;

            document.getElementById("admin-count").textContent =
                profiles.filter(x =>
                    x.role === "admin" ||
                    x.role === "ceo" ||
                    x.role === "executive"
                ).length;

        }

        static populateRoleFilter(profiles) {

            const select = document.getElementById("role-filter");

            const roles = [...new Set(profiles.map(x => x.role))];

            roles.forEach(role => {

                select.innerHTML += `
                    <option value="${role}">
                        ${role}
                    </option>
                `;

            });

        }

    }

    window.ProfilesModule = ProfilesModule;

})();
