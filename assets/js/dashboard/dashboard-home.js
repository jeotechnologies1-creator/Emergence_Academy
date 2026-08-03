/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD HOME
   Version 2.0
========================================================== */

class DashboardHome {

    /* ======================================================
       RENDER
    ====================================================== */

    static async render(container) {

        container.innerHTML = this.loading();

        try {

            const [

                profile,

                stats,

                announcements

            ] = await Promise.all([

                Auth.profile(),

                API.dashboard.stats(),

                API.announcements.getLatest()

            ]);

            container.innerHTML = this.template(

                profile,

                stats,

                announcements

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

    static template(profile, stats, announcements) {

        return `

<div class="space-y-8">

    <div class="bg-white rounded-xl shadow p-6">

        <h2 class="text-3xl font-bold">

            Welcome, ${profile?.first_name ?? "User"}

        </h2>

        <p class="text-gray-500">

            ${(profile?.role || "").toUpperCase()}

        </p>

    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        ${this.card("Students", stats.students, "👨‍🎓")}

        ${this.card("Teachers", stats.teachers, "👩‍🏫")}

        ${this.card("Classes", stats.classes, "🏫")}

        ${this.card("Subjects", stats.subjects, "📚")}

    </div>

    <div class="bg-white rounded-xl shadow p-6">

        <h3 class="text-xl font-bold mb-5">

            Latest Announcements

        </h3>

        ${this.announcements(announcements)}

    </div>

</div>

`;

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

        console.log("Dashboard Home Loaded");

    }

}

window.DashboardHome = DashboardHome;