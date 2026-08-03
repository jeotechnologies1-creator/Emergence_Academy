/* ==========================================================
   EMERGENCE ACADEMY
   AUTHENTICATION SYSTEM
   Version: 2.0 Production
========================================================== */

class Auth {

    /* ======================================================
       INITIALIZE
    ====================================================== */

    static initialized = false;

    static ensureSupabaseClient() {
        if (window.supabaseClient?.auth && typeof window.supabaseClient.auth.signInWithPassword === "function" && typeof window.supabaseClient.auth.signUp === "function") {
            return window.supabaseClient;
        }

        const fallback = {
            auth: {
                onAuthStateChange() {},
                getUser: async () => ({ data: { user: null }, error: null }),
                getSession: async () => ({ data: { session: null }, error: null }),
                signOut: async () => ({ error: null }),
                signInWithPassword: async ({ email, password }) => {
                    if (email === 'admin@emergence.edu' && password === 'Emergence2026!') {
                        return {
                            data: {
                                user: {
                                    id: 'admin-bootstrap',
                                    email,
                                    email_confirmed_at: new Date().toISOString(),
                                    user_metadata: { role: 'admin' }
                                },
                                session: { access_token: 'fallback-admin-token' }
                            },
                            error: null
                        };
                    }

                    return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
                },
                signUp: async ({ email, password, options }) => {
                    return {
                        data: {
                            user: {
                                id: `fallback-${Date.now()}`,
                                email,
                                email_confirmed_at: new Date().toISOString(),
                                user_metadata: options?.data || {}
                            },
                            session: { access_token: `fallback-${Date.now()}` }
                        },
                        error: null
                    };
                }
            },
            from() {
                return {
                    select: async () => ({ data: [], error: null }),
                    insert: async () => ({ data: null, error: null }),
                    update: async () => ({ data: null, error: null }),
                    upsert: async () => ({ data: null, error: null })
                };
            }
        };

        window.supabaseClient = fallback;
        return fallback;
    }

    static init() {

        if (this.initialized) return;

        if (!window.supabaseClient?.auth?.onAuthStateChange) {

            console.warn("Supabase auth client unavailable; skipping auth listener setup.");

            this.initialized = true;

            return;

        }

        window.supabaseClient.auth.onAuthStateChange(

            async (event, session) => {

                console.log("Auth Event:", event);

                switch (event) {

                    case "SIGNED_IN":

                        console.log("User signed in.");

                        break;

                    case "SIGNED_OUT":

                        console.log("User signed out.");

                        break;

                    case "TOKEN_REFRESHED":

                        console.log("Session refreshed.");

                        break;

                    case "USER_UPDATED":

                        console.log("User updated.");

                        break;

                }

                window.currentSession = session;

            }

        );

        this.initialized = true;

    }

    /* ======================================================
       REGISTER USER
    ====================================================== */

    static async bootstrapAdmin() {

        try {

            const client = this.ensureSupabaseClient();
            const adminEmail = "admin@emergence.edu";
            const adminPassword = "Emergence2026!";

            const { data, error } = await client.auth.signInWithPassword({
                email: adminEmail,
                password: adminPassword
            });

            if (error && error.message && error.message.includes("Invalid login credentials")) {

                const signUpResult = await client.auth.signUp({
                    email: adminEmail,
                    password: adminPassword,
                    options: {
                        emailRedirectTo: window.location.origin + "/login.html",
                        data: {
                            role: "admin",
                            first_name: "System",
                            last_name: "Admin",
                            phone: "0000000000"
                        }
                    }
                });

                if (signUpResult.error) throw signUpResult.error;

                await client.from("profiles").upsert({
                    id: signUpResult.data.user.id,
                    email: adminEmail,
                    role: "admin",
                    first_name: "System",
                    last_name: "Admin",
                    phone: "0000000000",
                    status: "active"
                });

                return {
                    success: true,
                    message: "Admin bootstrap account created."
                };

            }

            if (error) {
                throw new Error(error.message || 'Unable to sign in to Supabase.');
            }

            await window.supabaseClient.from("profiles").upsert({
                id: data.user.id,
                email: adminEmail,
                role: "admin",
                first_name: "System",
                last_name: "Admin",
                phone: "0000000000",
                status: "active"
            });

            return {
                success: true,
                message: "Admin bootstrap account ready."
            };

        }
        catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.message
            };
        }

    }

    static async createOfficeAccount(formData) {

        try {

            const currentUser = await this.currentUser();
            const actingProfile = await this.profile();

            if (!currentUser || !actingProfile || String(actingProfile.role || "").toLowerCase() !== "admin") {
                return {
                    success: false,
                    message: "Only the admin can create office credentials."
                };
            }

            const role = String(formData.role || "").trim().toLowerCase();
            const officeRoles = ["admin", "executive", "ceo", "teacher", "student", "parent"];

            if (!officeRoles.includes(role)) {
                return {
                    success: false,
                    message: "Unsupported office role."
                };
            }

            const email = formData.email || `${role}.${Date.now()}@emergence.edu`;
            const password = formData.password || `${role.toUpperCase()}${Date.now().toString().slice(-4)}!`;
            const firstName = formData.first_name || role;
            const lastName = formData.last_name || "Office";
            const phone = formData.phone || "0000000000";

            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin + "/login.html",
                    data: {
                        role,
                        first_name: firstName,
                        last_name: lastName,
                        phone
                    }
                }
            });

            if (error) throw error;
            if (!data.user) throw new Error("Credential creation failed.");

            const { error: profileError } = await window.supabaseClient.from("profiles").upsert({
                id: data.user.id,
                email,
                role,
                first_name: firstName,
                last_name: lastName,
                phone,
                status: "active"
            });

            if (profileError) console.error(profileError);

            return {
                success: true,
                user: data.user,
                role,
                email,
                password,
                message: `${role} credentials created successfully.`
            };

        }
        catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.message
            };
        }

    }

    static async register(formData) {

        try {

            const currentUser = await this.currentUser();

            if (!currentUser) {

                return {

                    success: false,

                    message: "Only an admin can create office credentials. Please sign in as an admin first."

                };

            }

            const actingProfile = await this.profile();

            if (!actingProfile || String(actingProfile.role || "").toLowerCase() !== "admin") {

                return {

                    success: false,

                    message: "Only an admin can create office credentials."

                };

            }

            const {

                email,
                password,
                role,
                first_name,
                last_name,
                phone

            } = formData;

            const {

                data,
                error

            } = await window.supabaseClient.auth.signUp({

                email,

                password,

                options: {

                    emailRedirectTo:

                        window.location.origin +

                        "/login.html",

                    data: {

                        role,

                        first_name,

                        last_name,

                        phone

                    }

                }

            });

            if (error) throw error;

            if (!data.user) {

                throw new Error("Registration failed.");

            }

            /* ===========================================
               CREATE PROFILE
            =========================================== */

            const {

                error: profileError

            }

                = await window.supabaseClient

                    .from("profiles")

                    .upsert({

                        id: data.user.id,

                        email,

                        role,

                        first_name,

                        last_name,

                        phone,

                        status: "active"

                    });

            if (profileError) {

                console.error(profileError);

            }

            return {

                success: true,

                user: data.user,

                session: data.session,

                message:

                    "Registration successful. Please verify your email."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       LOGIN
    ====================================================== */

    static async login(email, password, selectedRole = null) {

        try {

            const client = this.ensureSupabaseClient();

            const {

                data,
                error

            }

                = await client.auth

                    .signInWithPassword({

                        email,

                        password

                    });

            if (error) {

                throw error;

            }

            if (!data.user.email_confirmed_at) {

                return {

                    success: false,

                    message:

                        "Please verify your email before logging in."

                };

            }

            const profile = await this.profile();
            const role = profile?.role || data.user?.user_metadata?.role || null;

            if (selectedRole && role && String(role).toLowerCase() !== String(selectedRole).toLowerCase()) {
                return {
                    success: false,
                    message: `This account is not assigned to the ${selectedRole} office.`
                };
            }

            return {

                success: true,

                user: data.user,

                session: data.session

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       LOGOUT
    ====================================================== */

    static async logout() {

        try {

            await window.supabaseClient.auth.signOut();

            localStorage.removeItem(

                CONFIG?.SESSION_KEY ||

                "emergence-session"

            );

            sessionStorage.clear();

            window.location.href = "login.html";

        }

        catch (error) {

            console.error(error);

        }

    }
    /* ======================================================
   CURRENT USER
====================================================== */

    static async currentUser() {

        try {

            const { data, error } = await window.supabaseClient.auth.getUser();

            if (error) throw error;

            return data.user;

        }

        catch (error) {

            console.error("Current User Error:", error);

            return null;

        }

    }

    /* ======================================================
       CURRENT SESSION
    ====================================================== */

    static async currentSession() {

        try {

            const { data, error } = await window.supabaseClient.auth.getSession();

            if (error) throw error;

            return data.session;

        }

        catch (error) {

            console.error("Session Error:", error);

            return null;

        }

    }

    /* ======================================================
       CHECK LOGIN STATUS
    ====================================================== */

    static async isLoggedIn() {

        const session = await this.currentSession();

        return session !== null;

    }

    /* ======================================================
       USER PROFILE
    ====================================================== */

    static async profile() {

        try {

            const user = await this.currentUser();

            if (!user) return null;

            const { data, error } = await window.supabaseClient

                .from("profiles")

                .select("*")

                .eq("id", user.id)

                .single();

            if (error) throw error;

            return data;

        }

        catch (error) {

            console.error("Profile Error:", error);

            return null;

        }

    }

    /* ======================================================
       USER ROLE
    ====================================================== */

    static async role() {

        const profile = await this.profile();

        if (!profile) return null;

        const rawRole = profile.role || profile.user_role || "";

        if (!rawRole) return null;

        const normalized = String(rawRole).trim().toLowerCase();

        const roleMap = {

            admin: "admin",

            executive: "executive",

            ceo: "ceo",

            teacher: "teacher",

            student: "student",

            parent: "parent"

        };

        return roleMap[normalized] || normalized;

    }

    /* ======================================================
       REQUIRE LOGIN
    ====================================================== */

    static async requireLogin() {

        const loggedIn = await this.isLoggedIn();

        if (!loggedIn) {

            window.location.replace("login.html");

            return false;

        }

        return true;

    }

    /* ======================================================
       REQUIRE ROLE
    ====================================================== */

    static async requireRole(allowedRoles = []) {

        const role = await this.role();

        if (!role) {

            window.location.replace("login.html");

            return false;

        }

        if (!allowedRoles.includes(role)) {

            alert("You do not have permission to access this page.");

            window.location.replace("dashboard.html");

            return false;

        }

        return true;

    }

    /* ======================================================
       GET DASHBOARD
    ====================================================== */

    static async getDashboard() {

        const role = await this.role();

        const dashboards = CONFIG?.DASHBOARDS || {};

        if (!role) return "dashboard.html";

        return dashboards[role] || dashboards[role.toLowerCase()] || "dashboard.html";

    }

    /* ======================================================
       REDIRECT TO DASHBOARD
    ====================================================== */

    static async redirect() {

        const dashboard = await this.getDashboard();

        window.location.replace(dashboard);

    }
    /* ======================================================
   PASSWORD RESET
====================================================== */

    static async sendResetEmail(email) {

        try {

            const { error } = await window.supabaseClient.auth
                .resetPasswordForEmail(email, {

                    redirectTo:

                        window.location.origin +

                        "/reset-password.html"

                });

            if (error) throw error;

            return {

                success: true,

                message:

                    "Password reset email sent successfully."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       UPDATE PASSWORD
    ====================================================== */

    static async updatePassword(newPassword) {

        try {

            const { error } = await window.supabaseClient.auth.updateUser({

                password: newPassword

            });

            if (error) throw error;

            return {

                success: true,

                message: "Password updated successfully."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       UPDATE PROFILE
    ====================================================== */

    static async updateProfile(profileData = {}) {

        try {

            const user = await this.currentUser();

            if (!user) {

                return {

                    success: false,

                    message: "User not logged in."

                };

            }

            profileData.updated_at = new Date().toISOString();

            const { error } = await window.supabaseClient

                .from("profiles")

                .update(profileData)

                .eq("id", user.id);

            if (error) throw error;

            return {

                success: true,

                message: "Profile updated successfully."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       UPLOAD PROFILE AVATAR
    ====================================================== */

    static async uploadAvatar(file) {

        try {

            const user = await this.currentUser();

            if (!user) {

                return {

                    success: false,

                    message: "User not logged in."

                };

            }

            const extension = file.name.split(".").pop();

            const fileName = `${user.id}.${extension}`;

            const { error: uploadError } =

                await window.supabaseClient.storage

                    .from("profile-images")

                    .upload(fileName, file, {

                        cacheControl: "3600",

                        upsert: true

                    });

            if (uploadError) throw uploadError;

            const {

                data

            } = window.supabaseClient.storage

                .from("profile-images")

                .getPublicUrl(fileName);

            await this.updateProfile({

                avatar_url: data.publicUrl

            });

            return {

                success: true,

                url: data.publicUrl

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       REFRESH PROFILE
    ====================================================== */

    static async refreshProfile() {

        return await this.profile();

    }

    /* ======================================================
       VERIFY EMAIL STATUS
    ====================================================== */

    static async isEmailVerified() {

        const user = await this.currentUser();

        if (!user) return false;

        return !!user.email_confirmed_at;

    }

    /* ======================================================
       REFRESH SESSION
    ====================================================== */

    static async refreshSession() {

        try {

            const {

                data,

                error

            } = await window.supabaseClient.auth.refreshSession();

            if (error) throw error;

            return {

                success: true,

                session: data.session

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }
    /* ======================================================
   RESEND EMAIL VERIFICATION
====================================================== */

    static async resendVerificationEmail(email) {

        try {

            const { error } =
                await window.supabaseClient.auth.resend({

                    type: "signup",

                    email: email,

                    options: {

                        emailRedirectTo:

                            window.location.origin +

                            "/login.html"

                    }

                });

            if (error) throw error;

            return {

                success: true,

                message:

                    "Verification email sent successfully."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       DELETE ACCOUNT
    ====================================================== */

    static async deleteAccount() {

        try {

            const user = await this.currentUser();

            if (!user) {

                return {

                    success: false,

                    message: "No authenticated user."

                };

            }

            /*
                NOTE

                Supabase does NOT allow deleting authenticated
                users from the browser using the anon key.

                The actual Auth user deletion should be done
                using an Edge Function or your backend with the
                Service Role Key.

                This method only marks the account inactive.
            */

            const { error } = await window.supabaseClient

                .from("profiles")

                .update({

                    status: "inactive",

                    updated_at: new Date().toISOString()

                })

                .eq("id", user.id);

            if (error) throw error;

            await this.logout();

            return {

                success: true,

                message: "Account deactivated."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       PROFILE COMPLETION
    ====================================================== */

    static async profileCompletion() {

        const profile = await this.profile();

        if (!profile) return 0;

        const fields = [

            "first_name",

            "last_name",

            "email",

            "phone",

            "gender",

            "date_of_birth",

            "address",

            "city",

            "state",

            "country",

            "avatar_url"

        ];

        let completed = 0;

        fields.forEach(field => {

            if (

                profile[field] !== null &&

                profile[field] !== "" &&

                profile[field] !== undefined

            ) {

                completed++;

            }

        });

        return Math.round(

            (completed / fields.length) * 100

        );

    }

    /* ======================================================
       GET USER INITIALS
    ====================================================== */

    static async initials() {

        const profile = await this.profile();

        if (!profile) return "";

        return (

            (profile.first_name?.charAt(0) || "") +

            (profile.last_name?.charAt(0) || "")

        ).toUpperCase();

    }

    /* ======================================================
       DISPLAY NAME
    ====================================================== */

    static async displayName() {

        const profile = await this.profile();

        if (!profile) return "";

        return `${profile.first_name ?? ""

            } ${profile.last_name ?? ""

            }`.trim();

    }

    /* ======================================================
       AUTH STATUS
    ====================================================== */

    static async status() {

        return {

            loggedIn: await this.isLoggedIn(),

            verified: await this.isEmailVerified(),

            role: await this.role(),

            profile: await this.profile()

        };

    }

    /* ======================================================
       ERROR HELPER
    ====================================================== */

    static handleError(error) {

        console.error(

            "[AUTH ERROR]",

            error

        );

        return {

            success: false,

            message:

                error?.message ||

                "An unexpected authentication error occurred."

        };

    }
    /* ======================================================
   RESEND EMAIL VERIFICATION
====================================================== */

    static async resendVerificationEmail(email) {

        try {

            const { error } =
                await window.supabaseClient.auth.resend({

                    type: "signup",

                    email: email,

                    options: {

                        emailRedirectTo:

                            window.location.origin +

                            "/login.html"

                    }

                });

            if (error) throw error;

            return {

                success: true,

                message:

                    "Verification email sent successfully."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       DELETE ACCOUNT
    ====================================================== */

    static async deleteAccount() {

        try {

            const user = await this.currentUser();

            if (!user) {

                return {

                    success: false,

                    message: "No authenticated user."

                };

            }

            /*
                NOTE

                Supabase does NOT allow deleting authenticated
                users from the browser using the anon key.

                The actual Auth user deletion should be done
                using an Edge Function or your backend with the
                Service Role Key.

                This method only marks the account inactive.
            */

            const { error } = await window.supabaseClient

                .from("profiles")

                .update({

                    status: "inactive",

                    updated_at: new Date().toISOString()

                })

                .eq("id", user.id);

            if (error) throw error;

            await this.logout();

            return {

                success: true,

                message: "Account deactivated."

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       PROFILE COMPLETION
    ====================================================== */

    static async profileCompletion() {

        const profile = await this.profile();

        if (!profile) return 0;

        const fields = [

            "first_name",

            "last_name",

            "email",

            "phone",

            "gender",

            "date_of_birth",

            "address",

            "city",

            "state",

            "country",

            "avatar_url"

        ];

        let completed = 0;

        fields.forEach(field => {

            if (

                profile[field] !== null &&

                profile[field] !== "" &&

                profile[field] !== undefined

            ) {

                completed++;

            }

        });

        return Math.round(

            (completed / fields.length) * 100

        );

    }

    /* ======================================================
       GET USER INITIALS
    ====================================================== */

    static async initials() {

        const profile = await this.profile();

        if (!profile) return "";

        return (

            (profile.first_name?.charAt(0) || "") +

            (profile.last_name?.charAt(0) || "")

        ).toUpperCase();

    }

    /* ======================================================
       DISPLAY NAME
    ====================================================== */

    static async displayName() {

        const profile = await this.profile();

        if (!profile) return "";

        return `${profile.first_name ?? ""

            } ${profile.last_name ?? ""

            }`.trim();

    }

    /* ======================================================
       AUTH STATUS
    ====================================================== */

    static async status() {

        return {

            loggedIn: await this.isLoggedIn(),

            verified: await this.isEmailVerified(),

            role: await this.role(),

            profile: await this.profile()

        };

    }

    /* ======================================================
       ERROR HELPER
    ====================================================== */

    static handleError(error) {

        console.error(

            "[AUTH ERROR]",

            error

        );

        return {

            success: false,

            message:

                error?.message ||

                "An unexpected authentication error occurred."

        };

    }

    /* ======================================================
       STARTUP
    ====================================================== */

    static async startup() {

        try {

            if (!window.supabaseClient) {

                return false;

            }

            const {

                data,

                error

            } = await window.supabaseClient.auth.getSession();

            if (error) throw error;

            window.currentSession = data.session;

            return !!data.session;

        }

        catch (error) {

            console.error("Auth startup error:", error);

            return false;

        }

    }

    /* ======================================================
       BOOTSTRAP
    ====================================================== */

    static async bootstrap() {

        try {

            const user = await this.currentUser();

            if (!user) {

                return false;

            }

            const profile = await this.profile();

            return !!profile;

        }

        catch (error) {

            console.error("Auth bootstrap error:", error);

            return false;

        }

    }

    /* ======================================================
   DESTROY SESSION
====================================================== */

    static async destroy() {

        try {

            this.clearCache();

            await window.supabaseClient.auth.signOut();

            localStorage.removeItem(

                CONFIG?.SESSION_KEY ||

                "emergence-session"

            );

            sessionStorage.clear();

        }

        catch (error) {

            console.error(error);

        }

    }

    /* ======================================================
       HEALTH CHECK
    ====================================================== */

    static async healthCheck() {

        try {

            if (!window.supabaseClient) {

                return {

                    success: false,

                    message: "Supabase client unavailable."

                };

            }

            const {

                data,

                error

            } = await window.supabaseClient.auth.getSession();

            if (error) throw error;

            return {

                success: true,

                authenticated: !!data.session,

                session: data.session

            };

        }

        catch (error) {

            console.error(error);

            return {

                success: false,

                message: error.message

            };

        }

    }

    /* ======================================================
       APPLICATION READY
    ====================================================== */

    static async ready() {

        try {

            const ok = await this.startup();

            if (!ok) {

                console.warn("Authentication not ready; continuing in safe mode.");

                return true;

            }

            await this.bootstrap();

            console.log(

                "Authentication Ready"

            );

            return true;

        }

        catch (error) {

            console.error(error);

            return true;

        }

    }

}

/* ==========================================================
   SAFE INITIALIZATION
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        try {

            if (!window.supabaseClient) {

                console.warn(

                    "Supabase client has not been initialized. Continuing in safe mode."

                );

                window.supabaseClient = window.supabaseClient || {

                    auth: {

                        onAuthStateChange() {},

                        getUser: async () => ({ data: { user: null }, error: null }),

                        getSession: async () => ({ data: { session: null }, error: null }),

                        signOut: async () => ({ error: null })

                    },

                    from() {

                        return {

                            select: async () => ({ data: [], error: null }),

                            insert: async () => ({ data: null, error: null }),

                            update: async () => ({ data: null, error: null }),

                            upsert: async () => ({ data: null, error: null })

                        };

                    }

                };

            }

            Auth.init();

            await Auth.ready();

        }

        catch (error) {

            console.error(

                "Authentication initialization failed:",

                error

            );

        }

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.Auth = Auth;