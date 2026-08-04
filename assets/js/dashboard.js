class Dashboard {

    static initialized = false;

    static async init() {

        if (this.initialized) return;

        this.registerModules();

        this.registerNavigation();

        this.registerMobileMenu();

        try {

            const loadLogo = () => {

                const logo = document.getElementById("school-logo");

                console.log("Logo element:", logo);
                console.log("Logo path:", window.APP_CONFIG?.logo);

                if (!logo) {
                    console.warn("school-logo not found. Retrying...");
                    setTimeout(loadLogo, 100);
                    return;
                }

                const logoPath =
                    window.APP_CONFIG?.logo ||
                    window.CONFIG?.logo ||
                    "assets/images/logo.jpeg";

                logo.src = logoPath;

                logo.onload = () => {
                    console.log("✅ Logo loaded successfully");
                };

                logo.onerror = () => {
                    console.error("❌ Failed to load logo:", logoPath);
                };

            };

            loadLogo();

            this.initialized = true;

        } catch (error) {

            console.error("Dashboard initialization failed:", error);

        }
    static registerModules() {

        const modules = {

            dashboard: window.DashboardHome,
            students: window.StudentsModule,
            teachers: window.TeachersModule,
            parents: window.ParentsModule,
            attendance: window.AttendanceModule,
            assignments: window.AssignmentModule,
            grades: window.GradesModule,
            finance: window.FinanceModule,
            reports: window.ReportsModule,
            notifications: window.NotificationModule,
            ai: window.AIModule

        };

        Object.entries(modules).forEach(([name, module]) => {

            if (module && module.render) {

                Router.register(name, container => module.render(container));

            }

        });

    }

    static registerNavigation() {

        const sidebar = document.getElementById("sidebar");

        const overlay = document.getElementById("sidebar-overlay");

        document.querySelectorAll("[data-route]").forEach(button => {

            button.onclick = async () => {

                const route = button.dataset.route;

                document.querySelectorAll("[data-route]").forEach(btn => {

                    btn.classList.remove("active");

                });

                button.classList.add("active");

                try {
                    await Router.navigate(route);
                } catch (err) {
                    console.error(err);
                    UI?.toast?.("Failed to open module.");
                }

                if (window.innerWidth < 1024) {

                    sidebar.classList.add("-translate-x-full");

                    overlay.classList.add("hidden");

                }

            };

        });

    }

    static registerMobileMenu() {

        const menu = document.getElementById("menu-toggle");

        const sidebar = document.getElementById("sidebar");

        const overlay = document.getElementById("sidebar-overlay");

        menu?.addEventListener("click", () => {

            sidebar.classList.toggle("-translate-x-full");

            overlay.classList.toggle("hidden");

        });

        overlay?.addEventListener("click", () => {

            sidebar.classList.add("-translate-x-full");

            overlay.classList.add("hidden");

        });

    }

}

// document.addEventListener("DOMContentLoaded", () => {

//     Dashboard.init();

// });

window.Dashboard = Dashboard;