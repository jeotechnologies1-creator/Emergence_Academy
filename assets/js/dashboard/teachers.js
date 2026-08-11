/* ==========================================================
   EMERGENCE ACADEMY
   TEACHERS MODULE
   ========================================================== */

/* global OfficeModuleEngine, API */

/**
 * Generate a secure-looking temporary password.
 *
 * @returns {string}
 */
function generateTeacherPassword() {
    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";

    let password = "";

    for (let index = 0; index < 12; index++) {
        const randomIndex = Math.floor(
            Math.random() * chars.length
        );

        password += chars.charAt(randomIndex);
    }

    return password;
}


/* ==========================================================
   VERIFY MODULE ENGINE
   ========================================================== */

if (
    !window.OfficeModuleEngine ||
    typeof window.OfficeModuleEngine.create !== "function"
) {
    console.error(
        "TeachersModule: OfficeModuleEngine is not loaded."
    );
} else {
    /* ======================================================
       CREATE TEACHERS MODULE
       ====================================================== */

    const TeachersModule =
        window.OfficeModuleEngine.create({

            /* ==================================================
               BASIC MODULE INFORMATION
               ================================================== */

            moduleKey: "teachers",

            title: "Teachers",

            tableName: "teachers",

            orderBy: "created_at",


            /* ==================================================
               TABLE COLUMNS
               ================================================== */

            columns: [
                {
                    key: "profile_id",
                    label: "Name"
                },

                {
                    key: "employee_id",
                    label: "Employee ID"
                },

                {
                    key: "department_id",
                    label: "Department"
                },

                {
                    key: "qualification",
                    label: "Qualification"
                },

                {
                    key: "status",
                    label: "Status"
                },

                {
                    key: "created_at",
                    label: "Created"
                }
            ],


            /* ==================================================
               CREATE FORM FIELDS
               ================================================== */

            formFields: [
                "full_name",
                "email",
                "phone",
                "password",
                "department_name",
                "qualification",
                "status"
            ],


            /* ==================================================
               EDIT FORM FIELDS
               ================================================== */

            editFormFields: [
                "employee_id",
                "department_id",
                "qualification",
                "status"
            ],


            /* ==================================================
               REQUIRED CREATE FIELDS
               ================================================== */

            requiredFields: [
                "full_name",
                "email",
                "status"
            ],


            /* ==================================================
               REQUIRED EDIT FIELDS
               ================================================== */

            editRequiredFields: [
                "employee_id",
                "department_id",
                "status"
            ],


            /* ==================================================
               FIELD TYPES
               ================================================== */

            fieldTypes: {
                email: "email",
                password: "password"
            },


            /* ==================================================
               FIELD GENERATORS
               ================================================== */

            fieldGenerators: {
                password:
                    generateTeacherPassword,

                status: () => "active"
            },

            fieldGeneratorLabels: {
                password: "Generate Password"
            },


            /* ==================================================
               PERMISSIONS
               ================================================== */

            permissions: {
                create: [
                    "ceo",
                    "admin"
                ],

                edit: [
                    "ceo",
                    "admin",
                    "executive",
                    "hr"
                ],

                delete: [
                    "ceo",
                    "admin",
                    "executive"
                ]
            },


            /* ==================================================
               SOFT DELETE
               ================================================== */

            softDelete: true,

            softDeleteField: "status",

            softDeleteValue: "inactive",

            softRestoreValue: "active",


            /* ==================================================
               STATUS OPTIONS
               ================================================== */

            fieldOptions: {
                status: [
                    "active",
                    "inactive",
                    "suspended",
                    "pending"
                ]
            },


            /* ==================================================
               DEPARTMENT LOOKUP
               ================================================== */

            lookups: {
                department_id: {
                    table: "departments",
                    labelKey: "name"
                }
            },


            /* ==================================================
               CREATE TEACHER ACCOUNT

               Teacher creation MUST go through:

               API.teachers.createAccount()

               which calls the Supabase
               create-user Edge Function.
               ================================================== */

            createRecord:
                async function createTeacherRecord(
                    payload
                ) {
                    try {
                        /* ======================================
                           VALIDATE PAYLOAD
                           ====================================== */

                        if (
                            !payload ||
                            typeof payload !== "object"
                        ) {
                            throw new Error(
                                "Teacher data is missing."
                            );
                        }


                        /* ======================================
                           COPY PAYLOAD

                           Avoid modifying the original
                           object supplied by OfficeModuleEngine.
                           ====================================== */

                        payload = {
                            ...payload
                        };

                        /* ======================================
                           NORMALIZE NAME FOR THE ACCOUNT API

                           The teacher form uses one Full Name
                           field, whereas the account Edge Function
                           stores a first and last name separately.
                           ====================================== */

                        const fullName = String(
                            payload.full_name || ""
                        ).trim();

                        const nameParts = fullName
                            .split(/\s+/)
                            .filter(Boolean);

                        if (!payload.first_name) {
                            payload.first_name =
                                nameParts.shift() || "";
                        }

                        if (!payload.last_name) {
                            payload.last_name =
                                nameParts.join(" ");
                        }

                        if (
                            !String(payload.first_name).trim() ||
                            !String(payload.last_name).trim()
                        ) {
                            throw new Error(
                                "Enter the teacher's first and last name."
                            );
                        }


                        /* ======================================
                           VERIFY API
                           ====================================== */

                        if (
                            !window.API ||
                            !window.API.teachers ||
                            typeof
                                window.API.teachers.createAccount !==
                                "function"
                        ) {
                            throw new Error(
                                "Teacher API is not available. Make sure the API module is loaded before TeachersModule."
                            );
                        }


                        /* ======================================
                           CREATE TEACHER ACCOUNT
                           ====================================== */

                        const result =
                            await window.API.teachers.createAccount(payload);


                        /* ======================================
                           VERIFY API RESULT
                           ====================================== */

                        if (!result) {
                            throw new Error(
                                "Teacher API returned an empty response."
                            );
                        }


                        if (
                            result.success === false
                        ) {
                            throw new Error(
                                result.message ||
                                result.error ||
                                "Unable to create teacher."
                            );
                        }


                        /* ======================================
                           SUCCESS
                           ====================================== */

                        console.log(
                            "Teacher created successfully:",
                            result
                        );


                        return result;

                    } catch (error) {
                        console.error(
                            "Teacher creation failed:",
                            error
                        );


                        return {
                            success: false,

                            data: null,

                            message:
                                error &&
                                error.message
                                    ? error.message
                                    : "Unable to create teacher."
                        };
                    }
                }
        });


    /* ======================================================
       GLOBAL MODULE REFERENCE
       ====================================================== */

    window.TeachersModule =
        TeachersModule;


    /* ======================================================
       CONFIRM MODULE LOADED
       ====================================================== */

    console.log(
        "TeachersModule loaded successfully."
    );
}
