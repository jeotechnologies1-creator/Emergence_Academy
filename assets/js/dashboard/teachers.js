/* ==========================================================
   EMERGENCE ACADEMY
   TEACHERS MODULE
   ========================================================== */

/* global OfficeModuleEngine, API */

function generatedEmployeeId() {
    const year = new Date().getFullYear();
    const token = typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
        : `${Date.now()}${Math.floor(Math.random() * 100000)}`.slice(-10);

    return `EA-EMP-${year}-${token}`;
}

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
                    key: "class_ids",
                    label: "Assigned Classes"
                },

                {
                    key: "subject_ids",
                    label: "Assigned Subjects"
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
                "specialization",
                "employment_date",
                {
                    key: "class_ids",
                    label: "Assigned Classes",
                    type: "multi-select",
                    fullWidth: true
                },
                {
                    key: "subject_ids",
                    label: "Assigned Subjects",
                    type: "multi-select",
                    fullWidth: true
                },
                "status"
            ],


            /* ==================================================
               EDIT FORM FIELDS
               ================================================== */

            editFormFields: [
                "employee_id",
                "department_id",
                "qualification",
                "specialization",
                "employment_date",
                {
                    key: "class_ids",
                    label: "Assigned Classes",
                    type: "multi-select",
                    fullWidth: true
                },
                {
                    key: "subject_ids",
                    label: "Assigned Subjects",
                    type: "multi-select",
                    fullWidth: true
                },
                "status"
            ],


            /* ==================================================
               REQUIRED CREATE FIELDS
               ================================================== */

            requiredFields: [
                "full_name",
                "email",
                "class_ids",
                "subject_ids",
                "status"
            ],

            multiValueFields: [
                "class_ids",
                "subject_ids"
            ],


            /* ==================================================
               REQUIRED EDIT FIELDS
               ================================================== */

            editRequiredFields: [
                "employee_id",
                "department_id",
                "class_ids",
                "subject_ids",
                "status"
            ],


            /* ==================================================
               FIELD TYPES
               ================================================== */

            fieldTypes: {
                email: "email",
                password: "password",
                employment_date: "date"
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
                    "admin"
                ]
            },


            /* ==================================================
               SOFT DELETE
               ================================================== */

            softDelete: false,

            deleteRecord: async function deleteTeacherAccount(teacher) {
                return window.API.teachers.deleteAccount(teacher);
            },


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
                },
                class_ids: {
                    table: "classes",
                    labelKey: "class_name"
                },
                subject_ids: {
                    table: "subjects",
                    labelKey: "subject_name"
                }
            },

            // Assignments live in teacher_subjects, not teachers. Enrich the
            // admin rows so the table and edit form always reflect the source
            // of truth used by teacher portals.
            transformRows: async function transformTeacherRows(rows) {
                const { data, error } = await API.db
                    .from("teacher_subjects")
                    .select("teacher_id,class_id,subject_id");

                if (error) {
                    throw error;
                }

                const assignmentsByTeacher = new Map();
                (data || []).forEach((assignment) => {
                    const teacherId = String(assignment.teacher_id);
                    const current = assignmentsByTeacher.get(teacherId) || {
                        classIds: new Set(),
                        subjectIds: new Set()
                    };
                    current.classIds.add(String(assignment.class_id));
                    current.subjectIds.add(String(assignment.subject_id));
                    assignmentsByTeacher.set(teacherId, current);
                });

                return (rows || []).map((teacher) => {
                    const assignments = assignmentsByTeacher.get(String(teacher.id));
                    return {
                        ...teacher,
                        class_ids: assignments ? [...assignments.classIds] : [],
                        subject_ids: assignments ? [...assignments.subjectIds] : []
                    };
                });
            },

            updateRecord: async function updateTeacherRecord(payload, teacherId) {
                const classIds = [...new Set((payload.class_ids || []).map(String).filter(Boolean))];
                const subjectIds = [...new Set((payload.subject_ids || []).map(String).filter(Boolean))];
                const { class_ids: ignoredClassIds, subject_ids: ignoredSubjectIds, ...teacherUpdates } = payload;

                if (!classIds.length || !subjectIds.length) {
                    return API.response(false, null, "Assign at least one class and one subject to the teacher.");
                }

                const teacherResult = await API.teachers.update(teacherId, teacherUpdates);
                if (!teacherResult?.success) {
                    return teacherResult;
                }

                const desiredAssignments = classIds.flatMap((classId) =>
                    subjectIds.map((subjectId) => ({
                        teacher_id: teacherId,
                        class_id: classId,
                        subject_id: subjectId
                    }))
                );

                const { data: existingAssignments, error: existingError } = await API.db
                    .from("teacher_subjects")
                    .select("id,class_id,subject_id")
                    .eq("teacher_id", teacherId);

                if (existingError) {
                    return API.response(false, null, existingError.message);
                }

                // Insert the new rows before removing stale rows so a failed
                // save never leaves a teacher without portal access.
                const { error: upsertError } = await API.db
                    .from("teacher_subjects")
                    .upsert(desiredAssignments, { onConflict: "teacher_id,class_id,subject_id" });

                if (upsertError) {
                    return API.response(false, null, upsertError.message);
                }

                const desiredKeys = new Set(desiredAssignments.map((row) => `${row.class_id}:${row.subject_id}`));
                const staleIds = (existingAssignments || [])
                    .filter((row) => !desiredKeys.has(`${row.class_id}:${row.subject_id}`))
                    .map((row) => row.id);

                if (staleIds.length) {
                    const { error: deleteError } = await API.db
                        .from("teacher_subjects")
                        .delete()
                        .in("id", staleIds);
                    if (deleteError) {
                        return API.response(false, null, deleteError.message);
                    }
                }

                return API.response(true, teacherResult.data, "Teacher assignments updated successfully.");
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

                        // The server is the source of truth for issued IDs.
                        // This value keeps teacher creation compatible until an
                        // already-deployed older function has been replaced.
                        payload.employee_id = generatedEmployeeId();


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
