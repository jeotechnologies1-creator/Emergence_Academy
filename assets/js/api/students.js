/* ==========================================================
   EMERGENCE ACADEMY
   API
   STUDENTS MODULE
========================================================== */

class API {

    /* ======================================================
       GENERIC DATABASE METHODS
    ====================================================== */

    static async select(table, query = "*") {

        const { data, error } = await window.supabaseClient
            .from(table)
            .select(query);

        if (error) throw error;

        return data || [];

    }

    static async find(table, id, query = "*") {

        const { data, error } = await window.supabaseClient
            .from(table)
            .select(query)
            .eq("id", id)
            .single();

        if (error) throw error;

        return data;

    }

    static async insert(table, values) {

        const { data, error } = await window.supabaseClient
            .from(table)
            .insert(values)
            .select()
            .single();

        if (error) throw error;

        return data;

    }

    static async update(table, id, values) {

        const { data, error } = await window.supabaseClient
            .from(table)
            .update(values)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return data;

    }

    static async delete(table, id) {

        const { error } = await window.supabaseClient
            .from(table)
            .delete()
            .eq("id", id);

        if (error) throw error;

        return true;

    }

    /* ======================================================
       STUDENTS
    ====================================================== */

    static students = {
        /* -----------------------------------------------
   GENERATE ADMISSION NUMBER
----------------------------------------------- */

        generateAdmissionNumber() {

            const year = new Date().getFullYear();

            const random = Math.floor(
                1000 + Math.random() * 9000
            );

            return `EA${year}${random}`;

        },

        /* -----------------------------------------------
           GENERATE STUDENT ID
        ----------------------------------------------- */

        generateStudentID() {

            return crypto.randomUUID();

        },

        /* -----------------------------------------------
           DEFAULT PASSWORD
        ----------------------------------------------- */

        generatePassword() {

            return "Emergence@2026";

        },

        /* -----------------------------------------------
           GET ALL STUDENTS
        ----------------------------------------------- */

        async getAll() {

            const { data, error } = await window.supabaseClient

                .from("students")

                .select(`
                    *,
                    profiles(
                        id,
                        first_name,
                        last_name,
                        email,
                        phone,
                        avatar_url
                    ),
                    classes(
                        id,
                        class_name
                    )
                `)

                .order("created_at", {
                    ascending: false
                });

            if (error) throw error;

            return data || [];

        },

        /* -----------------------------------------------
           GET STUDENT
        ----------------------------------------------- */

        async getById(id) {

            const { data, error } = await window.supabaseClient

                .from("students")

                .select(`
                    *,
                    profiles(*),
                    classes(*)
                `)

                .eq("id", id)

                .single();

            if (error) throw error;

            return data;

        },

        /* -----------------------------------------------
           SEARCH
        ----------------------------------------------- */

        async search(keyword) {

            const { data, error } = await window.supabaseClient

                .from("students")

                .select(`
                    *,
                    profiles(
                        first_name,
                        last_name,
                        email,
                        phone
                    ),
                    classes(
                        class_name
                    )
                `)

                .or(
                    `student_no.ilike.%${keyword}%,admission_number.ilike.%${keyword}%`
                )

                .order("created_at", {
                    ascending: false
                });

            if (error) throw error;

            return data || [];

        },

        /* -----------------------------------------------
           ADMIT STUDENT
        ----------------------------------------------- */

        async admit(student) {

            const { data, error } =
                await window.supabaseClient.functions.invoke(
                    "admit-student",
                    {
                        body: student
                    }
                );

            if (error) throw error;

            if (data?.error) {

                throw new Error(data.error);

            }

            return data.student;

        },

        /* -----------------------------------------------
   CREATE STUDENT
----------------------------------------------- */

        async create(student) {

            const admissionNumber =
                this.generateAdmissionNumber();

            const studentID =
                this.generateStudentID();

            const password =
                this.generatePassword();

            /* -------------------------------
               Create Auth User
            ------------------------------- */

            const {

                data: authData,

                error: authError

            } = await window.supabaseClient.auth.admin.createUser({

                email: student.email,

                password,

                email_confirm: true

            });

            if (authError) throw authError;

            const user = authData.user;

            /* -------------------------------
               Create Profile
            ------------------------------- */

            const profile =
                await API.insert("profiles", {

                    id: user.id,

                    email: student.email,

                    role: "student",

                    first_name: student.first_name,

                    last_name: student.last_name,

                    phone: student.phone,

                    gender: student.gender,

                    address: student.address,

                    city: student.city,

                    state: student.state,

                    country: student.country,

                    status: "active"

                });

            /* -------------------------------
               Create Student
            ------------------------------- */

            const studentRecord =
                await API.insert("students", {

                    profile_id: profile.id,

                    student_no: admissionNumber,

                    student_id: studentID,

                    admission_number: admissionNumber,

                    class_id: student.class_id,

                    admission_date:
                        new Date().toISOString(),

                    admission_year:
                        new Date().getFullYear(),

                    status: "active"

                });

            return {

                profile,

                student: studentRecord,

                credentials: {

                    username: admissionNumber,

                    password

                }

            };

        },

        /* -----------------------------------------------
           UPDATE STUDENT
        ----------------------------------------------- */

        async update(id, values) {

            return await API.update("students", id, values);

        },

        /* -----------------------------------------------
           DELETE STUDENT
        ----------------------------------------------- */

        async delete(id) {

            return await API.delete("students", id);

        },

        /* -----------------------------------------------
           STUDENTS BY CLASS
        ----------------------------------------------- */

        async getByClass(classId) {

            const { data, error } = await window.supabaseClient

                .from("students")

                .select(`
                    *,
                    profiles(
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

        },

        /* -----------------------------------------------
           STUDENT COUNT
        ----------------------------------------------- */

        async count() {

            const { count, error } = await window.supabaseClient

                .from("students")

                .select("*", {
                    count: "exact",
                    head: true
                });

            if (error) throw error;

            return count || 0;

        }

    };

}

/* ==========================================================
   EXPORT
========================================================== */

window.API = API;