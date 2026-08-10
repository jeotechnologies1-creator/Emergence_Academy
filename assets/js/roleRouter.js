/* ==========================================================
   EMERGENCE ACADEMY
   ROLE ROUTER
========================================================== */

const RoleRouter = {
    ROLE_ALIASES: {
        "administrator": "admin",
        "super admin": "admin",
        "super_admin": "admin",
        "ceo office": "ceo",
        "executive office": "executive",
        "teacher office": "teacher",
        "student office": "student",
        "parent office": "parent",
        "finance office": "finance",
        "accounts": "finance",
        "account": "finance",
        "accounting": "finance",
        "admissions": "admission",
        "admission office": "admission",
        "exam office": "exam",
        "exams": "exam",
        "library office": "library",
        "librarian": "library",
        "human resources": "hr",
        "human_resource": "hr"
    },

    ROLE_CONFIGS: {
        ceo: {
            title: "CEO Office",
            subtitle: "Strategic leadership, institution-wide insights, and controls.",
            defaultRoute: "dashboard",
            modules: ["dashboard", "profiles", "students", "teachers", "parents", "attendance", "assignments", "live-classes", "grades", "finance", "reports", "notifications", "ai"]
        },
        admin: {
            title: "Admin Office",
            subtitle: "School operations, records, and full module administration.",
            defaultRoute: "dashboard",
            modules: ["dashboard", "profiles", "students", "teachers", "parents", "attendance", "assignments", "live-classes", "grades", "finance", "reports", "notifications", "ai"]
        },
        executive: {
            title: "Executive Office",
            subtitle: "Operational oversight with cross-functional coordination.",
            defaultRoute: "dashboard",
            modules: ["dashboard", "students", "teachers", "parents", "attendance", "assignments", "live-classes", "grades", "finance", "reports", "notifications", "ai"]
        },
        teacher: {
            title: "Teacher Office",
            subtitle: "Classroom delivery, assessments, and learner performance.",
            defaultRoute: "dashboard",
            modules: ["dashboard", "students", "attendance", "assignments", "live-classes", "grades", "reports", "notifications", "ai"]
        },
        student: {
            title: "Student Office",
            subtitle: "Track coursework, submissions, grades, and announcements.",
            defaultRoute: "dashboard",
            modules: ["dashboard", "assignments", "live-classes", "grades", "attendance", "notifications", "ai"]
        },
        parent: {
            title: "Parent Office",
            subtitle: "Monitor child performance, attendance, and school billing.",
            defaultRoute: "dashboard",
            modules: ["dashboard", "students", "attendance", "grades", "finance", "reports", "notifications", "ai"]
        },
        finance: {
            title: "Finance Office",
            subtitle: "Manage payments, reconciliations, and financial reporting.",
            defaultRoute: "finance",
            modules: ["dashboard", "finance", "reports", "notifications"]
        },
        hr: {
            title: "HR Office",
            subtitle: "Manage staff records, recruitment, and workforce reporting.",
            defaultRoute: "teachers",
            modules: ["dashboard", "teachers", "reports", "notifications"]
        },
        admission: {
            title: "Admission Office",
            subtitle: "Handle enrolment workflow and guardian records.",
            defaultRoute: "students",
            modules: ["dashboard", "students", "parents", "reports", "notifications"]
        },
        exam: {
            title: "Exam Office",
            subtitle: "Coordinate assessments, grading, and performance analytics.",
            defaultRoute: "grades",
            modules: ["dashboard", "assignments", "live-classes", "grades", "reports", "notifications"]
        },
        library: {
            title: "Library Office",
            subtitle: "Coordinate learning resources and usage records.",
            defaultRoute: "students",
            modules: ["dashboard", "students", "teachers", "reports", "notifications"]
        }
    },

    currentRole: "student",

    normalizeRole(rawRole) {
        const base = String(rawRole || "")
            .trim()
            .toLowerCase()
            .replace(/[\-_]+/g, " ")
            .replace(/\s+/g, " ");

        if (!base) return "student";

        if (this.ROLE_CONFIGS[base]) {
            return base;
        }

        return this.ROLE_ALIASES[base] || "student";
    },

    async redirect() {
        const rawRole = await Auth.role();
        this.currentRole = this.normalizeRole(rawRole);
        this.applyRole(this.currentRole);
        return this.getCurrentConfig();
    },

    getCurrentRole() {
        return this.currentRole;
    },

    getCurrentConfig() {
        return this.ROLE_CONFIGS[this.currentRole] || this.ROLE_CONFIGS.student;
    },

    isAllowedRoute(route) {
        const config = this.getCurrentConfig();
        const allowed = config?.modules || ["dashboard"];
        return allowed.includes(route);
    },

    getDefaultRoute() {
        const config = this.getCurrentConfig();
        return config?.defaultRoute || "dashboard";
    },

    applyRole(role) {
        const config = this.ROLE_CONFIGS[role] || this.ROLE_CONFIGS.student;
        const safeRole = this.ROLE_CONFIGS[role] ? role : "student";

        document.body.dataset.role = safeRole;
        document.body.dataset.office = config.title;

        this.applyHeader(config);
        this.applySidebarVisibility(config.modules || []);

        console.log(`${config.title} loaded (${safeRole})`);
    },

    applyHeader(config) {
        const title = document.getElementById("dashboard-page-title");
        const subtitle = document.getElementById("dashboard-page-subtitle");

        if (title) {
            title.textContent = config.title;
        }

        if (subtitle) {
            subtitle.textContent = config.subtitle;
        }
    },

    applySidebarVisibility(allowedRoutes = []) {
        document.querySelectorAll("[data-route]").forEach((button) => {
            const route = button.getAttribute("data-route");
            const visible = allowedRoutes.includes(route);

            if (visible) {
                button.classList.remove("hidden");
                button.removeAttribute("aria-hidden");
                button.removeAttribute("disabled");
                return;
            }

            button.classList.add("hidden");
            button.setAttribute("aria-hidden", "true");
            button.setAttribute("disabled", "disabled");
            button.classList.remove("active");
        });
    }
};

window.RoleRouter = RoleRouter;
