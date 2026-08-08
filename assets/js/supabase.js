/* ==========================================================
   EMERGENCE ACADEMY
   SUPABASE INITIALIZATION
   Version: 2.1.0
========================================================== */

(function initSupabaseRuntime() {
    "use strict";

    const runtime = typeof window !== "undefined" ? window : globalThis;

    if (runtime.__SUPABASE_INITIALIZED__) {
        console.info("Supabase already initialized.");
        return;
    }

    runtime.__SUPABASE_INITIALIZED__ = true;

    const CONFIG = runtime.CONFIG || {};

    const SUPABASE_URL = CONFIG.SUPABASE?.URL || "";
    const SUPABASE_ANON_KEY = CONFIG.SUPABASE?.ANON_KEY || "";

    runtime.SUPABASE_URL = SUPABASE_URL;
    runtime.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

    runtime.supabaseClient = null;
    runtime.supabaseReady = false;
    runtime.supabaseConnected = false;
    runtime.supabaseSession = null;
    runtime.supabaseUser = null;
    runtime.supabaseInitMessage = "";

    let readyResolve;
    runtime.supabaseReadyPromise = new Promise(resolve => {
        readyResolve = resolve;
    });

    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[SUPABASE]", ...args);
        }
    }

    function error(...args) {
        console.error("[SUPABASE]", ...args);
    }

    function dispatchRuntimeEvent(name, detail) {
        if (typeof runtime.dispatchEvent !== "function") {
            return;
        }

        if (typeof runtime.CustomEvent === "function") {
            runtime.dispatchEvent(new runtime.CustomEvent(name, { detail }));
            return;
        }

        // Non-browser/test environments may not provide CustomEvent.
        runtime.dispatchEvent({ type: name, detail });
    }

    function validateConfiguration() {
        if (!SUPABASE_URL) {
            throw new Error("Supabase URL is missing.");
        }

        if (!SUPABASE_ANON_KEY) {
            throw new Error("Supabase ANON KEY is missing.");
        }

        if (!runtime.supabase?.createClient) {
            throw new Error("Supabase JavaScript SDK missing or not loaded.");
        }
    }

    async function verifyConnection(client) {
        try {
            if (!client?.auth || typeof client.auth.getSession !== "function") {
                runtime.supabaseConnected = true;
                runtime.supabaseSession = null;
                runtime.supabaseUser = null;
                return true;
            }

            const { data, error: sessionError } =
                await client.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            runtime.supabaseConnected = true;
            runtime.supabaseSession = data.session || null;
            runtime.supabaseUser = data.session?.user || null;

            return true;

        } catch (err) {

            runtime.supabaseConnected = false;
            error("Connection verification failed:", err);

            return false;
        }
    }

    function registerAuthListener(client) {

        client.auth.onAuthStateChange((event, session) => {

            log("Auth Event:", event);

            runtime.supabaseSession = session || null;
            runtime.supabaseUser = session?.user || null;

            dispatchRuntimeEvent("supabase:auth", {
                event,
                session,
                user: session?.user || null
            });
        });

    }

    async function initialize() {

        try {

            validateConfiguration();

            runtime.supabaseClient =
                runtime.supabase.createClient(
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

            registerAuthListener(runtime.supabaseClient);

            await verifyConnection(runtime.supabaseClient);

            runtime.supabaseReady = true;
            runtime.supabaseInitMessage = "Supabase initialized successfully.";

            log(runtime.supabaseInitMessage);

        } catch (err) {

            runtime.supabaseReady = false;
            runtime.supabaseConnected = false;
            runtime.supabaseClient = null;

            runtime.supabaseInitMessage = err.message;

            error(err);

        } finally {

            readyResolve(runtime.supabaseReady);

            dispatchRuntimeEvent("supabase:ready", {
                ready: runtime.supabaseReady,
                connected: runtime.supabaseConnected
            });
        }
    }

    runtime.getSupabaseClient = function () {

        if (!runtime.supabaseClient) {
            throw new Error("Supabase has not been initialized.");
        }

        return runtime.supabaseClient;
    };

    runtime.waitForSupabase = async function () {
        await runtime.supabaseReadyPromise;
        return runtime.supabaseClient;
    };

    runtime.getCurrentSession = function () {
        return runtime.supabaseSession;
    };

    runtime.getCurrentUser = function () {
        return runtime.supabaseUser;
    };

    runtime.isSupabaseReady = function () {
        return runtime.supabaseReady;
    };

    runtime.isSupabaseConnected = function () {
        return runtime.supabaseConnected;
    };

    runtime.reloadSession = async function () {

        if (!runtime.supabaseClient) return null;

        const { data, error } =
            await runtime.supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        runtime.supabaseSession = data.session || null;
        runtime.supabaseUser = data.session?.user || null;

        return data.session;
    };

    initialize();

})();