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

    /* ======================================================
       DASHBOARD
    ====================================================== */

    static dashboard = {

        async stats() {

            try {

                const db = API.db;

                const [

                    students,

                    teachers,

                    parents,

                    classes,

                    subjects

                ] = await Promise.all([

                    db
                        .from("students")
                        .select("*", {

                            head: true,

                            count: "exact"

                        }),

                    db
                        .from("teachers")
                        .select("*", {

                            head: true,

                            count: "exact"

                        }),

                    db
                        .from("parents")
                        .select("*", {

                            head: true,

                            count: "exact"

                        }),

                    db
                        .from("classes")
                        .select("*", {

                            head: true,

                            count: "exact"

                        }),

                    db
                        .from("subjects")
                        .select("*", {

                            head: true,

                            count: "exact"

                        })

                ]);

                return {

                    students: students.count || 0,

                    teachers: teachers.count || 0,

                    parents: parents.count || 0,

                    classes: classes.count || 0,

                    subjects: subjects.count || 0

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

                    subjects: 0

                };

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
                /* ==============================================
           GET STUDENT BY ID
        ============================================== */

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

        }

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
