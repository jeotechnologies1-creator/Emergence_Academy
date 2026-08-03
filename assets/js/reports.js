/* ======================================================
   STUDENTS
====================================================== */

static students = {

    /* -----------------------------------------------
       GET ALL STUDENTS
    ----------------------------------------------- */

    async getAll() {

        const { data, error } = await window.supabaseClient

            .from("students")

            .select(`
                *,
                profiles (
                    id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    avatar_url
                ),
                classes (
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
       SEARCH STUDENTS
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
       UPDATE STUDENT
    ----------------------------------------------- */

    async update(id, values) {

        const { data, error } =
            await window.supabaseClient

                .from("students")

                .update(values)

                .eq("id", id)

                .select()

                .single();

        if (error) throw error;

        return data;

    },

    /* -----------------------------------------------
       DELETE STUDENT
    ----------------------------------------------- */

    async delete(id) {

        const { error } =
            await window.supabaseClient

                .from("students")

                .delete()

                .eq("id", id);

        if (error) throw error;

        return true;

    },

    /* -----------------------------------------------
       STUDENTS BY CLASS
    ----------------------------------------------- */

    async getByClass(classId) {

        const { data, error } =
            await window.supabaseClient

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

        const { count, error } =
            await window.supabaseClient

                .from("students")

                .select("*", {
                    count: "exact",
                    head: true
                });

        if (error) throw error;

        return count || 0;

    }

};
/* ======================================================
   TEACHERS
====================================================== */

static teachers = {

    async getAll() {

        const { data, error } = await window.supabaseClient

            .from("teachers")

            .select(`
                *,
                profiles(
                    id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    avatar_url
                )
            `)

            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        return data || [];

    },

    async getById(id) {

        return await API.find("teachers", id);

    },

    async create(values) {

        return await API.insert("teachers", values);

    },

    async update(id, values) {

        return await API.update("teachers", id, values);

    },

    async delete(id) {

        return await API.delete("teachers", id);

    },

    async count() {

        const { count, error } = await window.supabaseClient

            .from("teachers")

            .select("*", {
                count: "exact",
                head: true
            });

        if (error) throw error;

        return count || 0;

    }

};
/* ======================================================
   PARENTS
====================================================== */

static parents = {

    async getAll() {

        const { data, error } = await window.supabaseClient

            .from("parents")

            .select(`
                *,
                profiles(
                    first_name,
                    last_name,
                    email,
                    phone
                )
            `);

        if (error) throw error;

        return data || [];

    },

    async getById(id) {

        return await API.find("parents", id);

    },

    async create(values) {

        return await API.insert("parents", values);

    },

    async update(id, values) {

        return await API.update("parents", id, values);

    },

    async delete(id) {

        return await API.delete("parents", id);

    }

};
/* ======================================================
   CLASSES
====================================================== */

static classes = {

    async getAll() {

        return await API.select("classes");

    },

    async getById(id) {

        return await API.find("classes", id);

    },

    async create(values) {

        return await API.insert("classes", values);

    },

    async update(id, values) {

        return await API.update("classes", id, values);

    },

    async delete(id) {

        return await API.delete("classes", id);

    }

};
/* ======================================================
   SUBJECTS
====================================================== */

static subjects = {

    async getAll() {

        return await API.select("subjects");

    },

    async getById(id) {

        return await API.find("subjects", id);

    },

    async create(values) {

        return await API.insert("subjects", values);

    },

    async update(id, values) {

        return await API.update("subjects", id, values);

    },

    async delete(id) {

        return await API.delete("subjects", id);

    }

};
