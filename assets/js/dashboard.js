/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD CONTROLLER
   Version: 2.1.0
========================================================== */

(function () {

    "use strict";

    class Dashboard {

        static initialized = false;

        static roleConfig = null;

        /* ======================================================
           INITIALIZE
        ====================================================== */

        static async init() {

            if (this.initialized) {
                return true;
            }

            console.log(
                "[Dashboard] Initializing..."
            );

            try {

                /* ----------------------------------------------
                   WAIT FOR SUPABASE
                ---------------------------------------------- */

                if (
                    typeof window.waitForSupabase === "function"
                ) {

                    await window.waitForSupabase();

                }

                if (!window.supabaseClient) {

                    throw new Error(
                        "Supabase connection is not ready."
                    );

                }

                /* ----------------------------------------------
                   VERIFY AUTHENTICATION
                ---------------------------------------------- */

                if (
                    window.Auth &&
                    typeof Auth.requireLogin === "function"
                ) {

                    const authenticated =
                        await Auth.requireLogin();

                    if (!authenticated) {
                        return false;
                    }

                }

                /* ----------------------------------------------
                   LOAD PROFILE
                ---------------------------------------------- */

                if (
                    window.Profile &&
                    typeof Profile.load === "function"
                ) {

                    const profile =
                        await Profile.load(true);

                    if (!profile) {

                        throw new Error(
                            "User profile could not be loaded."
                        );

                    }

                }

                /* ----------------------------------------------
                   DETERMINE ROLE
                ---------------------------------------------- */

                if (
                    window.RoleRouter &&
                    typeof RoleRouter.redirect === "function"
                ) {

                    this.roleConfig =
                        await RoleRouter.redirect();

                }

                /* ----------------------------------------------
                   REGISTER MODULES
                ---------------------------------------------- */

                this.registerModules();

                /* ----------------------------------------------
                   REGISTER NAVIGATION
                ---------------------------------------------- */

                this.registerNavigation();

                /* ----------------------------------------------
                   FILTER SIDEBAR
                ---------------------------------------------- */

                if (
                    window.DashboardService &&
                    typeof DashboardService.filterSidebar === "function"
                ) {

                    await DashboardService.filterSidebar();

                }

                /* ----------------------------------------------
                   LOGOUT
                ---------------------------------------------- */

                this.activateLogout();

                /* ----------------------------------------------
                   MOBILE MENU
                ---------------------------------------------- */

                this.registerMobileMenu();

                /* ----------------------------------------------
                   INITIAL ROUTE
                ---------------------------------------------- */

                await this.navigateInitialRoute();

                this.initialized = true;

                console.log(
                    "[Dashboard] Initialized successfully."
                );

                return true;

            } catch (error) {

                console.error(
                    "[Dashboard] Initialization failed:",
                    error
                );

                throw error;

            }

        }

        /* ======================================================
           REGISTER MODULES
        ====================================================== */

        static registerModules() {

            const modules = {

                dashboard:
                    window.DashboardHome,

                profiles:
                    window.ProfilesModule,

                students:
                    window.StudentsModule,

                teachers:
                    window.TeachersModule,

                parents:
                    window.ParentsModule,

                attendance:
                    window.AttendanceModule,

                assignments:
                    window.AssignmentModule,

                grades:
                    window.GradesModule,

                finance:
                    window.FinanceModule,

                reports:
                    window.ReportsModule,

                notifications:
                    window.NotificationModule,

                ai:
                    window.AIModule

            };

            const missing = [];

            Object.entries(modules).forEach(
                ([name, module]) => {

                    if (
                        module &&
                        typeof module.render === "function"
                    ) {

                        Router.register(
                            name,
                            async (container) => {

                                await module.render(
                                    container
                                );

                            }
                        );

                        console.log(
                            `[Dashboard] Module registered: ${name}`
                        );

                    } else {

                        missing.push(name);

                        console.warn(
                            `[Dashboard] Module unavailable: ${name}`
                        );

                    }

                }
            );

            /*
             * Dashboard itself must always exist.
             */

            if (
                !window.DashboardHome ||
                typeof window.DashboardHome.render !== "function"
            ) {

                throw new Error(
                    "Dashboard home module is missing. Check dashboard/dashboard-home.js."
                );

            }

            /*
             * Do not crash the entire dashboard because
             * an optional office module is unavailable.
             */

            if (missing.length) {

                console.warn(
                    "[Dashboard] Optional modules missing:",
                    missing
                );

            }

        }

        /* ======================================================
           NAVIGATION
        ====================================================== */

        static registerNavigation() {

            const sidebar =
                document.getElementById("sidebar");

            const overlay =
                document.getElementById(
                    "sidebar-overlay"
                );

            document
                .querySelectorAll("[data-route]")
                .forEach((button) => {

                    button.onclick = async (event) => {

                        event.preventDefault();

                        const route =
                            button.dataset.route;

                        if (!route) {
                            return;
                        }

                        document
                            .querySelectorAll("[data-route]")
                            .forEach((btn) => {

                                btn.classList.remove(
                                    "active"
                                );

                            });

                        button.classList.add(
                            "active"
                        );

                        try {

                            await Router.navigate(
                                route
                            );

                        } catch (error) {

                            console.error(
                                "[Dashboard] Navigation error:",
                                error
                            );

                            window.Utils?.toast?.(
                                error?.message ||
                                "Failed to open module.",
                                "error"
                            );

                        }

                        if (
                            window.innerWidth < 1024
                        ) {

                            sidebar?.classList.add(
                                "-translate-x-full"
                            );

                            overlay?.classList.add(
                                "hidden"
                            );

                        }

                    };

                });

        }

        /* ======================================================
           INITIAL ROUTE
        ====================================================== */

        static async navigateInitialRoute() {

            const hashRoute =
                String(
                    window.location.hash || ""
                )
                    .replace("#", "")
                    .trim()
                    .toLowerCase();

            const defaultRoute =
                window.RoleRouter?.getDefaultRoute?.() ||
                this.roleConfig?.defaultRoute ||
                "dashboard";

            let initialRoute =
                hashRoute ||
                defaultRoute;

            if (
                window.RoleRouter &&
                typeof RoleRouter.isAllowedRoute === "function"
            ) {

                if (
                    !RoleRouter.isAllowedRoute(
                        initialRoute
                    )
                ) {

                    initialRoute =
                        defaultRoute;

                }

            }

            const activeButton =
                document.querySelector(
                    `[data-route="${initialRoute}"]`
                );

            document
                .querySelectorAll("[data-route]")
                .forEach((button) => {

                    button.classList.remove(
                        "active"
                    );

                });

            activeButton?.classList.add(
                "active"
            );

            await Router.navigate(
                initialRoute
            );

        }

        /* ======================================================
           MOBILE MENU
        ====================================================== */

        static registerMobileMenu() {

            const menu =
                document.getElementById(
                    "menu-toggle"
                );

            const sidebar =
                document.getElementById(
                    "sidebar"
                );

            const overlay =
                document.getElementById(
                    "sidebar-overlay"
                );

            menu?.addEventListener(
                "click",
                () => {

                    sidebar?.classList.toggle(
                        "-translate-x-full"
                    );

                    overlay?.classList.toggle(
                        "hidden"
                    );

                }
            );

            overlay?.addEventListener(
                "click",
                () => {

                    sidebar?.classList.add(
                        "-translate-x-full"
                    );

                    overlay?.classList.add(
                        "hidden"
                    );

                }
            );

        }

        /* ======================================================
           LOGOUT
        ====================================================== */

        static activateLogout() {

            document
                .querySelectorAll(".logout-btn")
                .forEach((button) => {

                    button.onclick = async (event) => {

                        event.preventDefault();

                        await this.handleLogout();

                    };

                });

            document.addEventListener(
                "click",
                async (event) => {

                    const trigger =
                        event.target.closest(
                            "[data-action='logout']"
                        );

                    if (!trigger) {
                        return;
                    }

                    event.preventDefault();

                    await this.handleLogout();

                }
            );

        }

        static async handleLogout() {

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );

            if (!confirmed) {
                return;
            }

            try {

                if (
                    window.Auth &&
                    typeof Auth.logout === "function"
                ) {

                    await Auth.logout();

                } else {

                    window.location.replace(
                        "login.html"
                    );

                }

            } catch (error) {

                console.error(
                    "[Dashboard] Logout failed:",
                    error
                );

                window.location.replace(
                    "login.html"
                );

            }

        }

    }

    /*
     * IMPORTANT:
     *
     * Explicitly expose the class globally.
     */
    window.Dashboard = Dashboard;

    console.log(
        "[Dashboard] Dashboard controller loaded."
    );

})();