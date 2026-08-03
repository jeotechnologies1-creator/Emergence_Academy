/* ==========================================================
   EMERGENCE ACADEMY
   API
   TEACHERS MODULE
========================================================== */

class API {

    /* ======================================================
       GENERIC METHODS
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
       TEACHERS
    ====================================================== */

    static teachers = {

        async getAll() {

            const { data, error } = await window.supabaseClient

                .from("teachers")

                .select(`
                    *,
                    profiles (
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

}

/* ==========================================================
   EXPORT
========================================================== */

window.API = API;