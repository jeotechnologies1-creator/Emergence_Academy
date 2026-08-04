/*=========================================================
 EMERGENCE ACADEMY
 Authentication Engine v3.0
=========================================================*/

class Auth {

    /*=========================================
        CONFIGURATION
    =========================================*/

    static client = window.supabaseClient;

    static SESSION_KEY = "emergence_session";

    static initialized = false;

    static currentProfile = null;

    static currentPermissions = [];

    /*=========================================
        INITIALIZE
    =========================================*/

    static async init() {

        if (this.initialized) return;

        if (!this.client) {
            throw new Error("Supabase client not initialized.");
        }

        const { data } = await this.client.auth.getSession();

        window.currentSession = data.session;

        this.client.auth.onAuthStateChange(
            async (event, session) => {

                console.log("AUTH EVENT:", event);

                window.currentSession = session;

                if (event === "SIGNED_OUT") {

                    this.currentProfile = null;
                    this.currentPermissions = [];

                }

            }
        );

        this.initialized = true;

        console.log("Authentication Engine Initialized");

    }

    /*=========================================
        SESSION
    =========================================*/

    static async session() {

        const { data, error } =
            await this.client.auth.getSession();

        if (error) {

            console.error(error);

            return null;

        }

        return data.session;

    }

    /*=========================================
        USER
    =========================================*/

    static async user() {

        const { data, error } =
            await this.client.auth.getUser();

        if (error) {

            console.error(error);

            return null;

        }

        return data.user;

    }

    /*=========================================
        LOGGED IN?
    =========================================*/

    static async isLoggedIn() {

        const session =
            await this.session();

        return !!session;

    }

    /*=========================================
        REQUIRE LOGIN
    =========================================*/

    static async requireLogin() {

        const loggedIn =
            await this.isLoggedIn();

        if (!loggedIn) {

            window.location.replace("login.html");

            return false;

        }

        return true;

    }

    /*=========================================
        LOGOUT
    =========================================*/

    static async logout() {

        await this.client.auth.signOut();

        localStorage.removeItem(this.SESSION_KEY);

        sessionStorage.clear();

        window.location.replace("login.html");

    }

        /*=========================================
        LOGIN
    =========================================*/

    static async login(email, password, selectedRole = null) {

        try {

            const { data, error } =
                await this.client.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) {
                return this.error(error.message);
            }

            const profile = await this.profile();

            if (!profile) {

                await this.logout();

                return this.error(
                    "Profile not found for this account."
                );

            }

            if (profile.status !== "active") {

                await this.logout();

                return this.error(
                    "This account has been disabled."
                );

            }

            if (
                selectedRole &&
                profile.role.toLowerCase() !==
                selectedRole.toLowerCase()
            ) {

                await this.logout();

                return this.error(
                    `This account is not registered as ${selectedRole}.`
                );

            }

            return this.success({

                user: data.user,

                session: data.session,

                profile

            });

        }

        catch (err) {

            console.error(err);

            return this.error(err.message);

        }

    }
        /*=========================================
        PROFILE
    =========================================*/

    static async profile(refresh = false) {

        if (
            this.currentProfile &&
            !refresh
        ) {

            return this.currentProfile;

        }

        const user = await this.user();

        if (!user) return null;

        const { data, error } =
            await this.client
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

        if (error) {

            console.error(error);

            return null;

        }

        this.currentProfile = data;

        return data;

    }
        /*=========================================
        ROLE
    =========================================*/

    static async role() {

        const profile =
            await this.profile();

        return profile
            ? profile.role
            : null;

    }
        /*=========================================
        DISPLAY NAME
    =========================================*/

    static async displayName() {

        const profile =
            await this.profile();

        if (!profile)
            return "";

        return `${profile.first_name} ${profile.last_name}`;

    }
        /*=========================================
        INITIALS
    =========================================*/

    static async initials() {

        const profile =
            await this.profile();

        if (!profile)
            return "";

        return (

            profile.first_name.charAt(0) +

            profile.last_name.charAt(0)

        ).toUpperCase();

    }

        /*=========================================
        DASHBOARD
    =========================================*/

    static async dashboard() {

        const role =
            await this.role();

        switch (role) {

            case "super_admin":
                return "super-admin/dashboard.html";

            case "admin":
                return "admin/dashboard.html";

            case "ceo":
                return "ceo/dashboard.html";

            case "executive":
                return "executive/dashboard.html";

            case "teacher":
                return "teacher/dashboard.html";

            case "student":
                return "student/dashboard.html";

            case "parent":
                return "parent/dashboard.html";

            default:
                return "dashboard.html";

        }

    }
        /*=========================================
        STATUS
    =========================================*/

    static async status() {

        return {

            loggedIn:
                await this.isLoggedIn(),

            user:
                await this.user(),

            profile:
                await this.profile(),

            role:
                await this.role()

        };

    }
    /*=========================================
    REQUIRE ROLE
=========================================*/

static async requireRole(roles = []) {

    await this.requireLogin();

    const role = await this.role();

    if (!role) {

        window.location.replace("login.html");
        return false;

    }

    const allowed = roles.map(r => r.toLowerCase());

    if (!allowed.includes(role.toLowerCase())) {

        alert("You do not have permission to access this page.");

        window.location.replace(await this.dashboard());

        return false;

    }

    return true;

}
/*=========================================
    LOAD PERMISSIONS
=========================================*/

static async permissions(refresh = false) {

    if (
        this.currentPermissions.length &&
        !refresh
    ) {
        return this.currentPermissions;
    }

    const role = await this.role();

    if (!role) return [];

    const { data, error } = await this.client
        .from("role_permissions")
        .select("permission")
        .eq("role", role);

    if (error) {

        console.error(error);

        return [];

    }

    this.currentPermissions =
        data.map(item => item.permission);

    return this.currentPermissions;

}
/*=========================================
    HAS PERMISSION
=========================================*/

static async hasPermission(permission) {

    const permissions =
        await this.permissions();

    return permissions.includes(permission);

}

/*=========================================
    REQUIRE PERMISSION
=========================================*/

static async requirePermission(permission) {

    const allowed =
        await this.hasPermission(permission);

    if (!allowed) {

        alert("Permission denied.");

        window.location.replace(await this.dashboard());

        return false;

    }

    return true;

}

/*=========================================
    REFRESH CACHE
=========================================*/

static clearCache() {

    this.currentProfile = null;

    this.currentPermissions = [];

}

/*=========================================
    REFRESH USER DATA
=========================================*/

static async refresh() {

    this.clearCache();

    await this.profile(true);

    await this.permissions(true);

}

/*=========================================
    ACTIVITY LOG
=========================================*/

static async log(action, details = "") {

    try {

        const user = await this.user();

        if (!user) return;

        await this.client
            .from("activity_logs")
            .insert({

                user_id: user.id,

                action,

                details,

                created_at: new Date().toISOString()

            });

    }

    catch (err) {

        console.error(err);

    }

}

/*=========================================
    CREATE OFFICE ACCOUNT
=========================================*/

static async createOfficeAccount(userData) {

    try {

        const profile = await this.profile();

        if (!profile) {
            return this.error("You must be logged in.");
        }

        if (profile.role !== "admin") {
            return this.error(
                "Only the Admin can create office accounts."
            );
        }

        const {
            email,
            password,
            role,
            first_name,
            last_name,
            phone
        } = userData;

        const allowedRoles = [
            "ceo",
            "executive",
            "teacher",
            "student",
            "parent"
        ];

        if (!allowedRoles.includes(role.toLowerCase())) {

            return this.error(
                "Invalid office role."
            );

        }

        const { data, error } =
            await this.client.auth.signUp({

                email,
                password,

                options: {

                    data: {

                        role,

                        first_name,

                        last_name,

                        phone

                    }

                }

            });

        if (error) {

            return this.error(error.message);

        }

        const { error: profileError } =
            await this.client
                .from("profiles")
                .insert({

                    id: data.user.id,

                    email,

                    role,

                    first_name,

                    last_name,

                    phone,

                    status: "active",

                    created_by: profile.id,

                    created_at: new Date().toISOString()

                });

        if (profileError) {

            return this.error(profileError.message);

        }

        await this.log(
            "CREATE_ACCOUNT",
            `${role} (${email})`
        );

        return this.success({

            user: data.user,

            message:
                `${role} account created successfully.`

        });

    }

    catch (err) {

        console.error(err);

        return this.error(err.message);

    }

}
/*=========================================
    ACTIVATE ACCOUNT
=========================================*/

static async activateUser(userId) {

    const { error } =
        await this.client
            .from("profiles")
            .update({

                status: "active"

            })

            .eq("id", userId);

    if (error) {

        return this.error(error.message);

    }

    await this.log(
        "ACTIVATE_USER",
        userId
    );

    return this.success();

}

/*=========================================
    SUSPEND ACCOUNT
=========================================*/

static async suspendUser(userId) {

    const { error } =
        await this.client
            .from("profiles")
            .update({

                status: "inactive"

            })

            .eq("id", userId);

    if (error) {

        return this.error(error.message);

    }

    await this.log(
        "SUSPEND_USER",
        userId
    );

    return this.success();

}

/*=========================================
    UPDATE USER
=========================================*/

static async updateUser(userId, updates = {}) {

    updates.updated_at =
        new Date().toISOString();

    const { error } =
        await this.client
            .from("profiles")
            .update(updates)
            .eq("id", userId);

    if (error) {

        return this.error(error.message);

    }

    await this.log(
        "UPDATE_USER",
        userId
    );

    return this.success();

}

/*=========================================
    GET USERS
=========================================*/

static async users(role = null) {

    let query =
        this.client
            .from("profiles")
            .select("*")
            .order("created_at", {

                ascending: false

            });

    if (role) {

        query =
            query.eq("role", role);

    }

    const { data, error } =
        await query;

    if (error) {

        return [];

    }

    return data;

}

/*=========================================
    GET USER
=========================================*/

static async getUser(userId) {

    const { data, error } =
        await this.client
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

    if (error) {

        return null;

    }

    return data;

}

/*=========================================
    SEARCH USERS
=========================================*/

static async search(keyword) {

    const { data, error } =
        await this.client
            .from("profiles")
            .select("*")
            .or(

                `first_name.ilike.%${keyword}%,
                 last_name.ilike.%${keyword}%,
                 email.ilike.%${keyword}%`

            );

    if (error) {

        return [];

    }

    return data;

}


        /*=========================================
        REDIRECT
    =========================================*/

    static async redirect() {

        const page =
            await this.dashboard();

        window.location.replace(page);

    }


    /*=========================================
        ERROR HELPER
    =========================================*/

    static error(message) {

        return {

            success: false,

            message

        };

    }

    /*=========================================
        SUCCESS HELPER
    =========================================*/

    static success(data = {}) {

        return {

            success: true,

            ...data

        };

    }

}
/*=========================================
    START AUTH ENGINE
=========================================*/

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await Auth.init();

        }

        catch (error) {

            console.error(error);

        }

    }
);

window.Auth = Auth;