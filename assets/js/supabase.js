// // /* ==========================================================
// //    EMERGENCE ACADEMY
// //    Supabase Configuration
// //    File: assets/js/supabase.js
// // ========================================================== */

// // const SUPABASE_URL = "https://yzvtwoqeosnsmnfpbisc.supabase.co";

// // const SUPABASE_ANON_KEY =
// // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";


// /* ==========================================================
//    EMERGENCE ACADEMY
//    SUPABASE INITIALIZATION
// ========================================================== */

// function createFallbackSupabaseClient() {
//     const createQueryBuilder = (options = {}) => {
//         const query = {
//             select() {
//                 return createQueryBuilder({
//                     ...options,
//                     selectArgs: arguments[0],
//                     selectOptions: arguments[1]
//                 });
//             },
//             eq() {
//                 return createQueryBuilder({ ...options });
//             },
//             order() {
//                 return createQueryBuilder({ ...options });
//             },
//             limit() {
//                 return createQueryBuilder({ ...options });
//             },
//             insert() {
//                 return Promise.resolve({ data: null, error: null });
//             },
//             update() {
//                 return Promise.resolve({ data: null, error: null });
//             },
//             upsert() {
//                 return Promise.resolve({ data: null, error: null });
//             },
//             delete() {
//                 return Promise.resolve({ data: null, error: null });
//             },
//             single() {
//                 return Promise.resolve({ data: null, error: null });
//             },
//             then(resolve) {
//                 const result = options.selectOptions?.head && options.selectOptions?.count
//                     ? { count: 0, error: null }
//                     : { data: [], error: null };

//                 return Promise.resolve(result).then(resolve);
//             },
//             catch(reject) {
//                 const result = options.selectOptions?.head && options.selectOptions?.count
//                     ? { count: 0, error: null }
//                     : { data: [], error: null };

//                 return Promise.resolve(result).catch(reject);
//             }
//         };

//         return query;
//     };

//     return {
//         auth: {
//             onAuthStateChange() {},
//             getUser: async () => ({ data: { user: null }, error: null }),
//             getSession: async () => ({ data: { session: null }, error: null }),
//             signInWithPassword: async ({ email, password }) => {
//                 if (email === 'admin@emergence.edu' && password === 'Emergence2026!') {
//                     return {
//                         data: {
//                             user: { id: 'admin-bootstrap', email, email_confirmed_at: new Date().toISOString() },
//                             session: { access_token: 'fallback-admin-token' }
//                         },
//                         error: null
//                     };
//                 }
//                 return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
//             },
//             signUp: async ({ email, password }) => {
//                 return {
//                     data: {
//                         user: { id: `fallback-${Date.now()}`, email, email_confirmed_at: new Date().toISOString() },
//                         session: { access_token: `fallback-${Date.now()}` }
//                     },
//                     error: null
//                 };
//             },
//             signOut: async () => ({ error: null }),
//             refreshSession: async () => ({ data: { session: null }, error: null }),
//             resetPasswordForEmail: async () => ({ error: null }),
//             updateUser: async () => ({ error: null }),
//             resend: async () => ({ error: null })
//         },
//         from() {
//             return {
//                 select: (...args) => createQueryBuilder({ selectArgs: args[0], selectOptions: args[1] }),
//                 insert: async () => ({ data: null, error: null }),
//                 update: async () => ({ data: null, error: null }),
//                 upsert: async () => ({ data: null, error: null }),
//                 delete: async () => ({ data: null, error: null })
//             };
//         },
//         storage: {
//             from() {
//                 return {
//                     upload: async () => ({ error: null }),
//                     getPublicUrl: () => ({ data: { publicUrl: null } })
//                 };
//             }
//         }
//     };
// }

// let supabase = null;
// let supabaseInitMessage = "Initializing Supabase...";

// try {
//     const SUPABASE_URL = window.CONFIG?.SUPABASE?.URL || "https://yzvtwoqeosnsmnfpbisc.supabase.co";
//     const SUPABASE_ANON_KEY = window.CONFIG?.SUPABASE?.ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";

//     if (window.supabase?.createClient) {
//         supabase = window.supabase.createClient(
//             SUPABASE_URL,
//             SUPABASE_ANON_KEY,
//             {
//                 auth: {
//                     autoRefreshToken: true,
//                     persistSession: true,
//                     detectSessionInUrl: true
//                 }
//             }
//         );

//         const hasRequiredAuthMethods = typeof supabase?.auth?.signInWithPassword === "function"
//             && typeof supabase?.auth?.signUp === "function";

//         if (hasRequiredAuthMethods) {
//             supabaseInitMessage = `Supabase client initialized for ${SUPABASE_URL}`;
//         }
//         else {
//             supabaseInitMessage = "Supabase SDK is available but its auth methods are incomplete in this browser. Using the built-in safe auth mode.";
//             supabase = createFallbackSupabaseClient();
//         }
//     }
//     else {
//         supabaseInitMessage = `Supabase JS library not loaded. URL: ${SUPABASE_URL}`;
//         supabase = createFallbackSupabaseClient();
//     }
// }
// catch (error) {
//     supabaseInitMessage = `Supabase initialization failed: ${error.message}`;
//     console.warn("Supabase unavailable, continuing in offline-safe mode.", error);
//     supabase = createFallbackSupabaseClient();
// }

// window.supabaseClient = supabase;
// window.supabaseReady = Boolean(supabase?.auth);
// window.supabaseUnavailable = !window.supabaseReady;
// window.supabaseInitMessage = supabaseInitMessage;

// /* ==========================================================
//    AUTH HELPERS
// ========================================================== */

// async function getCurrentUser() {
//     const { data, error } = await supabase.auth.getUser();

//     if (error) {
//         console.error(error);
//         return null;
//     }

//     return data.user;
// }

// async function getCurrentSession() {
//     const { data } = await supabase.auth.getSession();
//     return data.session;
// }

// async function isLoggedIn() {
//     return (await getCurrentSession()) !== null;
// }

// /* ==========================================================
//    PROFILE
// ========================================================== */

// async function getCurrentProfile() {
//     const user = await getCurrentUser();

//     if (!user) return null;

//     const { data, error } = await supabase
//         .from("profiles")
//         .select("*")
//         .eq("id", user.id)
//         .single();

//     if (error) {
//         console.error(error);
//         return null;
//     }

//     return data;
// }

// /* ==========================================================
//    LOGOUT
// ========================================================== */

// async function logout() {
//     await supabase.auth.signOut();

//     localStorage.removeItem("emergence-session");

//     sessionStorage.clear();

//     window.location.href = "login.html";
// }

// /* ==========================================================
//    AUTH STATE
// ========================================================== */

// supabase.auth.onAuthStateChange((event, session) => {
//     console.log("Auth:", event);

//     window.currentSession = session;
// });

// /* ==========================================================
//    GLOBALS
// ========================================================== */

// window.getCurrentUser = getCurrentUser;
// window.getCurrentProfile = getCurrentProfile;
// window.getCurrentSession = getCurrentSession;
// window.isLoggedIn = isLoggedIn;
// window.logout = logout;

/* ==========================================================
   EMERGENCE ACADEMY
   SUPABASE CLIENT CONFIGURATION
========================================================== */

const SUPABASE_URL = "https://yzvtwoqeosnsmnfpbisc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnR3b3Flb3Nuc21uZnBiaXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTM4ODcsImV4cCI6MjEwMDk2OTg4N30.KN_s6XhmFcBnNIuFcfcYKs0m-J_3iDY2l1zfSvu_u2I";


if (!window.supabase) {
    console.error(
        "Supabase library not loaded. Check your CDN script."
    );
}


const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


window.supabaseClient = supabaseClient;


/* ==========================================================
   AUTH HELPERS
========================================================== */


const Auth = {


    async getSession() {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Session error:",
                error
            );

            return null;
        }


        return data.session;

    },


    async getUser() {

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();


        if (error) {

            console.error(
                "User error:",
                error
            );

            return null;
        }


        return data.user;

    },


    async logout() {

        const {
            error
        } = await supabaseClient.auth.signOut();


        if (error) {

            console.error(
                "Logout failed:",
                error
            );

            return false;
        }


        window.location.href = "index.html";

        return true;

    }


};


window.Auth = Auth;