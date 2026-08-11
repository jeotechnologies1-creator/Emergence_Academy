/* ==========================================================
   EMERGENCE ACADEMY
   API LAYER
   Version: 2.0
   Part 1
========================================================== */

class API {

    /* ======================================================
       COMMON DATABASE HELPER
    ====================================================== */

    static get db() {

        if (!window.supabaseClient) {

            throw new Error("Supabase client not initialized.");

        }

        return window.supabaseClient;

    }

    /* ======================================================
       COMMON RESPONSE
    ====================================================== */

    static response(success, data = null, message = "") {

        return {

            success,

            data,

            message

        };

    }

    static async functionErrorMessage(error, fallback = "Edge Function request failed.") {

        let message = error?.message || fallback;
        const response = error?.context;

        try {
            if (response && typeof response.clone === "function") {
                const raw = await response.clone().text();
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        message = parsed?.error || parsed?.message || message;
                    } catch {
                        message = raw;
                    }
                }
            }
        } catch (parseError) {
            console.error("Unable to read Edge Function error response:", parseError);
        }

        return message;

    }

    /* ======================================================
       DASHBOARD
    ====================================================== */

    static dashboard = {

        async countTable(tableName) {

            try {

                const { count, error } = await API.db
                    .from(tableName)
                    .select("*", {
                        head: true,
                        count: "exact"
                    });

                if (error) throw error;

                return count || 0;

            }

            catch (error) {

                return 0;

            }

        },

        async stats() {

            try {

                const [
                    students,
                    teachers,
                    parents,
                    classes,
                    subjects,
                    attendance,
                    assignments,
                    grades,
                    payments,
                    notifications,
                    announcements,
                    activity
                ] = await Promise.all([
                    this.countTable("students"),
                    this.countTable("teachers"),
                    this.countTable("parents"),
                    this.countTable("classes"),
                    this.countTable("subjects"),
                    this.countTable("attendance"),
                    this.countTable("assignments"),
                    this.countTable("grades"),
                    this.countTable("payments"),
                    this.countTable("notifications"),
                    this.countTable("announcements"),
                    this.countTable("activity_logs")
                ]);

                return {

                    students,
                    teachers,
                    parents,
                    classes,
                    subjects,
                    attendance,
                    assignments,
                    grades,
                    payments,
                    notifications,
                    announcements,
                    activity,
                    reports: activity,
                    finance: payments

                };

            }

            catch (error) {

                console.error(

                    "Dashboard Statistics Error:",

                    error

                );

                return {

                    students: 0,

                    teachers: 0,

                    parents: 0,

                    classes: 0,

                    subjects: 0,

                    attendance: 0,

                    assignments: 0,

                    grades: 0,

                    payments: 0,

                    notifications: 0,

                    announcements: 0,

                    activity: 0,

                    reports: 0,

                    finance: 0

                };

            }

        }

        ,

        async recentActivity(limit = 10, options = {}) {

            const {
                role = "",
                userId = ""
            } = options;

            try {

                let query = API.db
                    .from("activity_logs")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(limit);

                const normalizedRole = String(role || "").toLowerCase();
                const normalizedUserId = String(userId || "");

                if (
                    normalizedUserId &&
                    ["teacher", "student", "parent"].includes(normalizedRole)
                ) {
                    query = query.eq("user_id", normalizedUserId);
                }

                const { data, error } = await query;

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error("Recent activity load failed:", error);

                return [];

            }

        }

    };

    /* ======================================================
       GENERIC RECORDS API
    ====================================================== */

    static records = {

        async getAll(tableName, options = {}) {

            const {
                orderBy = "created_at",
                ascending = false,
                select = "*"
            } = options;

            try {

                let query = API.db
                    .from(tableName)
                    .select(select);

                if (orderBy && typeof query.order === "function") {
                    query = query.order(orderBy, { ascending });
                }

                let { data, error } = await query;

                if (error && orderBy) {
                    const retry = await API.db
                        .from(tableName)
                        .select(select);
                    data = retry.data;
                    error = retry.error;
                }

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(`Records getAll failed for ${tableName}:`, error);

                return [];

            }

        },

        async create(tableName, payload) {

            try {

                const { data, error } = await API.db
                    .from(tableName)
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;

                return API.response(true, data, "Record created successfully.");

            }

            catch (error) {

                console.error(`Records create failed for ${tableName}:`, error);

                return API.response(false, null, error.message || "Unable to create record.");

            }

        },

        async update(tableName, id, payload) {

            try {

                const timestampedPayload = {
                    ...payload,
                    updated_at: new Date().toISOString()
                };

                let { data, error } = await API.db
                    .from(tableName)
                    .update(timestampedPayload)
                    .eq("id", id)
                    .select()
                    .single();

                // Some schema tables (for example grades, payments, and
                // notifications) do not expose an updated_at column.
                // Retry with the caller's fields only in that case.
                if (
                    error &&
                    String(error.message || "").toLowerCase()
                        .includes("updated_at")
                ) {
                    ({ data, error } = await API.db
                        .from(tableName)
                        .update(payload)
                        .eq("id", id)
                        .select()
                        .single());
                }

                if (error) throw error;

                return API.response(true, data, "Record updated successfully.");

            }

            catch (error) {

                console.error(`Records update failed for ${tableName}:`, error);

                return API.response(false, null, error.message || "Unable to update record.");

            }

        },

        async remove(tableName, id) {

            try {

                const { error } = await API.db
                    .from(tableName)
                    .delete()
                    .eq("id", id);

                if (error) throw error;

                return API.response(true, null, "Record deleted successfully.");

            }

            catch (error) {

                console.error(`Records delete failed for ${tableName}:`, error);

                return API.response(false, null, error.message || "Unable to delete record.");

            }

        }

    };

    /* ======================================================
       STUDENTS API
    ====================================================== */

    static students = {

        /* ==============================================
           GET ALL STUDENTS
        ============================================== */

        async getAll() {

            try {

                const { data, error }

                    = await API.db

                        .from("students")

                        .select(`

                            *,

                            profiles:profile_id(

                                id,

                                first_name,

                                last_name,

                                email,

                                phone,

                                gender,

                                avatar_url

                            ),

                            classes:class_id(

                                id,

                                class_name,

                                class_code

                            )

                        `)

                        .order(

                            "created_at",

                            {

                                ascending: false

                            }

                        );

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(

                    "Students Error:",

                    error

                );

                return [];

            }

        },

        async getById(id) {

            try {

                const { data, error } = await API.db

                    .from("students")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone,
                            gender,
                            avatar_url
                        ),
                        classes:class_id(
                            id,
                            class_name,
                            class_code
                        )
                    `)

                    .eq("id", id)

                    .single();

                if (error) throw error;

                return data;

            }

            catch (error) {

                console.error(error);

                return null;

            }

        },

        /* ==============================================
           SEARCH STUDENTS
        ============================================== */

        async search(keyword) {

            try {

                if (!keyword || keyword.trim() === "") {

                    return await this.getAll();

                }

                keyword = keyword.trim();

                const { data, error } = await API.db

                    .from("students")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone
                        ),
                        classes:class_id(
                            id,
                            class_name
                        )
                    `)

                    .or(

                        `student_no.ilike.%${keyword}%,
                        admission_number.ilike.%${keyword}%`

                    );

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(error);

                return [];

            }

        },

        /* ==============================================
           ADMIT STUDENT
        ============================================== */

        async admit(studentData) {

            try {

                // Get the token from the exact Supabase client used to invoke
                // the function. Refresh a near-expiry session before sending
                // the request so admission never relies on a stale token.
                const { data: sessionData, error: sessionError } = await API.db.auth.getSession();
                if (sessionError || !sessionData?.session) {
                    throw new Error("Your session has expired. Please sign in again and retry.");
                }

                let session = sessionData.session;
                const expiresSoon = Number(session.expires_at || 0) * 1000 <= Date.now() + 60_000;
                if (expiresSoon) {
                    const { data: refreshData, error: refreshError } = await API.db.auth.refreshSession();
                    if (refreshError || !refreshData?.session) {
                        throw new Error("Your session has expired. Please sign in again and retry.");
                    }
                    session = refreshData.session;
                }

                const accessToken = session.access_token;
                if (!accessToken) {
                    throw new Error("Your session has expired. Please sign in again and retry.");
                }

                const { data: userData, error: userError } = await API.db.auth.getUser(accessToken);
                if (userError || !userData?.user) {
                    await API.db.auth.signOut();
                    throw new Error("Your sign-in session is no longer valid. Please sign in again and retry.");
                }

                // Use fetch here instead of functions.invoke. Some cached SDK
                // builds replace a caller-supplied Authorization header with
                // the anon key, which makes an otherwise signed-in admin look
                // unauthenticated to this privileged endpoint.
                const functionUrl = `${window.CONFIG?.SUPABASE?.URL}/functions/v1/admit-student`;
                const anonKey = window.CONFIG?.SUPABASE?.ANON_KEY;
                if (!functionUrl || !anonKey) {
                    throw new Error("Supabase function configuration is missing.");
                }

                const response = await fetch(functionUrl, {
                    method: "POST",
                    headers: {
                        apikey: anonKey,
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(studentData)
                });

                let data = null;
                try {
                    data = await response.json();
                } catch {
                    // Keep the status-based message below if a proxy returns
                    // an empty or non-JSON error response.
                }

                if (!response.ok) {
                    throw new Error(data?.error || `Unable to admit student (${response.status}).`);
                }

                if (data?.error) {
                    throw new Error(data.error);
                }

                return API.response(
                    true,
                    data,
                    "Student admitted successfully."
                );

            }

            catch (error) {

                console.error(error);

                const message = await API.functionErrorMessage(
                    error,
                    "Unable to admit student."
                );

                return API.response(
                    false,
                    null,
                    message
                );

            }

        },

        /* ==============================================
           CREATE STUDENT
        ============================================== */

        async create(studentData) {

            try {

                const { data, error }

                    = await API.db

                        .from("students")

                        .insert(studentData)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Student created successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           STUDENTS BY CLASS
        ============================================== */

        async getByClass(classId) {

            try {

                const { data, error } = await API.db

                    .from("students")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name
                        )
                    `)

                    .eq("class_id", classId)

                    .order("created_at", {
                        ascending: false
                    });

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(error);

                return [];

            }

        },

        /* ==============================================
           UPDATE STUDENT
        ============================================== */

        async update(id, updates) {

            try {

                const { data, error }

                    = await API.db

                        .from("students")

                        .update({

                            ...updates,

                            updated_at: new Date().toISOString()

                        })

                        .eq("id", id)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Student updated successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           DELETE STUDENT
        ============================================== */

        async delete(id) {

            try {

                const { error }

                    = await API.db

                        .from("students")

                        .delete()

                        .eq("id", id);

                if (error) throw error;

                return API.response(

                    true,

                    null,

                    "Student deleted."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           CHANGE STATUS
        ============================================== */

        async changeStatus(id, status) {

            return await this.update(

                id,

                {

                    status

                }

            );

        }

    };

    /* ======================================================
       TEACHERS API
    ====================================================== */

    static teachers = {
                /* ==============================================
           GET ALL TEACHERS
        ============================================== */

        async getAll() {

            try {

                const { data, error } = await API.db

                    .from("teachers")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone,
                            gender,
                            avatar_url
                        )
                    `)

                    .order("created_at", {

                        ascending: false

                    });

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(

                    "Teachers Error:",

                    error

                );

                return [];

            }

        },

        /* ==============================================
           GET TEACHER BY ID
        ============================================== */

        async getById(id) {

            try {

                const { data, error } = await API.db

                    .from("teachers")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone,
                            gender,
                            avatar_url
                        )
                    `)

                    .eq("id", id)

                    .single();

                if (error) throw error;

                return data;

            }

            catch (error) {

                console.error(error);

                return null;

            }

        },

        /* ==============================================
           SEARCH TEACHERS
        ============================================== */

        async search(keyword) {

            try {

                if (!keyword || keyword.trim() === "") {

                    return await this.getAll();

                }

                keyword = keyword.trim();

                const { data, error } = await API.db

                    .from("teachers")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone
                        )
                    `)

                    .or(

                        `teacher_no.ilike.%${keyword}%,
qualification.ilike.%${keyword}%,
specialization.ilike.%${keyword}%`

                    );

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(error);

                return [];

            }

        },

        /* ==============================================
           CREATE TEACHER
        ============================================== */

        async create(teacherData) {

            try {

                const { data, error }

                    = await API.db

                        .from("teachers")

                        .insert(teacherData)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Teacher created successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           CREATE TEACHER ACCOUNT AND RECORD
        ============================================== */

        async createAccount(teacherData) {

            try {

                if (!teacherData || typeof teacherData !== "object") {
                    throw new Error("Teacher data is required.");
                }

                const fullName = String(teacherData.full_name || "").trim();
                const nameParts = fullName.split(/\s+/).filter(Boolean);
                const firstName = String(
                    teacherData.first_name || nameParts.shift() || ""
                ).trim();
                const lastName = String(
                    teacherData.last_name || nameParts.join(" ") || ""
                ).trim();

                if (!firstName || !lastName) {
                    throw new Error("Teacher first and last name are required.");
                }

                // `full_name` is a form-only convenience field. The profiles
                // table stores first_name and last_name, not full_name.
                const {
                    full_name: ignoredFullName,
                    ...accountData
                } = teacherData;

                const accessToken = await window.Auth?.accessToken?.();
                if (!accessToken) {
                    throw new Error("Your session has expired. Please sign in again and retry.");
                }

                const { data, error } = await API.db.functions.invoke(
                    "create-user",
                    {
                        body: {
                            ...accountData,
                            first_name: firstName,
                            last_name: lastName,
                            role: "teacher",
                            teacher_data: {
                                employee_id: teacherData.employee_id,
                                department_id: teacherData.department_id,
                                department_name: teacherData.department_name,
                                qualification: teacherData.qualification,
                                status: teacherData.status || "active"
                            }
                        },
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    }
                );

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                return API.response(true, data?.teacher || data, data?.message || "Teacher created successfully.");

            } catch (error) {

                console.error(error);
                const message = await API.functionErrorMessage(
                    error,
                    "Unable to create teacher."
                );
                return API.response(false, null, message);

            }

        },

        /* ==============================================
           UPDATE TEACHER
        ============================================== */

        async update(id, updates) {

            try {

                const { data, error }

                    = await API.db

                        .from("teachers")

                        .update({

                            ...updates,

                            updated_at: new Date().toISOString()

                        })

                        .eq("id", id)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Teacher updated successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           DELETE TEACHER
        ============================================== */

        async delete(id) {

            try {

                const { error }

                    = await API.db

                        .from("teachers")

                        .delete()

                        .eq("id", id);

                if (error) throw error;

                return API.response(

                    true,

                    null,

                    "Teacher deleted."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

          },

        /* ==============================================
           STUDENT COUNT
        ============================================== */

        async count() {

            try {

                const { count, error } = await API.db

                    .from("students")

                    .select("*", {
                        count: "exact",
                        head: true
                    });

                if (error) throw error;

                return count || 0;

            }

            catch (error) {

                console.error(error);

                return 0;

            }

        },

    };

    /* ======================================================
       PARENTS API
    ====================================================== */

    static parents = {
                /* ==============================================
           GET ALL PARENTS
        ============================================== */

        async getAll() {

            try {

                const { data, error } = await API.db

                    .from("parents")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone,
                            gender,
                            avatar_url
                        )
                    `)

                    .order("created_at", {

                        ascending: false

                    });

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error("Parents Error:", error);

                return [];

            }

        },

        /* ==============================================
           GET PARENT BY ID
        ============================================== */

        async getById(id) {

            try {

                const { data, error } = await API.db

                    .from("parents")

                    .select(`
                        *,
                        profiles:profile_id(
                            id,
                            first_name,
                            last_name,
                            email,
                            phone,
                            gender,
                            avatar_url
                        )
                    `)

                    .eq("id", id)

                    .single();

                if (error) throw error;

                return data;

            }

            catch (error) {

                console.error(error);

                return null;

            }

        },

        /* ==============================================
           CREATE PARENT
        ============================================== */

        async create(parentData) {

            try {

                const { data, error } = await API.db

                    .from("parents")

                    .insert(parentData)

                    .select()

                    .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Parent created successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           UPDATE PARENT
        ============================================== */

        async update(id, updates) {

            try {

                const { data, error } = await API.db

                    .from("parents")

                    .update({

                        ...updates,

                        updated_at: new Date().toISOString()

                    })

                    .eq("id", id)

                    .select()

                    .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Parent updated successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           DELETE PARENT
        ============================================== */

        async delete(id) {

            try {

                const { error } = await API.db

                    .from("parents")

                    .delete()

                    .eq("id", id);

                if (error) throw error;

                return API.response(

                    true,

                    null,

                    "Parent deleted."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        }

    };

    /* ======================================================
       CLASSES API
    ====================================================== */

    static classes = {

        /* ==============================================
           GET ALL CLASSES
        ============================================== */

        async getAll() {

            try {

                const { data, error } = await API.db

                    .from("classes")

                    .select("*")

                    .order("class_name");

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(error);

                return [];

            }

        },

        /* ==============================================
           GET CLASS BY ID
        ============================================== */

        async getById(id) {

            try {

                const { data, error } = await API.db

                    .from("classes")

                    .select("*")

                    .eq("id", id)

                    .single();

                if (error) throw error;

                return data;

            }

            catch (error) {

                console.error(error);

                return null;

            }

        },

        /* ==============================================
           CREATE CLASS
        ============================================== */

        async create(classData) {

            try {

                const { data, error } = await API.db

                    .from("classes")

                    .insert(classData)

                    .select()

                    .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Class created successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           UPDATE CLASS
        ============================================== */

        async update(id, updates) {

            try {

                const { data, error } = await API.db

                    .from("classes")

                    .update({

                        ...updates,

                        updated_at: new Date().toISOString()

                    })

                    .eq("id", id)

                    .select()

                    .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Class updated successfully."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           DELETE CLASS
        ============================================== */

        async delete(id) {

            try {

                const { error } = await API.db

                    .from("classes")

                    .delete()

                    .eq("id", id);

                if (error) throw error;

                return API.response(

                    true,

                    null,

                    "Class deleted."

                );

            }

            catch (error) {

                console.error(error);

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        }

    };

    /* ======================================================
       SUBJECTS API
    ====================================================== */

    static subjects = {
                /* ==============================================
           GET ALL SUBJECTS
        ============================================== */

        async getAll() {

            try {

                const { data, error } = await API.db

                    .from("subjects")

                    .select("*")

                    .order("subject_name");

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(error);

                return [];

            }

        },

        /* ==============================================
           GET SUBJECT
        ============================================== */

        async getById(id) {

            try {

                const { data, error } = await API.db

                    .from("subjects")

                    .select("*")

                    .eq("id", id)

                    .single();

                if (error) throw error;

                return data;

            }

            catch (error) {

                console.error(error);

                return null;

            }

        },

        /* ==============================================
           CREATE SUBJECT
        ============================================== */

        async create(subjectData) {

            try {

                const { data, error }

                    = await API.db

                        .from("subjects")

                        .insert(subjectData)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Subject created successfully."

                );

            }

            catch (error) {

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           UPDATE SUBJECT
        ============================================== */

        async update(id, updates) {

            try {

                const { data, error }

                    = await API.db

                        .from("subjects")

                        .update({

                            ...updates,

                            updated_at: new Date().toISOString()

                        })

                        .eq("id", id)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Subject updated."

                );

            }

            catch (error) {

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        },

        /* ==============================================
           DELETE SUBJECT
        ============================================== */

        async delete(id) {

            try {

                const { error }

                    = await API.db

                        .from("subjects")

                        .delete()

                        .eq("id", id);

                if (error) throw error;

                return API.response(

                    true,

                    null,

                    "Subject deleted."

                );

            }

            catch (error) {

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        }

    };

    /* ======================================================
       ANNOUNCEMENTS
    ====================================================== */

    static announcements = {

        async getLatest(limit = 5) {

            try {

                const query = API.db
                    .from("announcements")
                    .select("*");

                const orderedQuery = typeof query.order === "function"
                    ? query.order("created_at", { ascending: false })
                    : query;

                const limitedQuery = typeof orderedQuery.limit === "function"
                    ? orderedQuery.limit(limit)
                    : orderedQuery;

                const { data, error } = await limitedQuery;

                if (error) throw error;

                return data || [];

            }

            catch (error) {

                console.error(error);

                return [];

            }

        },

        async create(payload) {

            try {

                const { data, error }

                    = await API.db

                        .from("announcements")

                        .insert(payload)

                        .select()

                        .single();

                if (error) throw error;

                return API.response(

                    true,

                    data,

                    "Announcement created."

                );

            }

            catch (error) {

                return API.response(

                    false,

                    null,

                    error.message

                );

            }

        }

    };

}

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.API = API;

console.log(

    "✅ API Layer Loaded"

);
