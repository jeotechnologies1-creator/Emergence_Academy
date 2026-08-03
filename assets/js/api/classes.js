/* ==========================================================
   EMERGENCE ACADEMY
   API
   CLASSES MODULE
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
       CLASSES
    ====================================================== */

    static classes = {

        /* -----------------------------------------------
           GET ALL CLASSES
        ----------------------------------------------- */

        async getAll() {

            const { data, error } = await window.supabaseClient

                .from("classes")

                .select("*")

                .order("class_name", {
                    ascending: true
                });

            if (error) throw error;

            return data || [];

        },

        /* -----------------------------------------------
           GET CLASS
        ----------------------------------------------- */

        async getById(id) {

            return await API.find("classes", id);

        },

        /* -----------------------------------------------
           CREATE CLASS
        ----------------------------------------------- */

        async create(values) {

            return await API.insert("classes", values);

        },

        /* -----------------------------------------------
           UPDATE CLASS
        ----------------------------------------------- */

        async update(id, values) {

            return await API.update("classes", id, values);

        },

        /* -----------------------------------------------
           DELETE CLASS
        ----------------------------------------------- */

        async delete(id) {

            return await API.delete("classes", id);

        },

        /* -----------------------------------------------
           TOTAL CLASSES
        ----------------------------------------------- */

        async count() {

            const { count, error } = await window.supabaseClient

                .from("classes")

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