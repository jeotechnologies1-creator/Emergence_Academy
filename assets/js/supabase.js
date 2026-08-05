/* ==========================================================
   EMERGENCE ACADEMY
   SUPABASE INITIALIZATION
========================================================== */

(function initSupabaseRuntime() {
    const runtime = typeof window !== "undefined" ? window : globalThis;
    const cfg = runtime.CONFIG || globalThis.CONFIG || {};
    const supabaseCfg = cfg.SUPABASE || {};
    const SUPABASE_URL = supabaseCfg.URL || "";
    const SUPABASE_ANON_KEY = supabaseCfg.ANON_KEY || "";

    runtime.SUPABASE_URL = SUPABASE_URL;
    runtime.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_ANON_KEY && runtime.supabase?.createClient) {
        try {
            runtime.supabaseClient = runtime.supabase.createClient(
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
            runtime.supabaseReady = true;
            runtime.supabaseInitMessage = "Supabase connected successfully.";
            console.log("Supabase initialized.");
        } catch (error) {
            console.error("Supabase initialization failed:", error);
            runtime.supabaseClient = null;
            runtime.supabaseReady = false;
            runtime.supabaseInitMessage = "Supabase initialization failed. Check URL/ANON key.";
        }
    } else {
        runtime.supabaseClient = null;
        runtime.supabaseReady = false;
        runtime.supabaseInitMessage = "Supabase SDK/config missing.";
    }

    runtime.getSupabaseClient = function getSupabaseClient() {
        if (!runtime.supabaseClient) {
            throw new Error("Supabase client has not been initialized.");
        }
        return runtime.supabaseClient;
    };
})();
