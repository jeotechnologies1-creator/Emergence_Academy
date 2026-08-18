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

        // Read the actual enrolment records, not merely profiles carrying the
        // student role. This is the number shown to administrators everywhere
        // a student count is displayed.
        async enrolledStudentCount() {

            try {

                const { count, error } = await API.db
                    .from("students")
                    .select("id", {
                        count: "exact",
                        head: true
                    });

                if (error) throw error;

                return count || 0;

            } catch (error) {

                console.error("Enrolled student count failed:", error);
                return 0;

            }

        },

        // Lightweight list for the dashboard's enrolled-student card. It
        // uses the same `students` records as the count, so only admitted
        // students appear here.
        async enrolledStudents(limit = 6) {

            try {

                const { data, error } = await API.db
                    .from("students")
                    .select(`
                        id,
                        student_no,
                        admission_number,
                        status,
                        created_at,
                        profiles:profile_id(first_name,last_name),
                        classes:class_id(class_name,class_code)
                    `)
                    .order("created_at", { ascending: false })
                    .limit(limit);

                if (error) throw error;

                return data || [];

            } catch (error) {

                console.error("Enrolled student list failed:", error);
                return [];

            }

        },

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
                    this.enrolledStudentCount(),
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

                                date_of_birth,

                                address,

                                city,

                                state,

                                country,

                                avatar_url

                            ),

                            classes:class_id(

                                id,

                                class_name,

                                class_code

                            ),

                            departments:department_id(

                                id,

                                name

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
                            date_of_birth,
                            address,
                            city,
                            state,
                            country,
                            avatar_url
                        ),
                        classes:class_id(
                            id,
                            class_name,
                            class_code
                        ),
                        departments:department_id(
                            id,
                            name
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

        // async admit(studentData) {

        //     try {

        //         // Get the token from the exact Supabase client used to invoke
        //         // the function. Refresh a near-expiry session before sending
        //         // the request so admission never relies on a stale token.
        //         const { data: sessionData, error: sessionError } = await API.db.auth.getSession();
        //         if (sessionError || !sessionData?.session) {
        //             throw new Error("Your session has expired. Please sign in again and retry.");
        //         }

        //         let session = sessionData.session;
        //         const expiresSoon = Number(session.expires_at || 0) * 1000 <= Date.now() + 60_000;
        //         if (expiresSoon) {
        //             const { data: refreshData, error: refreshError } = await API.db.auth.refreshSession();
        //             if (refreshError || !refreshData?.session) {
        //                 throw new Error("Your session has expired. Please sign in again and retry.");
        //             }
        //             session = refreshData.session;
        //         }

        //         const accessToken = session.access_token;
        //         if (!accessToken) {
        //             throw new Error("Your session has expired. Please sign in again and retry.");
        //         }

        //         const { data: userData, error: userError } = await API.db.auth.getUser(accessToken);
        //         if (userError || !userData?.user) {
        //             await API.db.auth.signOut();
        //             throw new Error("Your sign-in session is no longer valid. Please sign in again and retry.");
        //         }

        //         // Use fetch here instead of functions.invoke. Some cached SDK
        //         // builds replace a caller-supplied Authorization header with
        //         // the anon key, which makes an otherwise signed-in admin look
        //         // unauthenticated to this privileged endpoint.
        //         const functionUrl = `${window.CONFIG?.SUPABASE?.URL}/functions/v1/admit-student`;
        //         const anonKey = window.CONFIG?.SUPABASE?.ANON_KEY;
        //         if (!functionUrl || !anonKey) {
        //             throw new Error("Supabase function configuration is missing.");
        //         }

        //         const response = await fetch(functionUrl, {
        //             method: "POST",
        //             headers: {
        //                 apikey: anonKey,
        //                 Authorization: `Bearer ${accessToken}`,
        //                 "Content-Type": "application/json"
        //             },
        //             body: JSON.stringify(studentData)
        //         });

        //         let data = null;
        //         try {
        //             data = await response.json();
        //         } catch {
        //             // Keep the status-based message below if a proxy returns
        //             // an empty or non-JSON error response.
        //         }

        //         if (!response.ok) {
        //             throw new Error(data?.error || `Unable to admit student (${response.status}).`);
        //         }

        //         if (data?.error) {
        //             throw new Error(data.error);
        //         }

        //         return API.response(
        //             true,
        //             data,
        //             "Student admitted successfully."
        //         );

        //     }

        //     catch (error) {

        //         console.error(error);

        //         const message = await API.functionErrorMessage(
        //             error,
        //             "Unable to admit student."
        //         );

        //         return API.response(
        //             false,
        //             null,
        //             message
        //         );

        //     }

        // },



        // ----------------------------------


        // async admit(studentData) {
        //     try {
        //         const { data: sessionData, error: sessionError } =
        //             await API.db.auth.getSession();

        //         if (sessionError) {
        //             console.error("Session error:", sessionError);
        //             throw new Error("Unable to verify your login session.");
        //         }

        //         const session = sessionData?.session;

        //         if (!session?.access_token) {
        //             throw new Error(
        //                 "Not authenticated. Please sign out and sign in again."
        //             );
        //         }

        //         const accessToken = session.access_token;

        //         console.log("Admission authentication:", {
        //             authenticated: true,
        //             userId: session.user?.id,
        //             email: session.user?.email,
        //             hasToken: !!accessToken
        //         });

        //         const { data, error } =
        //             await API.db.functions.invoke(
        //                 "admit-student",
        //                 {
        //                     body: studentData,
        //                     headers: {
        //                         Authorization: `Bearer ${accessToken}`
        //                     }
        //                 }
        //             );

        //         console.log("Admission function response:", {
        //             data,
        //             error
        //         });

        //         if (error) {
        //             throw error;
        //         }

        //         if (data?.error) {
        //             throw new Error(data.error);
        //         }

        //         return API.response(
        //             true,
        //             data,
        //             "Student admitted successfully."
        //         );

        //     } catch (error) {
        //         console.error("Student admission failed:", error);

        //         const message = await API.functionErrorMessage(
        //             error,
        //             "Unable to admit student."
        //         );

        //         return API.response(
        //             false,
        //             null,
        //             message
        //         );
        //     }
        // },

        // ----------------------------


        // catch(error) {
        //     console.error("FULL ADMISSION ERROR:", error);

        //     let serverMessage = error?.message || "Unable to admit student.";

        //     try {
        //         if (error?.context) {
        //             const response = error.context.clone
        //                 ? error.context.clone()
        //                 : error.context;

        //             const text = await response.text();

        //             console.error("EDGE FUNCTION RESPONSE:", text);

        //             if (text) {
        //                 try {
        //                     const parsed = JSON.parse(text);
        //                     serverMessage =
        //                         parsed?.error ||
        //                         parsed?.message ||
        //                         serverMessage;
        //                 } catch {
        //                     serverMessage = text;
        //                 }
        //             }
        //         }
        //     } catch (e) {
        //         console.error("Could not read Edge Function response:", e);
        //     }

        //     return API.response(
        //         false,
        //         null,
        //         serverMessage
        //     );
        // },

        // -------------------------------

        async admit(studentData) {
            try {
                // A persisted session can still contain an expired access
                // token. Refresh it before the privileged request rather
                // than forwarding a token the Edge Function must reject.
                let { data: sessionData, error: sessionError } =
                    await API.db.auth.getSession();
                let session = sessionData?.session || null;
                let refreshed = false;
                const expiresSoon = Number(session?.expires_at || 0) * 1000 <= Date.now() + 60_000;

                if (!session || expiresSoon) {
                    const { data: refreshData, error: refreshError } =
                        await API.db.auth.refreshSession();
                    session = refreshData?.session || null;
                    sessionError = sessionError || refreshError;
                    refreshed = true;
                }

                if (sessionError && !session) {
                    console.error("Admission session error:", sessionError);
                }

                if (!session?.access_token) {
                    console.error("No Supabase access token found.");
                    return API.response(
                        false,
                        null,
                        "Your session is unavailable. Please sign out and sign in again."
                    );
                }

                let { data: userData, error: userError } =
                    await API.db.auth.getUser(session.access_token);

                // If the tab resumed after the token was revoked or rotated,
                // ask Auth for one fresh token before declaring the admin
                // signed out. This handles refresh races across browser tabs.
                if ((userError || !userData?.user) && !refreshed) {
                    const { data: refreshData, error: refreshError } =
                        await API.db.auth.refreshSession();
                    if (!refreshError && refreshData?.session?.access_token) {
                        session = refreshData.session;
                        ({ data: userData, error: userError } =
                            await API.db.auth.getUser(session.access_token));
                    }
                }

                if (userError || !userData?.user) {
                    console.error("Session validation error:", userError);
                    return API.response(
                        false,
                        null,
                        "Your login session is no longer valid. Please sign in again."
                    );
                }

                console.log("Admission authentication:", {
                    authenticated: true,
                    userId: userData.user.id,
                    email: userData.user.email,
                    hasToken: true
                });

                // Do not route this through functions.invoke: some SDK/runtime
                // combinations replace a supplied Authorization header before
                // the Edge Function receives it. Send the freshly validated
                // token directly, including a dedicated admission header.
                const functionUrl = `${window.CONFIG.SUPABASE.URL}/functions/v1/admit-student`;
                const response = await fetch(
                    functionUrl,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            apikey: window.CONFIG.SUPABASE.ANON_KEY,
                            Authorization: `Bearer ${session.access_token}`,
                            "x-admission-token": session.access_token
                        },
                        body: JSON.stringify(studentData)
                    }
                );

                const rawResult = await response.text();
                let result = {};

                try {
                    result = rawResult ? JSON.parse(rawResult) : {};
                } catch {
                    result = { error: rawResult || "Unknown admission response." };
                }

                console.log("Admission function response:", {
                    status: response.status,
                    data: result
                });

                if (!response.ok) {
                    throw new Error(
                        result?.error ||
                        result?.message ||
                        `Admission failed (${response.status}).`
                    );
                }

                if (result?.error) {
                    throw new Error(result.error);
                }

                return API.response(
                    true,
                    result,
                    result?.message || "Student admitted successfully."
                );

            } catch (error) {
                console.error("Student admission failed:", error);

                return API.response(
                    false,
                    null,
                    error?.message || "Unable to admit student."
                );
            }
        },
        async manage(action, studentId, payload = {}) {
            try {
                const { data: sessionData, error: sessionError } = await API.db.auth.getSession();
                let session = sessionData?.session;
                if (sessionError || !session?.access_token) throw new Error("Your session is unavailable. Please sign in again.");
                if (Number(session.expires_at || 0) * 1000 <= Date.now() + 60_000) {
                    const { data, error } = await API.db.auth.refreshSession();
                    if (error || !data?.session?.access_token) throw new Error("Your session has expired. Please sign in again.");
                    session = data.session;
                }
                const response = await fetch(`${window.CONFIG.SUPABASE.URL}/functions/v1/admit-student`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: window.CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${session.access_token}`, "x-admission-token": session.access_token },
                    body: JSON.stringify({ operation: action, student_id: studentId, ...payload })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result?.error) throw new Error(result?.error || `Student ${action} failed.`);
                return API.response(true, result, result?.message || "Student updated successfully.");
            } catch (error) {
                console.error("Student management failed:", error);
                return API.response(false, null, error?.message || "Unable to manage student.");
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
                                specialization: teacherData.specialization,
                                employment_date: teacherData.employment_date,
                                status: teacherData.status || "active",
                                class_ids: Array.isArray(teacherData.class_ids) ? teacherData.class_ids : [],
                                subject_ids: Array.isArray(teacherData.subject_ids) ? teacherData.subject_ids : []
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
