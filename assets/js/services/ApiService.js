// /* ==========================================================
//    EMERGENCE ACADEMY
//    API SERVICE
//    Version: 1.0.0
// ========================================================== */

// (function () {
//     "use strict";

//     class ApiService {

//         static async getClient() {

//             if (window.waitForSupabase) {
//                 await window.waitForSupabase();
//             }

//             return window.getSupabaseClient();

//         }

//         static table(name) {

//             if (!window.CONFIG?.TABLES?.[name]) {
//                 throw new Error(`Unknown table "${name}"`);
//             }

//             return window.CONFIG.TABLES[name];

//         }

//         static async select(table, options = {}) {

//             const client = await this.getClient();

//             let query = client
//                 .from(this.table(table))
//                 .select(options.columns || "*");

//             if (options.match) {

//                 Object.entries(options.match).forEach(([key, value]) => {

//                     query = query.eq(key, value);

//                 });

//             }

//             if (options.order) {

//                 query = query.order(
//                     options.order.column,
//                     {
//                         ascending: options.order.ascending ?? true
//                     }
//                 );

//             }

//             if (options.limit) {

//                 query = query.limit(options.limit);

//             }

//             const { data, error } = await query;

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async single(table, match) {

//             const client = await this.getClient();

//             const { data, error } = await client
//                 .from(this.table(table))
//                 .select("*")
//                 .match(match)
//                 .single();

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async insert(table, payload) {

//             const client = await this.getClient();

//             const { data, error } = await client
//                 .from(this.table(table))
//                 .insert(payload)
//                 .select();

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async update(table, match, payload) {

//             const client = await this.getClient();

//             const { data, error } = await client
//                 .from(this.table(table))
//                 .update(payload)
//                 .match(match)
//                 .select();

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async upsert(table, payload) {

//             const client = await this.getClient();

//             const { data, error } = await client
//                 .from(this.table(table))
//                 .upsert(payload)
//                 .select();

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async delete(table, match) {

//             const client = await this.getClient();

//             const { error } = await client
//                 .from(this.table(table))
//                 .delete()
//                 .match(match);

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return true;

//         }

//         static async rpc(functionName, params = {}) {

//             const client = await this.getClient();

//             const { data, error } =
//                 await client.rpc(functionName, params);

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async upload(bucket, path, file, options = {}) {

//             const client = await this.getClient();

//             const { data, error } =
//                 await client.storage
//                     .from(bucket)
//                     .upload(path, file, options);

//             if (error) {

//                 console.error(error);

//                 throw error;

//             }

//             return data;

//         }

//         static async getPublicUrl(bucket, path) {

//             const client = await this.getClient();

//             const { data } =
//                 client.storage
//                     .from(bucket)
//                     .getPublicUrl(path);

//             return data.publicUrl;

//         }

//     }

//     window.ApiService = ApiService;

// })();

/* ==========================================================
   EMERGENCE ACADEMY
   API SERVICE
========================================================== */

(function () {

    "use strict";

    class ApiService {

        static client() {

            return window.getSupabaseClient();

        }

        static table(name) {

            const table = CONFIG.TABLES[name] || name;

            return this.client().from(table);

        }

        /* ===============================
           SELECT
        =============================== */

        static async select(name, options = {}) {

            const {
                columns = "*",
                filters = {},
                order = null,
                limit = null,
                single = false
            } = options;

            let query = this.table(name).select(columns);

            Object.entries(filters).forEach(([column, value]) => {

                if (value !== undefined &&
                    value !== null &&
                    value !== "") {

                    query = query.eq(column, value);

                }

            });

            if (order) {

                query = query.order(
                    order.column,
                    {
                        ascending:
                            order.ascending ?? true
                    }
                );

            }

            if (limit) {

                query = query.limit(limit);

            }

            if (single) {

                query = query.single();

            }

            const { data, error } = await query;

            if (error) {

                console.error(error);

                throw error;

            }

            return data;

        }

        /* ===============================
           INSERT
        =============================== */

        static async insert(name, payload) {

            const { data, error } =
                await this.table(name)
                    .insert(payload)
                    .select();

            if (error) {

                console.error(error);

                throw error;

            }

            return data;

        }

        /* ===============================
           UPDATE
        =============================== */

        static async update(name, id, payload) {

            const { data, error } =
                await this.table(name)
                    .update(payload)
                    .eq("id", id)
                    .select();

            if (error) {

                console.error(error);

                throw error;

            }

            return data;

        }

        /* ===============================
           DELETE
        =============================== */

        static async delete(name, id) {

            const { error } =
                await this.table(name)
                    .delete()
                    .eq("id", id);

            if (error) {

                console.error(error);

                throw error;

            }

            return true;

        }

        /* ===============================
           COUNT
        =============================== */

        static async count(name, filters = {}) {

            let query =
                this.table(name)
                    .select("*", {
                        count: "exact",
                        head: true
                    });

            Object.entries(filters).forEach(([column, value]) => {

                query = query.eq(column, value);

            });

            const { count, error } = await query;

            if (error) {

                throw error;

            }

            return count;

        }

        /* ===============================
           EXISTS
        =============================== */

        static async exists(name, filters = {}) {

            return (await this.count(name, filters)) > 0;

        }

        /* ===============================
           SINGLE
        =============================== */

        static async single(name, filters = {}) {

            return this.select(name, {
                filters,
                single: true
            });

        }

    }

    window.ApiService = ApiService;

})();