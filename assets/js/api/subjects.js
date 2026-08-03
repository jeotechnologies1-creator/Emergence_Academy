/* ==========================================================
   EMERGENCE ACADEMY
   API v2.0
========================================================== */

class API {

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

}

window.API = API;