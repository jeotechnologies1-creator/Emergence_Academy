class Dashboard {

    static initialized = false;

    static roleConfig = null;

    static async init() {

        if (this.initialized) return;

        if (typeof window.waitForSupabase === "function") {
            await window.waitForSupabase();
        }

        if (!window.supabaseClient) {
            throw new Error("Supabase connection is not ready.");
        }

        await Profile.load();

        this.roleConfig = await RoleRouter.redirect();

        await DashboardService.filterSidebar();

        this.activateLogout();

        this.registerModules();
        this.registerNavigation();
        this.registerMobileMenu();

        await this.navigateInitialRoute();

        this.initialized = true;

    } // ← THIS BRACE WAS MISSING

    static registerModules() {

        const modules = {

            dashboard: window.DashboardHome,
            profiles: window.ProfilesModule,
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

            if (module && typeof module.render === "function") {

                Router.register(name, container => module.render(container));

            } else {

                if (window.CONFIG?.DEBUG) {
                    console.warn(`Module "${name}" is missing or has no render() method.`);
                }

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

                    sidebar?.classList.add("-translate-x-full");
                    overlay?.classList.add("hidden");

                }

            };

        });

    }

    static async navigateInitialRoute() {

        const hashRoute = String(window.location.hash || "")
            .replace("#", "")
            .trim()
            .toLowerCase();

        const defaultRoute =
            window.RoleRouter?.getDefaultRoute?.() ||
            this.roleConfig?.defaultRoute ||
            "dashboard";

        const initialRoute = hashRoute || defaultRoute;

        const targetRoute = window.RoleRouter?.isAllowedRoute?.(initialRoute)
            ? initialRoute
            : defaultRoute;

        const activeButton = document.querySelector(`[data-route="${targetRoute}"]`);

        document.querySelectorAll("[data-route]").forEach((button) => {
            button.classList.remove("active");
        });

        if (activeButton) {
            activeButton.classList.add("active");
        }

        await Router.navigate(targetRoute);

    }

    static registerMobileMenu() {

        const menu = document.getElementById("menu-toggle");
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebar-overlay");

        menu?.addEventListener("click", () => {

            sidebar?.classList.toggle("-translate-x-full");
            overlay?.classList.toggle("hidden");

        });

        overlay?.addEventListener("click", () => {

            sidebar?.classList.add("-translate-x-full");
            overlay?.classList.add("hidden");

        });

    }

    static activateLogout() {

        document.querySelectorAll(".logout-btn").forEach((button) => {

            button.addEventListener("click", async (event) => {
                event.preventDefault();
                await this.handleLogout();
            });

        });

        document.addEventListener("click", async (event) => {

            const trigger = event.target.closest("[data-action='logout']");

            if (!trigger) return;

            event.preventDefault();

            await this.handleLogout();

        });

    }

    static async handleLogout() {

        const confirmed = window.confirm("Are you sure you want to logout?");

        if (!confirmed) return;

        try {
            await Auth.logout();
        } catch (error) {
            console.error("Logout failed:", error);
            window.location.replace("login.html");
        }

    }

}

window.Dashboard = Dashboard;