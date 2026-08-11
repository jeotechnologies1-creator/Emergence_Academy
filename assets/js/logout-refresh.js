/* ==========================================================
   EMERGENCE ACADEMY
   LOGOUT REFRESH
========================================================== */

(function registerLogoutRefresh() {
    "use strict";

    const runtime = typeof window !== "undefined" ? window : globalThis;
    let refreshScheduled = false;

    function refreshApplication() {
        if (refreshScheduled) {
            return;
        }

        refreshScheduled = true;

        // Supabase broadcasts SIGNED_OUT to every open tab. Clear page-only
        // state and load a fresh login screen so protected UI cannot remain
        // visible after any user signs out.
        if (runtime.sessionStorage?.clear) {
            runtime.sessionStorage.clear();
        }

        const location = runtime.location;
        if (!location) {
            return;
        }

        const path = String(location.pathname || "").toLowerCase();
        if (path.endsWith("/login.html") || path === "login.html") {
            location.reload?.();
            return;
        }

        location.replace?.("login.html?logout=1");
    }

    function handleAuthEvent(event) {
        if (event?.detail?.event === "SIGNED_OUT") {
            refreshApplication();
        }
    }

    // supabase.js dispatches this event for local and cross-tab auth changes.
    runtime.addEventListener?.("supabase:auth", handleAuthEvent);
})();
