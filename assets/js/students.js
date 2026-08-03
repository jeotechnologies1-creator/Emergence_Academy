/* ==========================================================
   EMERGENCE ACADEMY
   STUDENT SERVICE
   File: assets/js/student.js
========================================================== */

class Students {

    /* ======================================================
       CURRENT STUDENT
    ====================================================== */

    static async current() {

        try {

            const profile = await Auth.profile();

            if (!profile) return null;

            const { data, error } = await window.supabaseClient

                .from("students")

                .select(`
                    *,
                    classes:class_id(
                        id,
                        class_name,
                        class_code
                    )
                `)

                .eq("profile_id", profile.id)

                .single();

            if (error) throw error;

            return data;

        }

        catch (error) {

            console.error(error);

            return null;

        }

    }

    /* ======================================================
       GET ALL
    ====================================================== */

    static async all() {

        return await API.students.getAll();

    }

    /* ======================================================
       GET ONE
    ====================================================== */

    static async get(id) {

        return await API.students.getById(id);

    }

    /* ======================================================
       CREATE
    ====================================================== */

    static async create(student) {

        return await API.students.create(student);

    }

    /* ======================================================
       UPDATE
    ====================================================== */

    static async update(id, data) {

        return await API.students.update(id, data);

    }

    /* ======================================================
       DELETE
    ====================================================== */

    static async delete(id) {

        return await API.students.delete(id);

    }

    /* ======================================================
       SEARCH
    ====================================================== */

    static async search(keyword) {

        return await API.students.search(keyword);

    }

    /* ======================================================
       STUDENTS BY CLASS
    ====================================================== */

    static async byClass(classId) {

        try {

            const { data, error }

                = await window.supabaseClient

                    .from("students")

                    .select(`
                        *,
                        profiles:profile_id(
                            first_name,
                            last_name,
                            email
                        ),
                        classes:class_id(
                            class_name
                        )
                    `)

                    .eq("class_id", classId)

                    .order("student_no");

            if (error) throw error;

            return data || [];

        }

        catch (error) {

            console.error(error);

            return [];

        }

    }

    /* ======================================================
       TOTAL COUNT
    ====================================================== */

    static async count() {

        try {

            const {

                count,

                error

            }

            = await window.supabaseClient

                .from("students")

                .select("*", {

                    head: true,

                    count: "exact"

                });

            if (error) throw error;

            return count || 0;

        }

        catch (error) {

            console.error(error);

            return 0;

        }

    }

}

window.Students = Students;

console.log("✅ Students Service Loaded");