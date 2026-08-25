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

/**
 * The Edge Function is the primary account-creation path. This idempotent
 * client-side confirmation protects the admin workflow if an older deployed
 * function version creates the teacher record but has not yet persisted its
 * class/subject rows.
 */
async function saveTeacherProfileAssignments(teacherId, departmentId, classIds, subjectIds) {
    const normalizedClassIds = [...new Set((classIds || []).map(String).filter(Boolean))];
    const normalizedSubjectIds = [...new Set((subjectIds || []).map(String).filter(Boolean))];

    if (!teacherId || !normalizedClassIds.length || !normalizedSubjectIds.length) {
        throw new Error("The teacher record and at least one class and subject are required.");
    }

    const { data: savedCount, error } = await API.db.rpc(
        "save_teacher_profile_assignments",
        {
            p_teacher_id: teacherId,
            p_department_id: departmentId || null,
            p_class_ids: normalizedClassIds,
            p_subject_ids: normalizedSubjectIds
        }
    );

    const expectedCount = normalizedClassIds.length * normalizedSubjectIds.length;
    if (error) throw error;
    if (Number(savedCount) !== expectedCount) {
        throw new Error("The selected teaching assignments could not be verified. Please try again.");
    }
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
                    key: "assigned_student_count",
                    label: "Students in Assigned Classes"
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
                {
                    key: "department_id",
                    label: "Department",
                    type: "select",
                    emptyOptionLabel: "No department"
                },
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
                {
                    key: "department_id",
                    label: "Department",
                    type: "select",
                    emptyOptionLabel: "No department"
                },
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
                const [assignmentsResult, studentsResult] = await Promise.all([
                    API.db
                        .from("teacher_subjects")
                        .select("teacher_id,class_id,subject_id"),
                    API.db
                        .from("students")
                        .select("id,class_id")
                ]);

                if (assignmentsResult.error || studentsResult.error) {
                    throw assignmentsResult.error || studentsResult.error;
                }

                const assignmentsByTeacher = new Map();
                (assignmentsResult.data || []).forEach((assignment) => {
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
                    const assignedClassIds = assignments ? assignments.classIds : new Set();
                    const assignedStudentCount = (studentsResult.data || []).filter((student) =>
                        assignedClassIds.has(String(student.class_id))
                    ).length;
                    return {
                        ...teacher,
                        class_ids: [...assignedClassIds],
                        subject_ids: assignments ? [...assignments.subjectIds] : [],
                        assigned_student_count: assignedStudentCount
                    };
                });
            },

            updateRecord: async function updateTeacherRecord(payload, teacherId) {
                const classIds = [...new Set((payload.class_ids || []).map(String).filter(Boolean))];
                const subjectIds = [...new Set((payload.subject_ids || []).map(String).filter(Boolean))];
                const {
                    class_ids: ignoredClassIds,
                    subject_ids: ignoredSubjectIds,
                    department_id: departmentId,
                    ...teacherUpdates
                } = payload;
                if (!classIds.length || !subjectIds.length) {
                    return API.response(false, null, "Assign at least one class and one subject to the teacher.");
                }

                try {
                    const teacherResult = await API.teachers.update(teacherId, teacherUpdates);
                    if (!teacherResult?.success) return teacherResult;

                    await saveTeacherProfileAssignments(
                        teacherId,
                        departmentId,
                        classIds,
                        subjectIds
                    );
                    return API.response(true, teacherResult.data, "Teacher assignments updated successfully.");
                } catch (error) {
                    return API.response(false, null, error.message || "Unable to save teacher assignments.");
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

                        const teacherId = String(result.data?.id || "").trim();

                        if (!teacherId) {
                            throw new Error("Teacher account was created but its teacher record could not be confirmed.");
                        }

                        // Keep the selected department and assignments in the
                        // same source-of-truth tables used by the admin table
                        // and teacher portal. `upsert` makes this safe when
                        // the current Edge Function has already saved them.
                        await saveTeacherProfileAssignments(
                            teacherId,
                            payload.department_id,
                            payload.class_ids,
                            payload.subject_ids
                        );


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
