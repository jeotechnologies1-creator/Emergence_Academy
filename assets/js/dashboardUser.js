/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD USER HELPERS
========================================================== */

async function displayUser() {
    try {
        const profile = await Profile.load();
        if (!profile) return;

        const fullName = `${profile.first_name || profile.name || profile.email || "User"}`.trim();
        const email = profile.email || "";

        document.querySelectorAll(".user-name").forEach((el) => {
            el.textContent = fullName;
        });

        document.querySelectorAll(".user-role").forEach((el) => {
            el.textContent = profile.role || "-";
        });

        document.querySelectorAll(".user-email").forEach((el) => {
            el.textContent = email;
        });
    } catch (error) {
        console.error("displayUser failed:", error);
    }
}

document.addEventListener("DOMContentLoaded", displayUser);
