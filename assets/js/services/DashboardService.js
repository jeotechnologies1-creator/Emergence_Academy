/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD SERVICE
========================================================== */

(function () {

    "use strict";

    class DashboardService {

        static config = {

            ceo: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "profiles",
                    "students",
                    "teachers",
                    "parents",
                    "attendance",
                    "assignments",
                    "grades",
                    "finance",
                    "reports",
                    "notifications",
                    "ai"
                ]
            },

            admin: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "profiles",
                    "students",
                    "teachers",
                    "parents",
                    "attendance",
                    "assignments",
                    "grades",
                    "finance",
                    "reports",
                    "notifications"
                ]
            },

            executive: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "reports",
                    "finance",
                    "students",
                    "teachers"
                ]
            },

            teacher: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "students",
                    "attendance",
                    "assignments",
                    "grades",
                    "notifications"
                ]
            },

            student: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "assignments",
                    "grades",
                    "notifications"
                ]
            },

            parent: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "grades",
                    "attendance",
                    "notifications"
                ]
            },

            finance: {
                home: "finance",
                modules: [
                    "dashboard",
                    "finance",
                    "reports",
                    "notifications"
                ]
            },

            library: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "notifications"
                ]
            },

            hr: {
                home: "dashboard",
                modules: [
                    "dashboard",
                    "teachers",
                    "reports"
                ]
            },

            admission: {
                home: "students",
                modules: [
                    "dashboard",
                    "students",
                    "reports"
                ]
            },

            exam: {
                home: "grades",
                modules: [
                    "dashboard",
                    "grades",
                    "reports"
                ]
            }

        };

        static async getRole() {

            return await RoleService.getName();

        }

        static async getConfiguration() {

            const role = await this.getRole();

            return this.config[role] || this.config.student;

        }

        static async getModules() {

            const config = await this.getConfiguration();

            return config.modules;

        }

        static async getHomeRoute() {

            const config = await this.getConfiguration();

            return config.home;

        }

        static async canOpen(route) {

            const modules = await this.getModules();

            return modules.includes(route);

        }

        static async filterSidebar() {

            const allowed =
                await this.getModules();

            document
                .querySelectorAll("[data-route]")
                .forEach(item => {

                    const route =
                        item.dataset.route;

                    item.style.display =
                        allowed.includes(route)
                            ? ""
                            : "none";

                });

        }

        static async protect(route) {

            const ok =
                await this.canOpen(route);

            if (!ok) {

                UI.toast("Access denied.");

                throw new Error(
                    "Route not allowed."
                );

            }

        }

    }

    window.DashboardService =
        DashboardService;

})();