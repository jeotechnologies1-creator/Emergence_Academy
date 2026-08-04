/* ==========================================================
   EMERGENCE ACADEMY
   GLOBAL CONFIGURATION
========================================================== */

const CONFIG = {

    /* ===========================================
       APPLICATION
    =========================================== */

    APP_NAME: "Emergence Academy",

    VERSION: "2.0.0",

    ENVIRONMENT: "production",

    DEBUG: true,

    DEFAULT_ROLE: "student",

    SESSION_KEY: "emergence-session",

    /* ===========================================
       SUPABASE
       Replace these with YOUR own credentials
    =========================================== */

    SUPABASE: {

        URL: "https://yzvtwoqeosnsmnfpbisc.supabase.co",

        ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I"

    },

    /* ===========================================
       DASHBOARD ROUTES
    =========================================== */

    DASHBOARDS: {

        ceo: "ceo.html",

        executive: "executive.html",

        admin: "admin.html",

        teacher: "teacher.html",

        student: "student.html",

        parent: "parent.html"

    },

    /* ===========================================
       DATABASE TABLES
    =========================================== */

    TABLES: {

        profiles: "profiles",

        students: "students",

        teachers: "teachers",

        parents: "parents",

        classes: "classes",

        subjects: "subjects",

        attendance: "attendance",

        assignments: "assignments",

        grades: "grades",

        payments: "payments",

        announcements: "announcements",

        notifications: "notifications",

        roles: "roles"

    },

    /* ===========================================
       STORAGE BUCKETS
    =========================================== */

    STORAGE: {

        PROFILE_IMAGES: "profile-images",

        ASSIGNMENTS: "assignments",

        DOCUMENTS: "documents"

    },

    /* ===========================================
       APPLICATION SETTINGS
    =========================================== */

    SETTINGS: {

        ITEMS_PER_PAGE: 10,

        AUTO_LOGOUT_MINUTES: 60,

        DATE_FORMAT: "DD/MM/YYYY",

        TIME_FORMAT: "HH:mm"

    },

    /* ===========================================
       STATUS VALUES
    =========================================== */

    STATUS: {

        ACTIVE: "active",

        INACTIVE: "inactive",

        PENDING: "pending",

        SUSPENDED: "suspended"

    }

};

/* ===========================================
   Prevent accidental modification
=========================================== */

Object.freeze(CONFIG);

/* ===========================================
   Make globally accessible
=========================================== */

window.APP_CONFIG = {

    schoolName: "Emergence Academy",

    motto: "AI Learning Management System",

    logo: "assets/images/logo.jpeg",

    favicon: "assets/images/favicon.png"

};

window.CONFIG = CONFIG;

/* ===========================================
   AUTO LOAD SCHOOL LOGO
=========================================== */

// document.addEventListener("DOMContentLoaded", () => {

//     const logo = document.getElementById("school-logo");

//     if (!logo) return;

//     logo.src = window.APP_CONFIG.logo;

//     logo.onload = () => {
//         console.log("✅ School logo loaded.");
//     };

//     logo.onerror = () => {
//         console.error("❌ Unable to load:", logo.src);
//     };

// });

/* ===========================================
   AUTO LOAD SCHOOL LOGO
=========================================== */

(function loadSchoolLogo() {

    function setLogo() {

        const logos = document.querySelectorAll("#school-logo");

        if (!logos.length) return;

        logos.forEach(logo => {

            logo.src = window.APP_CONFIG.logo;

            logo.alt = window.APP_CONFIG.schoolName + " Logo";

            logo.onerror = () => {

                console.error("Failed to load logo:", logo.src);

            };

        });

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", setLogo);

    } else {

        setLogo();

    }

})();