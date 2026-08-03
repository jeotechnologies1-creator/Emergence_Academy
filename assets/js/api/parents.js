/* ==========================================================
   EMERGENCE ACADEMY
   API
   PARENTS MODULE
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
       PARENTS
    ====================================================== */

    static parents = {

        /* -----------------------------------------------
           GET ALL PARENTS
        ----------------------------------------------- */

        async getAll() {

            const { data, error } = await window.supabaseClient

                .from("parents")

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

        /* -----------------------------------------------
           GET PARENT
        ----------------------------------------------- */

        async getById(id) {

            return await API.find("parents", id);

        },

        /* -----------------------------------------------
           CREATE PARENT
        ----------------------------------------------- */

        async create(values) {

            return await API.insert("parents", values);

        },

        /* -----------------------------------------------
           UPDATE PARENT
        ----------------------------------------------- */

        async update(id, values) {

            return await API.update("parents", id, values);

        },

        /* -----------------------------------------------
           DELETE PARENT
        ----------------------------------------------- */

        async delete(id) {

            return await API.delete("parents", id);

        },

        /* -----------------------------------------------
           TOTAL PARENTS
        ----------------------------------------------- */

        async count() {

            const { count, error } = await window.supabaseClient

                .from("parents")

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