/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD CONTROLLER
========================================================== */

class Dashboard {

    static initialized = false;

    static async init() {

        if (this.initialized) return;

        try {

            if (!window.Router) {

                throw new Error("Router not loaded.");

            }

            this.registerModules();

            this.registerNavigation();

            await Router.navigate("dashboard");

            this.initialized = true;

            console.log("Dashboard Initialized");

        }

        catch (error) {

            console.error(error);

        }

    }

    /* ======================================================
       MODULES
    ====================================================== */

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

        Object.entries(modules).forEach(

            ([name, module]) => {

                if (

                    module &&

                    typeof module.render === "function"

                ) {

                    Router.register(

                        name,

                        (container) => module.render(container)

                    );

                }

                else {

                    console.warn(

                        `Module "${name}" is missing.`

                    );

                }

            }

        );

    }

    /* ======================================================
       NAVIGATION
    ====================================================== */

    static registerNavigation() {

        document

            .querySelectorAll("[data-route]")

            .forEach(item => {

                item.addEventListener(

                    "click",

                    async () => {

                        await Router.navigate(

                            item.dataset.route

                        );

                    }

                );

            });

    }

}

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        await Dashboard.init();

    }

);

window.Dashboard = Dashboard;