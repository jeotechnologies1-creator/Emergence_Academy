/* ==========================================================
   EMERGENCE ACADEMY
   AUTHENTICATION ENGINE v5.0
========================================================== */

class Auth {

    /* ======================================================
       CONFIGURATION
    ====================================================== */

    static initialized = false;

    static currentProfile = null;

    static currentPermissions = [];

    static SESSION_KEY = "emergence_session";

    static DASHBOARDS = {

        ceo: "dashboard.html",

        admin: "dashboard.html",

        executive: "executive-dashboard.html",

        teacher: "teacher-dashboard.html",

        student: "student-dashboard.html",

        parent: "parent-dashboard.html",

        finance: "finance-dashboard.html",

        hr: "hr-dashboard.html",

        admission: "admission-dashboard.html",

        exam: "exam-dashboard.html",

        library: "library-dashboard.html"

    };

    /* ======================================================
       SUPABASE CLIENT
    ====================================================== */

    static get client() {

        if (!window.supabaseClient) {

            throw new Error(
                "Supabase client has not been initialized."
            );

        }

        return window.supabaseClient;

    }

    /* ======================================================
       INITIALIZE
    ====================================================== */

    static async init() {

        if (this.initialized) return;

        const { data, error } =
            await this.client.auth.getSession();

        if (error) {

            console.error(error);

        }

        window.currentSession = data.session;

        this.client.auth.onAuthStateChange(

            async (event, session) => {

                console.log("AUTH EVENT:", event);

                window.currentSession = session;

                switch (event) {

                    case "SIGNED_IN":

                    case "TOKEN_REFRESHED":

                        this.clearCache();

                        break;

                    case "SIGNED_OUT":

                        this.clearCache();

                        sessionStorage.clear();

                        break;

                }

            }

        );

        this.initialized = true;

        console.log("Authentication Engine Ready");

    }

    /* ======================================================
       SESSION
    ====================================================== */

    static async session() {

        const {

            data,

            error

        } = await this.client.auth.getSession();

        if (error) {

            console.error(error);

            return null;

        }

        return data.session;

    }

    /* ======================================================
       ACCESS TOKEN
    ====================================================== */

    static async accessToken() {

        const session =
            await this.session();

        return session?.access_token || null;

    }

    /* ======================================================
       CURRENT USER
    ====================================================== */

    static async user() {

        const {

            data,

            error

        } = await this.client.auth.getUser();

        if (error) {

            console.error(error);

            return null;

        }

        return data.user;

    }

    /* ======================================================
       LOGGED IN
    ====================================================== */

    static async isLoggedIn() {

        return !!(await this.session());

    }

    /* ======================================================
       CLEAR CACHE
    ====================================================== */

    static clearCache() {

        this.currentProfile = null;

        this.currentPermissions = [];

    }

    /* ======================================================
       PROFILE
    ====================================================== */

    static async profile(refresh = false) {

        if (

            this.currentProfile &&

            !refresh

        ) {

            return this.currentProfile;

        }

        const user =
            await this.user();

        if (!user) {

            return null;

        }

        const {

            data,

            error

        } = await this.client

            .from("profiles")

            .select("*")

            .eq("id", user.id)

            .single();

        if (error) {

            console.error(error);

            return null;

        }

        this.currentProfile = data;

        sessionStorage.setItem(

            "profile",

            JSON.stringify(data)

        );

        return data;

    }

    /* ======================================================
       ROLE
    ====================================================== */

    static async role() {

        const profile =
            await this.profile();

        if (!profile) {

            return null;

        }

        return String(

            profile.role || ""

        )

            .trim()

            .toLowerCase();

    }

    /* ======================================================
       DISPLAY NAME
    ====================================================== */

    static async displayName() {

        const profile =
            await this.profile();

        if (!profile) {

            return "";

        }

        return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();

    }

    /* ======================================================
       INITIALS
    ====================================================== */

    static async initials() {

        const profile =
            await this.profile();

        if (!profile) {

            return "";

        }

        return (

            (profile.first_name?.charAt(0) || "") +

            (profile.last_name?.charAt(0) || "")

        ).toUpperCase();

    }
        /* ======================================================
       LOGIN
    ====================================================== */

    static async login(email, password, selectedRole = null) {

        try {

            const {

                data,

                error

            } = await this.client.auth.signInWithPassword({

                email: email.trim().toLowerCase(),

                password

            });

            if (error) {

                return this.error(error.message);

            }

            if (!data.user) {

                return this.error(
                    "Authentication failed."
                );

            }

            const profile =
                await this.profile(true);

            if (!profile) {

                await this.client.auth.signOut();

                return this.error(
                    "User profile not found."
                );

            }

            const accountStatus =
                String(profile.status || "")
                    .trim()
                    .toLowerCase();

            if (
                accountStatus &&
                accountStatus !== "active"
            ) {

                await this.client.auth.signOut();

                return this.error(
                    "This account has been disabled."
                );

            }

            const databaseRole =
                String(profile.role || "")
                    .trim()
                    .toLowerCase();

            const loginRole =
                String(selectedRole || "")
                    .trim()
                    .toLowerCase();

            if (

                loginRole &&

                databaseRole !== loginRole

            ) {

                await this.client.auth.signOut();

                return this.error(

                    `Access denied. This account belongs to the '${databaseRole}' portal.`

                );

            }

            sessionStorage.setItem(

                "profile",

                JSON.stringify(profile)

            );

            this.currentProfile = profile;

            return this.success({

                user: data.user,

                session: data.session,

                profile

            });

        }

        catch (err) {

            console.error(err);

            return this.error(

                err.message ||

                "Login failed."

            );

        }

    }

    /* ======================================================
       LOGOUT
    ====================================================== */

    static async logout() {

        try {

            await this.client.auth.signOut();

        }

        catch (err) {

            console.error(err);

        }

        this.clearCache();

        sessionStorage.clear();

        localStorage.removeItem(

            this.SESSION_KEY

        );

        window.location.replace(

            "login.html"

        );

    }

    /* ======================================================
       DASHBOARD
    ====================================================== */

    static async dashboard() {

        const role =
            await this.role();

        if (!role) {

            return "login.html";

        }

        return (

            this.DASHBOARDS[role] ||

            "dashboard.html"

        );

    }

    /* ======================================================
       REDIRECT
    ====================================================== */

    static async redirect() {

        const page =
            await this.dashboard();

        window.location.replace(page);

    }

    /* ======================================================
       REQUIRE LOGIN
    ====================================================== */

    static async requireLogin() {

        const loggedIn =
            await this.isLoggedIn();

        if (!loggedIn) {

            window.location.replace(
                "login.html"
            );

            return false;

        }

        return true;

    }

    /* ======================================================
       REQUIRE ROLE
    ====================================================== */

    static async requireRole(roles = []) {

        const ok =
            await this.requireLogin();

        if (!ok) {

            return false;

        }

        const currentRole =
            await this.role();

        if (!currentRole) {

            window.location.replace(
                "login.html"
            );

            return false;

        }

        const allowedRoles =
            roles.map(role =>
                String(role)
                    .trim()
                    .toLowerCase()
            );

        if (

            !allowedRoles.includes(
                currentRole
            )

        ) {

            alert(
                "You do not have permission to access this page."
            );

            window.location.replace(
                await this.dashboard()
            );

            return false;

        }

        return true;

    }
        /* ======================================================
       CREATE OFFICE ACCOUNT
       (Uses Supabase Edge Function)
    ====================================================== */

    static async createOfficeAccount(userData) {

        try {

            const profile = await this.profile();

            if (!profile) {
                return this.error("You must be logged in.");
            }

            const role = String(profile.role).toLowerCase();

            if (
                role !== "ceo" &&
                role !== "admin"
            ) {

                return this.error(
                    "Only the CEO or Admin can create users."
                );

            }

            const session =
                await this.session();

            if (!session) {

                return this.error(
                    "Authentication session expired."
                );

            }

            const response =
                await this.client.functions.invoke(
                    "create-user",
                    {

                        body: {

                            email: userData.email,

                            password: userData.password,

                            role: userData.role,

                            first_name: userData.first_name,

                            last_name: userData.last_name,

                            phone: userData.phone,

                            created_by: profile.id

                        }

                    }

                );

            if (response.error) {

                console.error(response.error);

                return this.error(
                    response.error.message
                );

            }

            await this.log(

                "CREATE_USER",

                `${userData.role} - ${userData.email}`

            );

            return this.success(
                response.data
            );

        }

        catch (err) {

            console.error(err);

            return this.error(
                err.message
            );

        }

    }

    /* ======================================================
       ACTIVATE USER
    ====================================================== */

    static async activateUser(id) {

        try {

            const { error } =
                await this.client

                    .from("profiles")

                    .update({

                        status: "active",

                        updated_at:
                            new Date().toISOString()

                    })

                    .eq("id", id);

            if (error) {

                return this.error(
                    error.message
                );

            }

            await this.log(

                "ACTIVATE_USER",

                id

            );

            return this.success();

        }

        catch (err) {

            console.error(err);

            return this.error(
                err.message
            );

        }

    }

    /* ======================================================
       SUSPEND USER
    ====================================================== */

    static async suspendUser(id) {

        try {

            const { error } =
                await this.client

                    .from("profiles")

                    .update({

                        status: "inactive",

                        updated_at:
                            new Date().toISOString()

                    })

                    .eq("id", id);

            if (error) {

                return this.error(
                    error.message
                );

            }

            await this.log(

                "SUSPEND_USER",

                id

            );

            return this.success();

        }

        catch (err) {

            console.error(err);

            return this.error(
                err.message
            );

        }

    }

    /* ======================================================
       UPDATE USER
    ====================================================== */

    static async updateUser(id, updates = {}) {

        try {

            updates.updated_at =
                new Date().toISOString();

            const { error } =
                await this.client

                    .from("profiles")

                    .update(updates)

                    .eq("id", id);

            if (error) {

                return this.error(
                    error.message
                );

            }

            await this.log(

                "UPDATE_USER",

                id

            );

            return this.success();

        }

        catch (err) {

            console.error(err);

            return this.error(
                err.message
            );

        }

    }

    /* ======================================================
       DELETE USER
       (Uses Edge Function)
    ====================================================== */

    static async deleteUser(id) {

        try {

            const response =
                await this.client.functions.invoke(
                    "delete-user",
                    {

                        body: {
                            id
                        }

                    }

                );

            if (response.error) {

                return this.error(
                    response.error.message
                );

            }

            await this.log(

                "DELETE_USER",

                id

            );

            return this.success();

        }

        catch (err) {

            console.error(err);

            return this.error(
                err.message
            );

        }

    }
        /* ======================================================
       UPDATE USER
    ====================================================== */

    static async updateUser(id, updates = {}) {

        try {

            updates.updated_at =
                new Date().toISOString();

            const { error } =
                await this.client
                    .from("profiles")
                    .update(updates)
                    .eq("id", id);

            if (error) {

                return this.error(error.message);

            }

            await this.log(
                "UPDATE_USER",
                id
            );

            return this.success();

        }

        catch (err) {

            console.error(err);

            return this.error(err.message);

        }

    }

    /* ======================================================
       DELETE USER
    ====================================================== */

    static async deleteUser(id) {

        try {

            const session =
                await this.session();

            if (!session) {

                return this.error(
                    "Authentication required."
                );

            }

            const response = await fetch(

                `${window.SUPABASE_URL}/functions/v1/delete-user`,

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${session.access_token}`

                    },

                    body: JSON.stringify({

                        id

                    })

                }

            );

            const result =
                await response.json();

            if (!response.ok) {

                return this.error(

                    result.error ||
                    "Unable to delete user."

                );

            }

            await this.log(

                "DELETE_USER",

                id

            );

            return this.success(result);

        }

        catch (err) {

            console.error(err);

            return this.error(err.message);

        }

    }

    /* ======================================================
       GET ALL USERS
    ====================================================== */

    static async users(role = null) {

        try {

            let query =
                this.client
                    .from("profiles")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            if (role) {

                query =
                    query.eq(
                        "role",
                        role.toLowerCase()
                    );

            }

            const {
                data,
                error
            } = await query;

            if (error) {

                console.error(error);

                return [];

            }

            return data || [];

        }

        catch (err) {

            console.error(err);

            return [];

        }

    }

    /* ======================================================
       GET USER
    ====================================================== */

    static async getUser(id) {

        try {

            const {
                data,
                error
            } =
                await this.client
                    .from("profiles")
                    .select("*")
                    .eq("id", id)
                    .single();

            if (error) {

                console.error(error);

                return null;

            }

            return data;

        }

        catch (err) {

            console.error(err);

            return null;

        }

    }

    /* ======================================================
       SEARCH USERS
    ====================================================== */

    static async search(keyword) {

        try {

            const {
                data,
                error
            } =
                await this.client
                    .from("profiles")
                    .select("*")
                    .or(

                        `first_name.ilike.%${keyword}%,
last_name.ilike.%${keyword}%,
email.ilike.%${keyword}%`

                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            if (error) {

                console.error(error);

                return [];

            }

            return data || [];

        }

        catch (err) {

            console.error(err);

            return [];

        }

    }
        /* ======================================================
       AUTH STATUS
    ====================================================== */

    static async status() {

        return {

            loggedIn:
                await this.isLoggedIn(),

            session:
                await this.session(),

            user:
                await this.user(),

            profile:
                await this.profile(),

            role:
                await this.role(),

            permissions:
                await this.permissions()

        };

    }

    /* ======================================================
       STARTUP
    ====================================================== */

    static async startup() {

        try {

            await this.init();

            const session =
                await this.session();

            if (!session) {

                return false;

            }

            await this.profile(true);

            await this.permissions(true);

            return true;

        }

        catch (err) {

            console.error(
                "Startup Error:",
                err
            );

            return false;

        }

    }

    /* ======================================================
       SUCCESS HELPER
    ====================================================== */

    static success(data = {}) {

        return {

            success: true,

            ...data

        };

    }

    /* ======================================================
       ERROR HELPER
    ====================================================== */

    static error(message) {

        return {

            success: false,

            message

        };

    }

}

/* ==========================================================
   START AUTH ENGINE
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        try {

            await Auth.startup();

            console.log(
                "Authentication Engine Started"
            );

        }

        catch (err) {

            console.error(
                "Authentication Startup Failed:",
                err
            );

        }

    }

);

/* ==========================================================
   EXPORT
========================================================== */

window.Auth = Auth;