document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const roleInput = document.getElementById("loginRole");
    const errorBox = document.getElementById("loginError");
    const statusBox = document.getElementById("loginStatus");
    const togglePassword = document.getElementById("togglePassword");

    // Display Supabase status
    if (statusBox) {
        statusBox.textContent =
            window.supabaseInitMessage || "Ready";
    }

    // Show / Hide Password
    if (togglePassword) {
        togglePassword.addEventListener("click", () => {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                togglePassword.textContent = "Hide";
            } else {
                passwordInput.type = "password";
                togglePassword.textContent = "Show";
            }
        });
    }

    // Bootstrap default admin if supported
    if (
        typeof Auth !== "undefined" &&
        typeof Auth.bootstrapAdmin === "function"
    ) {
        try {
            await Auth.bootstrapAdmin();
        } catch (err) {
            console.error("Bootstrap Admin Error:", err);
        }
    }

    // Login
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        errorBox.classList.add("hidden");

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const role = roleInput.value;

        try {

            if (
                typeof Auth === "undefined" ||
                typeof Auth.login !== "function"
            ) {
                throw new Error(
                    "Auth.login() is not available."
                );
            }

            const result = await Auth.login(
                email,
                password,
                role
            );

            if (!result.success) {
                errorBox.textContent =
                    result.message || "Login failed.";
                errorBox.classList.remove("hidden");
                return;
            }

            let dashboard = "dashboard.html";

            if (
                typeof Auth.getDashboard === "function"
            ) {
                dashboard = await Auth.getDashboard();
            }

            window.location.href = dashboard;

        } catch (err) {
            console.error(err);

            errorBox.textContent =
                err.message || "Unexpected error occurred.";

            errorBox.classList.remove("hidden");
        }
    });
});