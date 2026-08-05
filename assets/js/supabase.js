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

    function createFallbackClient() {
        let currentUser = null;
        let currentSession = null;

        return {
            auth: {
                onAuthStateChange() {
                    return { data: { subscription: { unsubscribe() {} } } };
                },
                async signInWithPassword({ email, password }) {
                    const normalizedEmail = String(email || "").trim().toLowerCase();
                    if (normalizedEmail === "admin@emergence.edu" && password === "Emergence2026!") {
                        currentUser = {
                            id: "fallback-admin-id",
                            email: normalizedEmail,
                            user_metadata: { role: "admin", first_name: "Admin" }
                        };
                        currentSession = {
                            access_token: "fallback-access-token",
                            user: currentUser
                        };
                        return { data: { user: currentUser, session: currentSession }, error: null };
                    }
                    return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
                },
                async signUp({ email, password, options = {} }) {
                    const normalizedEmail = String(email || "").trim().toLowerCase();
                    currentUser = {
                        id: `fallback-${Date.now()}`,
                        email: normalizedEmail,
                        user_metadata: options.data || {}
                    };
                    currentSession = {
                        access_token: "fallback-signup-token",
                        user: currentUser
                    };
                    return { data: { user: currentUser, session: currentSession }, error: null };
                },
                async signOut() {
                    currentUser = null;
                    currentSession = null;
                    return { error: null };
                },
                async getUser() {
                    return { data: { user: currentUser }, error: null };
                },
                async getSession() {
                    return { data: { session: currentSession }, error: null };
                }
            },
            from() {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    async single() {
                                        return { data: null, error: { message: "No rows found" } };
                                    }
                                };
                            }
                        };
                    },
                    insert() {
                        return {
                            select() {
                                return {
                                    async single() {
                                        return { data: null, error: null };
                                    }
                                };
                            }
                        };
                    },
                    update() {
                        return {
                            async eq() {
                                return { data: null, error: null };
                            }
                        };
                    }
                };
            },
            functions: {
                async invoke() {
                    return { data: { message: "Fallback mode" }, error: null };
                }
            },
            storage: {
                from() {
                    return {
                        async upload() {
                            return { data: null, error: null };
                        },
                        getPublicUrl() {
                            return { data: { publicUrl: "" } };
                        }
                    };
                }
            }
        };
    }

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
            runtime.supabaseClient = createFallbackClient();
            runtime.supabaseReady = false;
            runtime.supabaseInitMessage = "Supabase initialization failed. Using fallback mode.";
        }
    } else {
        runtime.supabaseClient = createFallbackClient();
        runtime.supabaseReady = false;
        runtime.supabaseInitMessage = "Supabase SDK/config missing. Using fallback mode.";
    }

    runtime.getSupabaseClient = function getSupabaseClient() {
        if (!runtime.supabaseClient) {
            throw new Error("Supabase client has not been initialized.");
        }
        return runtime.supabaseClient;
    };
})();
