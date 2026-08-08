/* ==========================================================
   EMERGENCE ACADEMY
   PERMISSION CONSTANTS
========================================================== */

(function () {

    "use strict";

    const PERMISSIONS = Object.freeze({

        USERS_VIEW: "users.view",
        USERS_CREATE: "users.create",
        USERS_EDIT: "users.edit",
        USERS_DELETE: "users.delete",

        STUDENTS_VIEW: "students.view",
        STUDENTS_CREATE: "students.create",
        STUDENTS_EDIT: "students.edit",
        STUDENTS_DELETE: "students.delete",

        TEACHERS_VIEW: "teachers.view",
        TEACHERS_CREATE: "teachers.create",
        TEACHERS_EDIT: "teachers.edit",
        TEACHERS_DELETE: "teachers.delete",

        PARENTS_VIEW: "parents.view",
        PARENTS_CREATE: "parents.create",
        PARENTS_EDIT: "parents.edit",
        PARENTS_DELETE: "parents.delete",

        ATTENDANCE_VIEW: "attendance.view",
        ATTENDANCE_CREATE: "attendance.create",
        ATTENDANCE_EDIT: "attendance.edit",

        ASSIGNMENTS_VIEW: "assignments.view",
        ASSIGNMENTS_CREATE: "assignments.create",
        ASSIGNMENTS_EDIT: "assignments.edit",

        GRADES_VIEW: "grades.view",
        GRADES_CREATE: "grades.create",
        GRADES_EDIT: "grades.edit",

        FINANCE_VIEW: "finance.view",
        FINANCE_CREATE: "finance.create",
        FINANCE_EDIT: "finance.edit",

        REPORTS_VIEW: "reports.view",

        NOTIFICATIONS_VIEW: "notifications.view",
        NOTIFICATIONS_CREATE: "notifications.create",

        AI_VIEW: "ai.view"

    });

    window.PERMISSIONS = PERMISSIONS;

})();