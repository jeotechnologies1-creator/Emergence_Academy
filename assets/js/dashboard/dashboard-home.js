/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD HOME
   Version 2.0
========================================================== */

class DashboardHome {

    static RECENT_ACCOUNTS_KEY = "emergence_recent_accounts";
    static ACTIVITY_FILTERS = {
        module: "all",
        action: "all",
        period: "7d"
    };

    static OFFICE_ACTIVITY_WINDOW = "7d";

    static ROLE_COPY = {
        ceo: "Executive overview of academic performance, operations, and finance.",
        admin: "Monitor school-wide operations and keep every office in sync.",
        executive: "Track strategic indicators and align cross-office execution.",
        teacher: "Manage classes, attendance, assignments, and learner progress.",
        student: "Follow your coursework, attendance, grades, and announcements.",
        parent: "Track your child\'s attendance, performance, and school updates.",
        finance: "Manage collections, balances, and accounting visibility.",
        hr: "Coordinate workforce records, assignments, and staff updates.",
        admission: "Track admissions, onboarding, and parent engagement.",
        exam: "Oversee assessments, grading progress, and result integrity.",
        library: "Coordinate learning resources and institutional circulation insights."
    };

    static ROLE_METRICS = {
        ceo: ["students", "teachers", "finance", "reports"],
        admin: ["students", "teachers", "attendance", "notifications"],
        executive: ["students", "grades", "finance", "reports"],
        teacher: ["students", "attendance", "assignments", "grades"],
        student: ["assignments", "grades", "attendance", "notifications"],
        parent: ["students", "attendance", "grades", "finance"],
        finance: ["finance", "reports", "notifications", "activity"],
        hr: ["teachers", "reports", "notifications", "activity"],
        admission: ["students", "parents", "notifications", "reports"],
        exam: ["assignments", "grades", "reports", "notifications"],
        library: ["students", "teachers", "reports", "activity"]
    };

    static METRIC_META = {
        students: { label: "Enrolled Students", icon: "👨‍🎓" },
        teachers: { label: "Teachers", icon: "👩‍🏫" },
        parents: { label: "Parents", icon: "👨‍👩‍👧" },
        classes: { label: "Classes", icon: "🏫" },
        subjects: { label: "Subjects", icon: "📚" },
        attendance: { label: "Attendance", icon: "🗓️" },
        assignments: { label: "Assignments", icon: "📝" },
        grades: { label: "Grades", icon: "📊" },
        finance: { label: "Finance", icon: "💳" },
        reports: { label: "Reports", icon: "📈" },
        notifications: { label: "Notifications", icon: "🔔" },
        activity: { label: "Activity Logs", icon: "🧾" }
    };

    static ROLE_WIDGETS = {
        ceo: [
            "Institution performance snapshot across academics and finance.",
            "Executive queue: review cross-office reports and major alerts.",
            "Governance pulse: monitor notification flow and activity trails."
        ],
        admin: [
            "Operational command center for student and staff records.",
            "Compliance watch: attendance and grade cycle completeness.",
            "Communication board: announcement and notification readiness."
        ],
        executive: [
            "Strategy dashboard for results, delivery pace, and collections.",
            "Coordination lane for high-impact module follow-ups.",
            "Leadership tracker for school-wide activity volume."
        ],
        teacher: [
            "Class delivery monitor for attendance and assignment flow.",
            "Assessment tracker for grading velocity and feedback loops.",
            "Engagement feed for class-level notifications and updates."
        ],
        student: [
            "Learning queue for assignments due and grade publications.",
            "Attendance heartbeat to keep your record in good standing.",
            "Academic feed for notices and AI-assisted study prompts."
        ],
        parent: [
            "Child performance watch across attendance and grades.",
            "Finance touchpoint for payments and billing updates.",
            "School channel for alerts, reports, and follow-up notices."
        ],
        finance: [
            "Collections visibility and reconciliation checkpoints.",
            "Reporting lane for finance summaries and trends.",
            "Audit trail pulse for payment-related operations."
        ],
        hr: [
            "Workforce records health for staff and profile updates.",
            "Staff communication queue and office-wide notices.",
            "HR reporting touchpoint for workforce activity metrics."
        ],
        admission: [
            "Enrollment pipeline monitor for student onboarding.",
            "Guardian engagement lane for parent profile readiness.",
            "Admission reporting board for conversion progress."
        ],
        exam: [
            "Assessment readiness monitor for assignments and grades.",
            "Result publication lane and performance reporting.",
            "Exam communication board for schedule and integrity notices."
        ],
        library: [
            "Academic resource coordination for learners and staff.",
            "Library reporting lane for engagement and usage oversight.",
            "Operational pulse for notifications and activity traces."
        ]
    };

    static ROLE_ACTIONS = {
        ceo: [
            { label: "Open Reports", route: "reports" },
            { label: "Open Finance", route: "finance" },
            { label: "Open Notifications", route: "notifications" }
        ],
        admin: [
            { label: "Manage Students", route: "students" },
            { label: "Manage Teachers", route: "teachers" },
            { label: "Open AI Assistant", route: "ai" }
        ],
        executive: [
            { label: "Open Dashboard", route: "dashboard" },
            { label: "Open Reports", route: "reports" },
            { label: "Open Grades", route: "grades" }
        ],
        teacher: [
            { label: "Take Attendance", route: "attendance" },
            { label: "Post Assignment", route: "assignments" },
            { label: "Open Grades", route: "grades" }
        ],
        student: [
            { label: "View Assignments", route: "assignments" },
            { label: "Check Grades", route: "grades" },
            { label: "Open AI Assistant", route: "ai" }
        ],
        parent: [
            { label: "Track Attendance", route: "attendance" },
            { label: "View Grades", route: "grades" },
            { label: "Open Finance", route: "finance" }
        ],
        finance: [
            { label: "Open Finance", route: "finance" },
            { label: "Open Reports", route: "reports" },
            { label: "View Notifications", route: "notifications" }
        ],
        hr: [
            { label: "Open Teachers", route: "teachers" },
            { label: "Open Reports", route: "reports" },
            { label: "View Notifications", route: "notifications" }
        ],
        admission: [
            { label: "Open Students", route: "students" },
            { label: "Open Parents", route: "parents" },
            { label: "Open Reports", route: "reports" }
        ],
        exam: [
            { label: "Open Assignments", route: "assignments" },
            { label: "Open Grades", route: "grades" },
            { label: "Open Reports", route: "reports" }
        ],
        library: [
            { label: "Open Students", route: "students" },
            { label: "Open Teachers", route: "teachers" },
            { label: "Open Reports", route: "reports" }
        ]
    };

    static normalizedRole(profile) {
        const rawRole = String(profile?.role || "student").trim();
        if (window.RoleRouter?.normalizeRole) {
            return RoleRouter.normalizeRole(rawRole);
        }
        return rawRole.toLowerCase() === "administrator" ? "admin" : rawRole.toLowerCase();
    }

    /* ======================================================
       RENDER
    ====================================================== */

    static async render(container) {

        container.innerHTML = this.loading();

        try {

            const profile = await Auth.profile();
            const role = this.normalizedRole(profile);
            const [
                stats,

                announcements,

                permissions,

                recentActivity

            ] = await Promise.all([
                API.dashboard.stats(),

                API.announcements.getLatest(),


                Auth.permissions(),

                this.fetchRecentActivity()

            ]);

            this.currentActivity = Array.isArray(recentActivity) ? recentActivity : [];

            container.innerHTML = this.template(

                profile,

                stats,

                announcements,

                permissions,

                recentActivity

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

    static template(profile, stats, announcements, permissions, recentActivity) {

        const role = this.normalizedRole(profile);
        const copy = this.ROLE_COPY[role] || this.ROLE_COPY.student;

        return `

<div class="space-y-8">

    <div class="bg-white rounded-xl shadow p-6">

        <h2 class="text-3xl font-bold">

            Welcome, ${profile?.first_name ?? "User"}

        </h2>

        <p class="text-gray-500">

            ${(profile?.role || "").toUpperCase()}

        </p>

        <p class="mt-2 text-sm text-slate-600">

            ${copy}

        </p>

    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        ${this.roleCards(role, stats)}

    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        ${this.roleWidgets(role)}

    </div>

    <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between gap-3 flex-wrap">
            <h3 class="text-lg font-semibold text-slate-800">Quick Actions</h3>
            <span class="text-xs uppercase tracking-wide text-slate-500">${role} office</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
            ${this.roleActions(role)}
        </div>
    </div>

    <div class="bg-white rounded-xl shadow p-6">

        <h3 class="text-xl font-bold mb-5">

            Latest Announcements

        </h3>

        ${this.announcements(announcements)}

    </div>

    <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 class="text-xl font-bold">Recent Activity</h3>
            ${this.activityFilterControls(recentActivity)}
        </div>
        ${this.officeActivityChart(recentActivity)}
        <div id="dashboard-activity-timeline">
            ${this.activityTimeline(this.filterActivity(recentActivity))}
        </div>
    </div>

    ${this.officeGenerator(profile, permissions)}

</div>

`;

    }

    static async fetchRecentActivity() {

        try {
            const profile = await Auth.profile();
            return await API.dashboard.recentActivity(8, {
                role: this.normalizedRole(profile),
                userId: profile?.id || ""
            });
        } catch (error) {
            console.error(error);
            return [];
        }

    }

    static activityTimeline(items) {

        if (!items || !items.length) {
            return '<div class="text-slate-500 text-sm">No activity recorded yet.</div>';
        }

        return items.map((item) => {
            const action = this.safeText(String(item.action || "activity").replace(/_/g, " "));
            const module = this.safeText(String(item.module || "general").replace(/_/g, " "));
            const details = this.safeText(String(item.description || "").slice(0, 180));
            const created = item.created_at ? new Date(item.created_at).toLocaleString() : "";

            return `
<div class="py-3 border-b border-slate-100 last:border-b-0">
    <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="font-semibold text-slate-800 uppercase text-sm">${action}</div>
        <div class="text-xs text-slate-500">${this.safeText(created)}</div>
    </div>
    <div class="text-xs uppercase tracking-wide text-slate-500 mt-1">${module}</div>
    <div class="text-sm text-slate-600 mt-1 break-words">${details || "No additional details"}</div>
</div>
`;
        }).join("");

    }

    static activityFilterControls(items) {

        const moduleOptions = ["all", ...this.uniqueValues(items, "module")];
        const actionOptions = ["all", ...this.uniqueValues(items, "action")];
        const moduleValue = this.ACTIVITY_FILTERS.module;
        const actionValue = this.ACTIVITY_FILTERS.action;
        const periodValue = this.ACTIVITY_FILTERS.period;

        const renderOptions = (list, selected, emptyLabel) => list.map((value) => {
            const safe = this.safeText(String(value || ""));
            const label = safe === "all"
                ? emptyLabel
                : this.safeText(String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()));
            return `<option value="${safe}" ${safe === selected ? "selected" : ""}>${label}</option>`;
        }).join("");

        return `
<div class="flex items-center gap-2 flex-wrap">
    <select id="activity-filter-module" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
        ${renderOptions(moduleOptions, moduleValue, "All Modules")}
    </select>
    <select id="activity-filter-action" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
        ${renderOptions(actionOptions, actionValue, "All Actions")}
    </select>
    <select id="activity-filter-period" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
        <option value="24h" ${periodValue === "24h" ? "selected" : ""}>Last 24 Hours</option>
        <option value="7d" ${periodValue === "7d" ? "selected" : ""}>Last 7 Days</option>
        <option value="30d" ${periodValue === "30d" ? "selected" : ""}>Last 30 Days</option>
        <option value="all" ${periodValue === "all" ? "selected" : ""}>All Time</option>
    </select>
</div>
`;

    }

    static officeActivityChart(items) {

        const source = this.filterActivityByWindow(items, this.OFFICE_ACTIVITY_WINDOW);
        const activity = this.aggregateOfficeActivity(source);

        if (!activity.length) {
            return `
<div class="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
    No office activity available for the last 7 days.
</div>
`;
        }

        const max = Math.max(...activity.map((item) => item.count), 1);

        return `
<div class="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
        <h4 class="text-sm font-semibold uppercase tracking-wide text-slate-700">Office Activity Snapshot</h4>
        <span class="text-xs text-slate-500">Last 7 days</span>
    </div>
    <div class="mt-4 space-y-3">
        ${activity.map((item) => {
            const ratio = Math.round((item.count / max) * 100);
            return `
<div>
    <div class="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span class="uppercase tracking-wide">${this.safeText(item.label)}</span>
        <span class="font-semibold text-slate-700">${item.count}</span>
    </div>
    <div class="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div class="h-full rounded-full bg-blue-600" style="width: ${ratio}%;"></div>
    </div>
</div>
`;
        }).join("")}
    </div>
</div>
`;

    }

    static filterActivityByWindow(items, windowKey = "7d") {

        const source = Array.isArray(items) ? items : [];
        const now = Date.now();
        const timeWindow = {
            "24h": 24 * 60 * 60 * 1000,
            "7d": 7 * 24 * 60 * 60 * 1000,
            "30d": 30 * 24 * 60 * 60 * 1000,
            "all": Number.POSITIVE_INFINITY
        };
        const maxAge = timeWindow[windowKey] ?? timeWindow["7d"];

        return source.filter((item) => {
            if (windowKey === "all") return true;
            const createdAt = item?.created_at ? new Date(item.created_at).getTime() : NaN;
            return Number.isFinite(createdAt) && (now - createdAt) <= maxAge;
        });

    }

    static aggregateOfficeActivity(items) {

        const map = new Map();

        (items || []).forEach((item) => {
            const module = String(item?.module || "general").trim().toLowerCase();
            const current = map.get(module) || 0;
            map.set(module, current + 1);
        });

        return Array.from(map.entries())
            .map(([module, count]) => ({
                label: module.replace(/_/g, " "),
                count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

    }

    static uniqueValues(items, key) {

        const out = new Set();
        (items || []).forEach((item) => {
            const value = String(item?.[key] || "").trim().toLowerCase();
            if (value) out.add(value);
        });
        return Array.from(out);

    }

    static filterActivity(items) {

        const source = Array.isArray(items) ? items : [];
        const moduleFilter = this.ACTIVITY_FILTERS.module;
        const actionFilter = this.ACTIVITY_FILTERS.action;
        const periodFilter = this.ACTIVITY_FILTERS.period;

        const now = Date.now();
        const timeWindow = {
            "24h": 24 * 60 * 60 * 1000,
            "7d": 7 * 24 * 60 * 60 * 1000,
            "30d": 30 * 24 * 60 * 60 * 1000
        };

        return source.filter((item) => {
            const module = String(item?.module || "").trim().toLowerCase();
            const action = String(item?.action || "").trim().toLowerCase();
            const createdAt = item?.created_at ? new Date(item.created_at).getTime() : NaN;

            if (moduleFilter !== "all" && module !== moduleFilter) return false;
            if (actionFilter !== "all" && action !== actionFilter) return false;

            if (periodFilter !== "all") {
                const maxAge = timeWindow[periodFilter] || timeWindow["7d"];
                if (!Number.isFinite(createdAt) || (now - createdAt) > maxAge) {
                    return false;
                }
            }

            return true;
        });

    }

    static bindActivityFilters() {

        const moduleSelect = document.getElementById("activity-filter-module");
        const actionSelect = document.getElementById("activity-filter-action");
        const periodSelect = document.getElementById("activity-filter-period");

        if (!moduleSelect || !actionSelect || !periodSelect) return;

        const onChange = () => {
            this.ACTIVITY_FILTERS.module = String(moduleSelect.value || "all").toLowerCase();
            this.ACTIVITY_FILTERS.action = String(actionSelect.value || "all").toLowerCase();
            this.ACTIVITY_FILTERS.period = String(periodSelect.value || "7d").toLowerCase();
            this.renderActivityTimeline();
        };

        moduleSelect.addEventListener("change", onChange);
        actionSelect.addEventListener("change", onChange);
        periodSelect.addEventListener("change", onChange);

    }

    static renderActivityTimeline() {

        const container = document.getElementById("dashboard-activity-timeline");
        if (!container) return;

        const source = Array.isArray(this.currentActivity) ? this.currentActivity : [];
        container.innerHTML = this.activityTimeline(this.filterActivity(source));

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

    static enrolledStudentsCard(value) {
        return `
<div class="rounded-xl bg-white p-5 shadow">
    <div class="flex items-center justify-between gap-3">
        <div><p class="text-gray-500">Enrolled Students</p><h2 class="mt-2 text-3xl font-bold">${value ?? 0}</h2><p class="mt-1 text-xs text-slate-500">Total admitted students</p></div>
        <div class="text-5xl">👨‍🎓</div>
    </div>
</div>`;

    }

    static roleCards(role, stats) {

        const keys = this.ROLE_METRICS[role] || this.ROLE_METRICS.student;

        return keys.map((key) => {
            const meta = this.METRIC_META[key] || { label: key, icon: "📌" };
            const value = Number(stats?.[key] ?? 0);
            if (key === "students" && ["ceo", "admin", "executive", "admission"].includes(role)) {
                return this.enrolledStudentsCard(value);
            }
            return this.card(meta.label, value, meta.icon);
        }).join("");

    }

    static roleWidgets(role) {

        const widgets = this.ROLE_WIDGETS[role] || this.ROLE_WIDGETS.student;

        return widgets.map((copy, index) => `
<div class="bg-white rounded-xl shadow p-5 border border-slate-100">
    <div class="text-xs uppercase tracking-wide text-blue-600 font-semibold">Office Widget ${index + 1}</div>
    <p class="mt-2 text-slate-700 leading-relaxed">${copy}</p>
</div>
`).join("");

    }

    static roleActions(role) {

        const actions = this.ROLE_ACTIONS[role] || this.ROLE_ACTIONS.student;

        return actions.map((action) => `
<button
    type="button"
    class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
    data-dashboard-action-route="${this.safeText(action.route)}"
>
    ${this.safeText(action.label)}
</button>
`).join("");

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

    static officeGenerator(profile, permissions = null) {

        const role = this.normalizedRole(profile);
        const canCreateUsers = role === "admin" || role === "ceo" || Boolean(permissions?.canDelete);

        if (!canCreateUsers) {
            return "";
        }

        return `

<div class="bg-white rounded-xl shadow p-6">

    <h3 class="text-xl font-bold mb-2">

        Create Office Account

    </h3>

    <p class="text-sm text-gray-500 mb-5">

        Admin/CEO can generate office and parent accounts. Teachers use the
        Teachers module; students use Student Admission, where their class,
        unique student ID, live-class access, and guardian link are set up.

    </p>

    <form id="office-generator-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <input id="office-first-name" type="text" placeholder="First name" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>

        <input id="office-last-name" type="text" placeholder="Last name" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>

        <input id="office-email" type="email" placeholder="Email address" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>

        <input id="office-phone" type="text" placeholder="Phone number" class="w-full rounded-lg border border-slate-300 px-3 py-2.5">

        <select id="office-role" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" required>
            <option value="executive">Executive</option>
            <option value="admin">Admin</option>
            <option value="finance">Finance</option>
            <option value="hr">HR</option>
            <option value="admission">Admission</option>
            <option value="exam">Exam</option>
            <option value="library">Library</option>
            <option value="parent">Parent</option>
        </select>

        <div class="flex gap-2">
            <div class="relative flex-1"><input id="office-password" type="password" placeholder="Password (leave blank to auto-generate)" class="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-16"><button id="office-toggle-password" type="button" class="absolute inset-y-0 right-2 text-sm text-blue-700 hover:text-blue-900" aria-label="Show password">Show</button></div>
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
        const toggleBtn = document.getElementById("office-toggle-password");
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

        if (toggleBtn && passwordInput) {
            toggleBtn.onclick = () => {
                const hidden = passwordInput.type === "password";
                passwordInput.type = hidden ? "text" : "password";
                toggleBtn.textContent = hidden ? "Hide" : "Show";
                toggleBtn.setAttribute("aria-label", `${hidden ? "Hide" : "Show"} password`);
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
                    role: document.getElementById("office-role")?.value || "executive",
                    password: passwordInput?.value?.trim() || this.generatePassword()
                };

                if (!payload.first_name || !payload.last_name || !payload.email) {
                    throw new Error("First name, last name, and email are required.");
                }

                if (payload.role === "student") {
                    throw new Error("Students must be admitted from the Students module.");
                }

                const result = await Auth.createOfficeAccount(payload);

                if (!result?.success) {
                    throw new Error(result?.message || "Unable to create office account.");
                }

                const okMessage = result?.data?.message || "Office account created successfully.";
                const profileSaved = result?.data?.profile_saved;
                const effectivePassword = result?.data?.temporary_password || payload.password;
                const suffix = profileSaved === false
                    ? " User can still log in using credentials; profile sync will complete on first login."
                    : "";

                this.setOfficeStatus(`${okMessage}${suffix} Temporary password: ${effectivePassword}`, "success");

                this.appendRecentAccount({
                    first_name: payload.first_name,
                    last_name: payload.last_name,
                    email: payload.email,
                    role: payload.role,
                    temp_password: effectivePassword,
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

    static bindRoleActions() {

        document.querySelectorAll("[data-dashboard-action-route]").forEach((button) => {
            button.addEventListener("click", async () => {
                const route = button.getAttribute("data-dashboard-action-route");

                if (!route) return;

                try {
                    await Router.navigate(route);

                    document.querySelectorAll("[data-route]").forEach((nav) => {
                        nav.classList.toggle("active", nav.getAttribute("data-route") === route);
                    });
                } catch (error) {
                    console.error(error);
                    this.setOfficeStatus("Unable to open the selected module.", "error");
                }
            });
        });

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
        this.bindRoleActions();
        this.bindActivityFilters();

        console.log("Dashboard Home Loaded");

    }

}

window.DashboardHome = DashboardHome;
