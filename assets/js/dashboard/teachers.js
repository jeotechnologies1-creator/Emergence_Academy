/* ==========================================================
   EMERGENCE ACADEMY
   TEACHERS MODULE
========================================================== */

const TeachersModule = window.OfficeModuleEngine.create({

    moduleKey: "teachers",

    title: "Teachers",

    tableName: "teachers",

    orderBy: "created_at",

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

    formFields: [
        "full_name",
        "email",
        "phone",
        "password",
        "employee_id",
        "department_name",
        "qualification",
        "status"
    ],

    editFormFields: [
        "employee_id",
        "department_id",
        "qualification",
        "status"
    ],

    requiredFields: [
        "full_name",
        "email",
        "employee_id",
        "department_name",
        "status"
    ],

    editRequiredFields: [
        "employee_id",
        "department_id",
        "status"
    ],

    fieldTypes: {
        email: "email",
        password: "password"
    },

    fieldGenerators: {

        employee_id: () => {
            return `EA-EMP-${new Date().getFullYear()}-${String(
                Math.floor(1000 + Math.random() * 9000)
            )}`;
        },

        password: () => {

            const chars =
                "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";

            let password = "";

            for (let index = 0; index < 12; index++) {

                password += chars.charAt(
                    Math.floor(Math.random() * chars.length)
                );

            }

            return password;
        }

    },

    permissions: {

        create: [
            "ceo",
            "admin",
            "executive",
            "hr"
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

    softDelete: true,

    softDeleteField: "status",

    softDeleteValue: "inactive",

    softRestoreValue: "active",

    fieldOptions: {

        status: [
            "active",
            "inactive",
            "suspended",
            "pending"
        ]

    },

    lookups: {

        department_id: {
            table: "departments",
            labelKey: "name"
        }

    },

    /*
     * Teacher creation must go through the
     * create-user Edge Function.
     */
    createRecord: async (payload) => {

        try {

            if (!window.API?.teachers?.createAccount) {

                throw new Error(
                    "Teacher API is not available."
                );

            }

            const result =
                await API.teachers.createAccount(payload);

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
                    error?.message ||
                    "Unable to create teacher."
            };

        }

    }

});

window.TeachersModule = TeachersModule;