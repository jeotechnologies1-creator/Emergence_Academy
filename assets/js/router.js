/* ==========================================================
   EMERGENCE ACADEMY
   ROUTER
========================================================== */

class Router {

    static routes = {};

    static currentRoute = null;

    static register(name, callback) {

        if (typeof callback !== "function") {

            console.error(`Route "${name}" must be a function.`);

            return;

        }

        this.routes[name] = callback;

    }

    static async navigate(name) {

        if (
            name !== "dashboard" &&
            window.RoleRouter &&
            typeof window.RoleRouter.isAllowedRoute === "function" &&
            !window.RoleRouter.isAllowedRoute(name)
        ) {
            const fallback = window.RoleRouter.getDefaultRoute?.() || "dashboard";

            if (name !== fallback) {
                return this.navigate(fallback);
            }

            return;
        }

        const route = this.routes[name] || this.routes["*"];

        if (!route) {

            console.error(`Route "${name}" not found.`);

            return;

        }

        let container = document.getElementById("dashboard-content");

        if (!container) {

            container = document.getElementById("app");

        }

        if (!container) {

            console.error("No render container found.");

            return;

        }

        this.currentRoute = name;

        try {

            if (window.Utils?.showLoader) {

                Utils.showLoader("Loading...");

            }

            container.innerHTML = "";

            if (typeof route !== "function") {

                throw new Error(`Route "${name}" is not available.`);

            }

            await route(container);

        }

        catch (error) {

            console.error(error);

            container.innerHTML = `

                <div class="p-6">

                    <h2 class="text-red-600 text-xl font-bold">

                        Something went wrong

                    </h2>

                    <p class="mt-2 text-gray-600">

                        ${error.message}

                    </p>

                </div>

            `;

        }

        finally {

            if (window.Utils?.hideLoader) {

                Utils.hideLoader();

            }

        }

    }

    static getCurrentRoute() {

        return this.currentRoute;

    }

}
Router.register("*", container => {

container.innerHTML = `

<div class="flex flex-col items-center justify-center py-20">

<h2 class="text-3xl font-bold">

Module Not Found

</h2>

<p class="text-slate-500 mt-2">

The requested page does not exist.

</p>

</div>

`;

});

window.Router = Router;