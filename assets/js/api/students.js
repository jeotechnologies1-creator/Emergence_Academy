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

        async create(values) {

            return await API.insert("students", values);

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