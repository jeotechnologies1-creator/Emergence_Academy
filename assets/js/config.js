/* ==========================================================
   EMERGENCE ACADEMY
   GLOBAL CONFIGURATION
========================================================== */

const DEFAULT_CONFIG = {
   APP_NAME: "Emergence Academy",
   VERSION: "2.0.0",
   ENVIRONMENT: "production",
   DEBUG: false,
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
      departments: "departments",
      academic_sessions: "academic_sessions",
      terms: "terms",
      classes: "classes",
      subjects: "subjects",
      attendance: "attendance",
      assignments: "assignments",
      live_classes: "live_classes",
      grades: "grades",
      report_cards: "report_cards",
      fee_categories: "fee_categories",
      payments: "payments",
      invoices: "invoices",
      announcements: "announcements",
      notifications: "notifications",
      conversations: "conversations",
      messages: "messages",
      exams: "exams",
      exam_results: "exam_results",
      timetable: "timetable",
      library_books: "library_books",
      library_loans: "library_loans",
      transport_routes: "transport_routes",
      student_transport: "student_transport",
      hostel_blocks: "hostel_blocks",
      hostel_rooms: "hostel_rooms",
      hostel_allocations: "hostel_allocations",
      ai_sessions: "ai_sessions",
      documents: "documents",
      school_settings: "school_settings",
      roles: "roles",
      permissions: "permissions",
      role_permissions: "role_permissions",
      teacher_subjects: "teacher_subjects",
      student_enrollments: "student_enrollments",
      activity_logs: "activity_logs",
      audit_logs: "audit_logs"
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

function deepMerge(base, override) {
   const output = { ...base };
   Object.keys(override || {}).forEach((key) => {
      const baseValue = output[key];
      const overrideValue = override[key];
      if (
         baseValue &&
         overrideValue &&
         typeof baseValue === "object" &&
         typeof overrideValue === "object" &&
         !Array.isArray(baseValue) &&
         !Array.isArray(overrideValue)
      ) {
         output[key] = deepMerge(baseValue, overrideValue);
         return;
      }
      output[key] = overrideValue;
   });
   return output;
}

const runtimeOverride = window.__EMERGENCE_CONFIG__ || {};
const CONFIG = deepMerge(DEFAULT_CONFIG, runtimeOverride);

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
         const preferred = window.APP_CONFIG.logo;
         const fallback = "assets/images/logo.png";
         logo.src = preferred;
         logo.alt = `${window.APP_CONFIG.schoolName} Logo`;
         logo.onerror = () => {
            if (logo.src.endsWith("logo.png")) {
               console.error("Failed to load logo:", logo.src);
               return;
            }
            logo.src = fallback;
         };
      });
   }
   if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setLogo);
   } else {
      setLogo();
   }
})();
