/* ==========================================================
   EMERGENCE ACADEMY
   GLOBAL CONFIGURATION
========================================================== */

const CONFIG = {
    APP_NAME: "Emergence Academy",
    VERSION: "2.0.0",
    ENVIRONMENT: "production",
    DEBUG: true,
    DEFAULT_ROLE: "student",
    SESSION_KEY: "emergence_session",
    DASHBOARDS: {
        ceo: "dashboard.html",
        admin: "dashboard.html",
        executive: "dashboard.html",
        teacher: "dashboard.html",
        student: "dashboard.html",
        parent: "dashboard.html",
        finance: "dashboard.html",
        hr: "dashboard.html",
        admission: "dashboard.html",
        exam: "dashboard.html",
        library: "dashboard.html"
    },
    SUPABASE: {
        URL: "https://yzvtwoqeosnsmnfpbisc.supabase.co",
        ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I"
    },
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
        roles: "roles",
        audit_logs: "activity_logs"
    },
    STORAGE: {
        PROFILE_IMAGES: "profile-images",
        ASSIGNMENTS: "assignments",
        DOCUMENTS: "documents",
        GALLERY: "gallery",
        CERTIFICATES: "certificates"
    },
    SETTINGS: {
        ITEMS_PER_PAGE: 10,
        AUTO_LOGOUT_MINUTES: 60,
        DATE_FORMAT: "DD/MM/YYYY",
        TIME_FORMAT: "HH:mm"
    },
    STATUS: {
        ACTIVE: "active",
        INACTIVE: "inactive",
        PENDING: "pending",
        SUSPENDED: "suspended"
    },
    APP_DETAILS: {
        SCHOOL_NAME: "Emergence Academy",
        MOTTO: "AI Learning Management System",
        LOGO: "assets/images/logo.png",
        FAVICON: "assets/images/favicon.png",
        CONTACT_EMAIL: "support@emergence.edu",
        CONTACT_PHONE: "+234-000-000-0000",
        ADDRESS: "123 Academy Drive, Lagos, Nigeria"
    }
};

Object.freeze(CONFIG);

window.CONFIG = CONFIG;
window.APP_CONFIG = {
    schoolName: CONFIG.APP_DETAILS.SCHOOL_NAME,
    motto: CONFIG.APP_DETAILS.MOTTO,
    logo: CONFIG.APP_DETAILS.LOGO,
    favicon: CONFIG.APP_DETAILS.FAVICON,
    contactEmail: CONFIG.APP_DETAILS.CONTACT_EMAIL,
    contactPhone: CONFIG.APP_DETAILS.CONTACT_PHONE,
    address: CONFIG.APP_DETAILS.ADDRESS
};

(function loadSchoolLogo() {
    function setLogo() {
        const logos = document.querySelectorAll("#school-logo");
        if (!logos.length) return;
        logos.forEach(logo => {
            logo.src = window.APP_CONFIG.logo;
            logo.alt = `${window.APP_CONFIG.schoolName} Logo`;
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
