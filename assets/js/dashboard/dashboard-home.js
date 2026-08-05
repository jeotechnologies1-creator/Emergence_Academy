/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD HOME
   Version 2.0
========================================================== */

class DashboardHome {

    static RECENT_ACCOUNTS_KEY = "emergence_recent_accounts";

    /* ======================================================
       RENDER
    ====================================================== */

    static async render(container) {

        container.innerHTML = this.loading();

        try {

            const [

                profile,

                stats,

                announcements

            ] = await Promise.all([

                Auth.profile(),

                API.dashboard.stats(),

                API.announcements.getLatest()

            ]);

            container.innerHTML = this.template(

                profile,

                stats,

                announcements

            );

            this.initialize();

        }

        catch (error) {

            console.error(error);

            container.innerHTML = this.error();

        }

    }

    /* ======================================================
       TEMPLATE
    ====================================================== */

    static template(profile, stats, announcements) {

        return `

<div class="space-y-8">

    <div class="bg-white rounded-xl shadow p-6">

        <h2 class="text-3xl font-bold">

            Welcome, ${profile?.first_name ?? "User"}

        </h2>

        <p class="text-gray-500">

            ${(profile?.role || "").toUpperCase()}

        </p>

    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        ${this.card("Students", stats.students, "👨‍🎓")}

        ${this.card("Teachers", stats.teachers, "👩‍🏫")}

        ${this.card("Classes", stats.classes, "🏫")}

        ${this.card("Subjects", stats.subjects, "📚")}

    </div>

    <div class="bg-white rounded-xl shadow p-6">

        <h3 class="text-xl font-bold mb-5">

            Latest Announcements

        </h3>

        ${this.announcements(announcements)}

    </div>

    ${this.officeGenerator(profile)}

</div>

`;

    }

    /* ======================================================
       STAT CARD
    ====================================================== */

    static card(title, value, icon) {

        return `

<div class="bg-white rounded-xl shadow p-5">

    <div class="flex items-center justify-between">

        <div>

            <p class="text-gray-500">

                ${title}

            </p>

            <h2 class="text-3xl font-bold mt-2">

                ${value ?? 0}

            </h2>

        </div>

        <div class="text-5xl">

            ${icon}

        </div>

    </div>

</div>

`;

    }

    /* ======================================================
       ANNOUNCEMENTS
    ====================================================== */

    static announcements(items) {

        if (!items || items.length === 0) {

            return `

<div class="text-center py-8 text-gray-500">

No announcements available.

</div>

`;

        }

        return items.map(item => `

<div class="border-b py-4 last:border-b-0">

    <h4 class="font-semibold text-lg">

        ${item.title ?? "Untitled"}

    </h4>

    <p class="text-gray-600 mt-1">

        ${item.message ?? ""}

    </p>

    <div class="text-xs text-gray-400 mt-2">

        ${item.created_at
            ? new Date(item.created_at).toLocaleString()
            : ""}

    </div>

</div>

`).join("");

    }

    static officeGenerator(profile) {

        const role = String(profile?.role || "").toLowerCase();

        if (!["admin", "ceo"].includes(role)) {
            return "";
        }

        return `

<div class="bg-white rounded-xl shadow p-6">

    <h3 class="text-xl font-bold mb-2">

        Create Office Account

    </h3>

    <p class="text-sm text-gray-500 mb-5">

        Admin/CEO can generate accounts for offices and staff access.

    </p>

    <form id="office-generator-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <input id="office-first-name" type="text" placeholder="First name" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>

        <input id="office-last-name" type="text" placeholder="Last name" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>

        <input id="office-email" type="email" placeholder="Email address" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>

        <input id="office-phone" type="text" placeholder="Phone number" class="w-full rounded-lg border border-slate-300 px-3 py-2.5">

        <select id="office-role" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>
            <option value="teacher">Teacher</option>
            <option value="executive">Executive</option>
            <option value="admin">Admin</option>
            <option value="finance">Finance</option>
            <option value="hr">HR</option>
            <option value="admission">Admission</option>
            <option value="exam">Exam</option>
            <option value="library">Library</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
        </select>

        <div class="flex gap-2">
            <input id="office-password" type="text" placeholder="Password (leave blank to auto-generate)" class="w-full rounded-lg border border-slate-300 px-3 py-2.5">
            <button id="office-generate-password" type="button" class="px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Generate</button>
            <button id="office-copy-password" type="button" class="px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Copy</button>
        </div>

        <div class="md:col-span-2 flex items-center gap-3">
            <button id="office-submit" type="submit" class="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 font-semibold">Create Office User</button>
            <div id="office-generator-status" class="text-sm text-slate-600"></div>
        </div>

    </form>

    <div class="mt-6 border-t pt-5">
        <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-slate-800">Recently Created Accounts</h4>
            <button id="office-clear-recent" type="button" class="text-sm text-slate-500 hover:text-slate-700">Clear</button>
        </div>
        <div id="office-recent-list" class="space-y-2 text-sm"></div>
    </div>

</div>

`;

    }

    static generatePassword(length = 12) {

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
        let out = "";

        for (let i = 0; i < length; i += 1) {
            out += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return out;

    }

    static safeText(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");

    }

    static loadRecentAccounts() {

        try {
            const raw = localStorage.getItem(this.RECENT_ACCOUNTS_KEY);
            const list = JSON.parse(raw || "[]");
            return Array.isArray(list) ? list : [];
        } catch (error) {
            console.error("Unable to parse recent accounts list:", error);
            return [];
        }

    }

    static saveRecentAccounts(list) {

        localStorage.setItem(this.RECENT_ACCOUNTS_KEY, JSON.stringify(list));

    }

    static appendRecentAccount(account) {

        const existing = this.loadRecentAccounts();
        const updated = [account, ...existing].slice(0, 10);
        this.saveRecentAccounts(updated);
        this.renderRecentAccounts();

    }

    static renderRecentAccounts() {

        const target = document.getElementById("office-recent-list");

        if (!target) return;

        const entries = this.loadRecentAccounts();

        if (!entries.length) {
            target.innerHTML = '<div class="text-slate-500">No created accounts yet.</div>';
            return;
        }

        target.innerHTML = entries.map((item, index) => {
            const firstName = this.safeText(item.first_name);
            const lastName = this.safeText(item.last_name);
            const email = this.safeText(item.email);
            const role = this.safeText(String(item.role || "").toUpperCase());
            const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "";
            const hasPassword = Boolean(item.temp_password);
            const passwordLabel = hasPassword ? "Saved" : "Not saved";
            return `
<div class="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
    <div class="font-medium text-slate-800">${firstName} ${lastName} <span class="text-slate-500">(${role})</span></div>
    <div class="text-slate-600">${email}</div>
    <div class="text-xs text-slate-500 mt-1">Created: ${this.safeText(createdAt)}</div>
    <div class="text-xs text-slate-500 mt-1">Password: ${passwordLabel}</div>
    <div class="mt-2 flex items-center gap-2">
        <button type="button" data-account-action="copy-email" data-account-index="${index}" class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700">Copy Email</button>
        <button type="button" data-account-action="copy-password" data-account-index="${index}" class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 ${hasPassword ? "" : "opacity-50 cursor-not-allowed"}">Copy Password</button>
        <button type="button" data-account-action="resend-invite" data-account-index="${index}" class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700">Resend Invite</button>
    </div>
</div>
`;
        }).join("");

    }

    static setOfficeStatus(message, tone = "info") {

        const status = document.getElementById("office-generator-status");

        if (!status) return;

        if (tone === "success") {
            status.className = "text-sm text-emerald-700";
        } else if (tone === "warning") {
            status.className = "text-sm text-amber-700";
        } else if (tone === "error") {
            status.className = "text-sm text-red-600";
        } else {
            status.className = "text-sm text-slate-600";
        }

        status.textContent = message;

    }

    static async copyText(value, successMessage, failureMessage) {

        try {
            if (!navigator?.clipboard?.writeText) {
                throw new Error("Clipboard API unavailable");
            }
            await navigator.clipboard.writeText(value);
            this.setOfficeStatus(successMessage, "success");
        } catch (error) {
            console.error(error);
            this.setOfficeStatus(failureMessage, "error");
        }

    }

    static async copyPassword() {

        const passwordInput = document.getElementById("office-password");

        if (!passwordInput) return;

        const value = passwordInput.value?.trim();

        if (!value) {
            this.setOfficeStatus("Generate or type a password before copying.", "warning");
            return;
        }

        await this.copyText(value, "Password copied to clipboard.", "Unable to copy password.");

    }

    static bindRecentListActions() {

        const target = document.getElementById("office-recent-list");

        if (!target) return;

        target.onclick = async (event) => {

            const btn = event.target.closest("button[data-account-action]");

            if (!btn) return;

            const action = btn.getAttribute("data-account-action");
            const index = Number(btn.getAttribute("data-account-index"));
            const entries = this.loadRecentAccounts();
            const item = entries[index];

            if (!item) {
                this.setOfficeStatus("Selected account was not found.", "error");
                return;
            }

            if (action === "copy-email") {
                await this.copyText(String(item.email || ""), "Email copied to clipboard.", "Unable to copy email.");
                return;
            }

            if (action === "copy-password") {
                if (!item.temp_password) {
                    this.setOfficeStatus("Password is not available for this account.", "warning");
                    return;
                }
                await this.copyText(String(item.temp_password), "Temporary password copied.", "Unable to copy password.");
                return;
            }

            if (action === "resend-invite") {
                this.setOfficeStatus(`Invite resend queued for ${item.email}.`, "info");
            }

        };

    }

    static bindOfficeGenerator() {

        const form = document.getElementById("office-generator-form");

        if (!form) return;

        const passwordInput = document.getElementById("office-password");
        const generateBtn = document.getElementById("office-generate-password");
        const copyBtn = document.getElementById("office-copy-password");
        const clearRecentBtn = document.getElementById("office-clear-recent");
        const submit = document.getElementById("office-submit");

        if (generateBtn && passwordInput) {
            generateBtn.onclick = () => {
                passwordInput.value = this.generatePassword();
            };
        }

        if (copyBtn) {
            copyBtn.onclick = async () => {
                await this.copyPassword();
            };
        }

        if (clearRecentBtn) {
            clearRecentBtn.onclick = () => {
                this.saveRecentAccounts([]);
                this.renderRecentAccounts();
                this.setOfficeStatus("Recent account list cleared.", "info");
            };
        }

        this.renderRecentAccounts();
        this.bindRecentListActions();

        form.onsubmit = async (event) => {

            event.preventDefault();

            this.setOfficeStatus("Creating office account...", "info");

            if (submit) submit.disabled = true;

            try {
                const payload = {
                    first_name: document.getElementById("office-first-name")?.value?.trim() || "",
                    last_name: document.getElementById("office-last-name")?.value?.trim() || "",
                    email: document.getElementById("office-email")?.value?.trim().toLowerCase() || "",
                    phone: document.getElementById("office-phone")?.value?.trim() || "",
                    role: document.getElementById("office-role")?.value || "student",
                    password: passwordInput?.value?.trim() || this.generatePassword()
                };

                if (!payload.first_name || !payload.last_name || !payload.email) {
                    throw new Error("First name, last name, and email are required.");
                }

                const result = await Auth.createOfficeAccount(payload);

                if (!result?.success) {
                    throw new Error(result?.message || "Unable to create office account.");
                }

                const okMessage = result?.data?.message || "Office account created successfully.";

                this.setOfficeStatus(`${okMessage} Temporary password: ${payload.password}`, "success");

                this.appendRecentAccount({
                    first_name: payload.first_name,
                    last_name: payload.last_name,
                    email: payload.email,
                    role: payload.role,
                    temp_password: payload.password,
                    created_at: new Date().toISOString()
                });

                form.reset();

            } catch (error) {

                console.error(error);

                this.setOfficeStatus(error.message || "Failed to create office account.", "error");

            } finally {
                if (submit) submit.disabled = false;
            }

        };

    }

    /* ======================================================
       LOADING
    ====================================================== */

    static loading() {

        return `

<div class="flex justify-center items-center py-20">

    <div class="text-gray-500">

        Loading dashboard...

    </div>

</div>

`;

    }

    /* ======================================================
       ERROR
    ====================================================== */

    static error() {

        return `

<div class="text-center py-20 text-red-600">

Unable to load dashboard.

</div>

`;

    }

    /* ======================================================
       INITIALIZE
    ====================================================== */

    static initialize() {

        this.bindOfficeGenerator();

        console.log("Dashboard Home Loaded");

    }

}

window.DashboardHome = DashboardHome;