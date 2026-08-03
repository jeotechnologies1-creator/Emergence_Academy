/* ==========================================================
   EMERGENCE ACADEMY
   APPLICATION CONTROLLER
   Version 2.0
========================================================== */

class App {

    static initialized = false;

    static user = null;

    static profile = null;

    /* ======================================================
       INITIALIZE APPLICATION
    ====================================================== */

    static async init() {

        if (this.initialized) {
            return true;
        }

        console.log("🚀 Starting Emergence Academy...");

        if (window.location.pathname.includes("login.html") || window.location.pathname.includes("register.html")) {
            return false;
        }

        try {

            if (!window.Auth) {
                throw new Error("Auth module not loaded.");
            }

            if (!window.API) {
                throw new Error("API module not loaded.");
            }

            if (!window.Utils) {
                throw new Error("Utilities module not loaded.");
            }

            const loggedIn = await Auth.requireLogin();

            if (!loggedIn) {
                return false;
            }

            this.user = await Auth.currentUser();

            if (!this.user) {
                throw new Error("Unable to retrieve authenticated user.");
            }

            this.profile = await Auth.profile();

            if (!this.profile) {
                throw new Error("User profile not found.");
            }

            this.loadUser();

            this.initializeNavigation();

            this.initializeLogout();

            await this.loadStatistics();

            this.initialized = true;

            console.log("✅ Application initialized successfully.");

            return true;

        } catch (error) {

            console.error("Application Error:", error);

            this.showError(error.message);

            return false;

        }

    }

    /* ======================================================
       LOAD USER INFORMATION
    ====================================================== */

    static loadUser() {

        const fullName = `${this.profile.first_name || ""} ${this.profile.last_name || ""}`.trim();

        document.querySelectorAll(".user-name").forEach(el => {
            el.textContent = fullName || "User";
        });

        document.querySelectorAll(".user-role").forEach(el => {
            el.textContent = this.profile.role || "-";
        });

        document.querySelectorAll(".user-email").forEach(el => {
            el.textContent = this.user.email || "-";
        });

    }

    /* ======================================================
       NAVIGATION
    ====================================================== */

    static initializeNavigation() {

        document.querySelectorAll("[data-page]").forEach(link => {

            link.addEventListener("click", () => {

                document.querySelectorAll("[data-page]").forEach(item => {

                    item.classList.remove("active");

                });

                link.classList.add("active");

            });

        });

    }

    /* ======================================================
       LOGOUT
    ====================================================== */

    static initializeLogout() {

        document.querySelectorAll(".logout-btn").forEach(button => {

            button.addEventListener("click", async () => {

                const confirmed = Utils.confirm(
                    "Are you sure you want to logout?"
                );

                if (!confirmed) return;

                await Auth.logout();

            });

        });

    }

    /* ======================================================
       LOAD DASHBOARD STATISTICS
    ====================================================== */

    static async loadStatistics() {

        if (!window.API?.dashboard?.stats) {

            return;

        }

        try {

            const stats = await API.dashboard.stats();

            this.setValue("studentsCount", stats.students);

            this.setValue("teachersCount", stats.teachers);

            this.setValue("classesCount", stats.classes);

            this.setValue("subjectsCount", stats.subjects);

        }

        catch (error) {

            console.error("Statistics Error:", error);

        }

    }

    /* ======================================================
       UPDATE TEXT
    ====================================================== */

    static setValue(id, value = 0) {

        const element = document.getElementById(id);

        if (element) {

            element.textContent = value;

        }

    }

    /* ======================================================
       ERROR DISPLAY
    ====================================================== */

    static showError(message) {

        console.error(message);

        if (window.Utils?.error) {

            Utils.error(message);

            return;

        }

        const errorBox = document.getElementById("error-message");

        if (errorBox) {

            errorBox.textContent = message;

            errorBox.classList.remove("hidden");

        }

    }

    /* ======================================================
       GETTERS
    ====================================================== */

    static getUser() {

        return this.user;

    }

    static getProfile() {

        return this.profile;

    }

    static getRole() {

        return this.profile?.role || null;

    }

    static isInitialized() {

        return this.initialized;

    }

}

/* ==========================================================
   EXPORT
========================================================== */

window.App = App;