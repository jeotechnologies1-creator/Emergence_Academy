class Dashboard {

    static initialized = false;

    static async init() {

        if (this.initialized) return;

        this.registerModules();

        this.registerNavigation();

        this.registerMobileMenu();

        await Router.navigate("dashboard");

        this.initialized = true;

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

                await Router.navigate(route);

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

        menu.onclick = () => {

            sidebar.classList.toggle("-translate-x-full");

            overlay.classList.toggle("hidden");

        };

        overlay.onclick = () => {

            sidebar.classList.add("-translate-x-full");

            overlay.classList.add("hidden");

        };

    }

}

document.addEventListener("DOMContentLoaded", () => {

    Dashboard.init();

});

window.Dashboard = Dashboard;