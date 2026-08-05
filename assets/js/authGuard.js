/* ==========================================================
   EMERGENCE ACADEMY
   AUTHENTICATION GUARD
========================================================== */

async function requireAuth() {
    try {
        const session = await Auth.getSession();
        if (!session) {
            window.location.href = "login.html";
            return false;
        }
        return true;
    } catch (error) {
        console.error(error);
        window.location.href = "login.html";
        return false;
    }
}

async function redirectIfLoggedIn() {
    try {
        const session = await Auth.getSession();
        if (session) {
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error(error);
    }
}

window.requireAuth = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
