/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD SERVICE
   Version: 2.0
========================================================== */

(function () {

    "use strict";

    class DashboardService {

        static ROUTE_PERMISSIONS = Object.freeze({
            dashboard: null,
            profiles: "users.view",
            subjects: null,
            students: "students.view",
            teachers: "teachers.view",
            parents: "parents.view",
            attendance: "attendance.view",
            assignments: "assignments.view",
            "live-classes": "assignments.view",
            grades: "grades.view",
            finance: "finance.view",
            reports: "reports.view",
            notifications: "notifications.view",
            ai: "ai.view"
        });

        static async getRole() {

            if (window.RoleRouter) {

                return RoleRouter.getCurrentRole();

            }

            if (window.RoleService) {

                return await RoleService.getName();

            }

            if (window.Auth) {

                return await Auth.role();

            }

            return null;

        }

        static async getConfiguration() {

            if (
                window.RoleRouter &&
                typeof RoleRouter.getCurrentConfig === "function"
            ) {

                return RoleRouter.getCurrentConfig();

            }

            return {

                title: "Dashboard",

                subtitle: "",

                defaultRoute: "dashboard",

                modules: ["dashboard"]

            };

        }

        static async getModules() {

            const config =
                await this.getConfiguration();

            const configured = Array.isArray(config.modules)
                ? config.modules
                : ["dashboard"];

            if (!window.PermissionService) return configured;

            const permissions = await PermissionService.list();
            return configured.filter((route) => {
                const required = this.ROUTE_PERMISSIONS[route];
                return !required || permissions.includes(required);
            });

        }

        static async getHomeRoute() {

            const config =
                await this.getConfiguration();

            return (
                config.defaultRoute ||
                "dashboard"
            );

        }

        static async canOpen(route) {

            const modules =
                await this.getModules();

            return modules.includes(route);

        }

        static async filterSidebar() {

            const allowed =
                await this.getModules();

            document
                .querySelectorAll("[data-route]")
                .forEach((item) => {

                    const route =
                        item.getAttribute(
                            "data-route"
                        );

                    const visible =
                        allowed.includes(route);

                    if (visible) {

                        item.classList.remove(
                            "hidden"
                        );

                        item.removeAttribute(
                            "aria-hidden"
                        );

                        item.removeAttribute(
                            "disabled"
                        );

                    } else {

                        item.classList.add(
                            "hidden"
                        );

                        item.setAttribute(
                            "aria-hidden",
                            "true"
                        );

                        item.setAttribute(
                            "disabled",
                            "disabled"
                        );

                        item.classList.remove(
                            "active"
                        );

                    }

                });

            await this.updateStudentBadge();

        }

        static async updateStudentBadge() {

            const badge = document.getElementById("students-nav-badge");
            if (!badge) return;

            const role = String(await this.getRole() || "").toLowerCase();
            if (!["admin", "ceo", "executive", "admission"].includes(role)) {
                badge.classList.add("hidden");
                return;
            }

            const total = await API.dashboard.enrolledStudentCount();
            badge.textContent = String(total);
            badge.classList.remove("hidden");

        }

        static async protect(route) {

            const allowed =
                await this.canOpen(route);

            if (allowed) {
                return true;
            }

            if (window.Utils?.toast) {

                Utils.toast(
                    "You do not have permission to access this module.",
                    "error"
                );

            } else {

                window.alert(
                    "You do not have permission to access this module."
                );

            }

            throw new Error(
                `Route "${route}" is not allowed for this role.`
            );

        }

    }

    window.DashboardService =
        DashboardService;

})();
