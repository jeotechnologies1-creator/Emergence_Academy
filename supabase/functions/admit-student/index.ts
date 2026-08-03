import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase(
    { auth: ["secret"] },
    async (req, ctx) => {

      try {

        const body = await req.json();

        const {
          email,
          password,
          first_name,
          last_name,
          phone,
          class_id,
          admission_date
        } = body;

        if (!email || !password) {
          return Response.json(
            { error: "Email and password are required." },
            { status: 400 }
          );
        }

        const { data: authUser, error: authError } =
          await ctx.supabaseAdmin.auth.admin.createUser({

            email,

            password,

            email_confirm: true

          });

        if (authError) {

          return Response.json(
            { error: authError.message },
            { status: 400 }
          );

        }

        const user = authUser.user;

        if (!user) {

          return Response.json(
            { error: "Failed to create user." },
            { status: 500 }
          );

        }
        const user = authUser.user;

        if (!user) {

          return Response.json(
            { error: "Failed to create user." },
            { status: 500 }
          );

        }
        /* ------------------------------------------
           CREATE PROFILE
        ------------------------------------------- */

        const { error: profileError } = await ctx.supabaseAdmin

          .from("profiles")

          .insert({

            id: user.id,

            email,

            role: "student",

            first_name,

            last_name,

            phone

          });

        if (profileError) {

          // Remove the auth user if profile creation fails
          await ctx.supabaseAdmin.auth.admin.deleteUser(user.id);

          return Response.json(

            {
              error: profileError.message
            },

            {
              status: 400
            }

          );

        }
        /* ------------------------------------------
   CREATE STUDENT RECORD
------------------------------------------- */

        const currentYear = new Date().getFullYear();

        const { data: studentId, error: studentError } =
          await ctx.supabaseAdmin.rpc("admit_student", {

            p_profile_id: user.id,

            p_class_id: class_id || null,

            p_admission_date: admission_date || null,

            p_admission_year: currentYear,

            p_status: "active"

          });

        if (studentError) {

          // Roll back profile
          await ctx.supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", user.id);

          // Roll back auth user
          await ctx.supabaseAdmin.auth.admin.deleteUser(user.id);

          return Response.json(
            {
              error: studentError.message
            },
            {
              status: 400
            }
          );

        }
        /* ------------------------------------------
   LOAD COMPLETE STUDENT
------------------------------------------- */

        const { data: student, error: fetchError } =
          await ctx.supabaseAdmin

            .from("students")

            .select(`
              *,
              profiles (
                first_name,
                last_name,
                email,
                phone
              ),
              classes (
                id,
                class_name
              )
            `)

            .eq("id", studentId)

            .single();

        if (fetchError) {

          return Response.json(
            {
              success: true,
              student_id: studentId
            }
          );

        }

        return Response.json({

          success: true,

          student

        });

      } catch (err) {

        return Response.json(

          {
            error: err instanceof Error ? err.message : "Unknown error"
          },

          {
            status: 500
          }

        );

      }

    }
  )
};