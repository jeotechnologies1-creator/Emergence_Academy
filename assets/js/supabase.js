// // /* ==========================================================
// //    EMERGENCE ACADEMY
// //    Supabase Configuration
// //    File: assets/js/supabase.js
// // ========================================================== */

// // const SUPABASE_URL = "https://yzvtwoqeosnsmnfpbisc.supabase.co";

// // const SUPABASE_ANON_KEY =
// // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";
/* ==========================================================
   EMERGENCE ACADEMY
   Supabase Configuration
========================================================== */

/* ==========================================================
   EMERGENCE ACADEMY
   Supabase Configuration
========================================================== */

const SUPABASE_URL =
    "https://yzvtwoqeosnsmnfpbisc.supabase.co";

const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";

/* Make globally available */
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
) {

    console.error("Supabase configuration missing.");

    window.supabaseReady = false;

    window.supabaseInitMessage =
        "Supabase configuration missing.";

}
else {

    try {

        window.supabaseClient =
            window.supabase.createClient(

                SUPABASE_URL,

                SUPABASE_ANON_KEY,

                {

                    auth: {

                        persistSession: true,

                        autoRefreshToken: true,

                        detectSessionInUrl: true

                    }

                }

            );

        window.supabaseReady = true;

        window.supabaseInitMessage =
            "Supabase connected successfully.";

        console.log("Supabase initialized.");

    }

    catch (error) {

        console.error(error);

        window.supabaseReady = false;

        window.supabaseInitMessage =
            "Supabase initialization failed.";

    }

}