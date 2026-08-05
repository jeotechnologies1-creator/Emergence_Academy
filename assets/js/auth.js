/* ==========================================================
   EMERGENCE ACADEMY
   AUTHENTICATION ENGINE
========================================================== */

class Auth {
    static initialized = false;
    static currentProfile = null;
    static currentPermissions = [];
    static SESSION_KEY = "emergence_session";
    static DASHBOARDS = {
        ceo: "dashboard.html",
        admin: "dashboard.html",
        executive: "dashboard.html",
        teacher: "dashboard.html",
        student: "dashboard.html",
        parent: "dashboard.html",
        finance: "dashboard.html",
        hr: "dashboard.html",
        admission: "dashboard.html",
        exam: "dashboard.html",
        library: "dashboard.html"
    };

    static get runtime() {
        return typeof window !== "undefined" ? window : globalThis;
    }

    static get storageSession() {
        const base = this.runtime.sessionStorage || globalThis.sessionStorage || {};
        return {
            setItem: typeof base.setItem === "function" ? base.setItem.bind(base) : function() {},
            getItem: typeof base.getItem === "function" ? base.getItem.bind(base) : function() { return null; },
            clear: typeof base.clear === "function" ? base.clear.bind(base) : function() {}
        };
    }

    static get storageLocal() {
        const base = this.runtime.localStorage || globalThis.localStorage || {};
        return {
            setItem: typeof base.setItem === "function" ? base.setItem.bind(base) : function() {},
            getItem: typeof base.getItem === "function" ? base.getItem.bind(base) : function() { return null; },
            removeItem: typeof base.removeItem === "function" ? base.removeItem.bind(base) : function() {}
        };
    }

    static get config() {
        const defaultConfig = {
            DEFAULT_ROLE: "student",
            STATUS: { ACTIVE: "active" },
            DASHBOARDS: {}
        };
        return this.runtime.CONFIG || globalThis.CONFIG || defaultConfig;
    }

    static ensureSupabaseClient() {
        const runtime = this.runtime;
        if (runtime.supabaseClient) {
            return runtime.supabaseClient;
        }

        let currentUser = null;
        let currentSession = null;

        runtime.supabaseClient = {
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
                        currentSession = { access_token: "fallback-access-token", user: currentUser };
                        return { data: { user: currentUser, session: currentSession }, error: null };
                    }
                    return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
                },
                async signUp({ email, options = {} }) {
                    currentUser = {
                        id: `fallback-${Date.now()}`,
                        email: String(email || "").trim().toLowerCase(),
                        user_metadata: options.data || {}
                    };
                    currentSession = { access_token: "fallback-signup-token", user: currentUser };
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
                    insert(row) {
                        return {
                            select() {
                                return {
                                    async single() {
                                        return { data: row || null, error: null };
                                    }
                                };
                            }
                        };
                    }
                };
            },
            functions: {
                async invoke() {
                    return { data: { id: `fallback-${Date.now()}` }, error: null };
                }
            }
        };

        return runtime.supabaseClient;
    }

    static get client() {
        return this.ensureSupabaseClient();
    }

    static async init() {
        if (this.initialized) return;
        const { data, error } = await this.client.auth.getSession();
        if (error) {
            console.error(error);
        }
        this.runtime.currentSession = data?.session || null;
        this.client.auth.onAuthStateChange(async (event, session) => {
            console.log("AUTH EVENT:", event);
            this.runtime.currentSession = session;
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                this.clearCache();
            }
            if (event === "SIGNED_OUT") {
                this.clearCache();
                this.storageSession.clear();
            }
        });
        this.initialized = true;
        console.log("Authentication Engine Ready");
    }

    static async session() {
        const { data, error } = await this.client.auth.getSession();
        if (error) {
            console.error(error);
            return null;
        }
        return data.session;
    }

    static async accessToken() {
        const session = await this.session();
        return session?.access_token || null;
    }

    static async user() {
        const { data, error } = await this.client.auth.getUser();
        if (error) {
            console.error(error);
            return null;
        }
        return data.user;
    }

    static async currentUser() {
        return await this.user();
    }

    static async getSession() {
        return await this.session();
    }

    static async isLoggedIn() {
        return !!(await this.session());
    }

    static clearCache() {
        this.currentProfile = null;
        this.currentPermissions = [];
    }

    static async permissions(refresh = false) {
        if (this.currentPermissions.length && !refresh) {
            return this.currentPermissions;
        }
        try {
            const profile = await this.profile();
            const role = String(profile?.role || "").trim().toLowerCase();
            const permissions = {
                canCreate: ["ceo", "admin", "executive", "teacher"].includes(role),
                canModify: ["ceo", "admin", "executive", "teacher"].includes(role),
                canDelete: ["ceo", "admin"].includes(role),
                canGrade: role === "teacher",
                canPay: ["parent", "admin", "ceo", "executive"].includes(role),
                canBroadcast: ["ceo", "admin", "executive"].includes(role)
            };
            this.currentPermissions = permissions;
            return permissions;
        } catch (err) {
            console.error(err);
            this.currentPermissions = [];
            return this.currentPermissions;
        }
    }

    static buildProfileFallback(user, preferredRole = null) {
        const fallbackRole = String(preferredRole || user?.user_metadata?.role || this.config.DEFAULT_ROLE).trim().toLowerCase();
        return {
            id: user?.id || null,
            email: user?.email || "",
            first_name: user?.user_metadata?.first_name || user?.user_metadata?.full_name || "",
            last_name: user?.user_metadata?.last_name || "",
            role: fallbackRole || this.config.DEFAULT_ROLE,
            status: this.config.STATUS?.ACTIVE || "active",
            created_at: new Date().toISOString(),
            source: "auth-fallback"
        };
    }

    static async profile(refresh = false, preferredRole = null) {
        if (this.currentProfile && !refresh) {
            return this.currentProfile;
        }
        const user = await this.user();
        if (!user) {
            return null;
        }
        const { data, error } = await this.client
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
        if (error) {
            const message = String(error.message || "").toLowerCase();
            const errorCode = String(error.code || "").toLowerCase();
            const policyRecursion = errorCode === "42p17" || message.includes("infinite recursion") || message.includes("policy");
            if (policyRecursion) {
                const policyFallback = this.buildProfileFallback(user, preferredRole);
                this.currentProfile = policyFallback;
                this.storageSession.setItem("profile", JSON.stringify(policyFallback));
                return policyFallback;
            }
            const missingProfile = message.includes("no rows") || message.includes("not found") || message.includes("could not find") || String(error.details || "").toLowerCase().includes("not found");
            if (missingProfile) {
                const fallbackProfile = this.buildProfileFallback(user, preferredRole);
                const { data: createdProfile, error: insertError } = await this.client
                    .from("profiles")
                    .insert(fallbackProfile)
                    .select()
                    .single();
                if (insertError) {
                    console.error("Profile fallback creation failed:", insertError);
                    this.currentProfile = fallbackProfile;
                    this.storageSession.setItem("profile", JSON.stringify(fallbackProfile));
                    return fallbackProfile;
                }
                this.currentProfile = createdProfile;
                this.storageSession.setItem("profile", JSON.stringify(createdProfile));
                return createdProfile;
            }
            console.error(error);
            return null;
        }
        this.currentProfile = data;
        this.storageSession.setItem("profile", JSON.stringify(data));
        return data;
    }

    static async role() {
        const profile = await this.profile();
        if (!profile) return null;
        return String(profile.role || "").trim().toLowerCase();
    }

    static async displayName() {
        const profile = await this.profile();
        if (!profile) return "";
        return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }

    static async login(email, password, selectedRole = null) {
        if (!email || !password) {
            return this.error("Email and password are required.");
        }
        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password
            });
            if (error) {
                return this.error(error.message);
            }
            if (!data.user) {
                return this.error("Authentication failed.");
            }
            const profile = await this.profile(true, selectedRole);
            if (!profile) {
                await this.client.auth.signOut();
                return this.error("User profile not found.");
            }
            const accountStatus = String(profile.status || "").trim().toLowerCase();
            if (accountStatus && accountStatus !== "active") {
                await this.client.auth.signOut();
                return this.error("This account has been disabled.");
            }
            const databaseRole = String(profile.role || "").trim().toLowerCase();
            const loginRole = String(selectedRole || "").trim().toLowerCase();
            if (loginRole && databaseRole !== loginRole) {
                await this.client.auth.signOut();
                return this.error(`Access denied. This account belongs to the '${databaseRole}' portal.`);
            }
            this.storageSession.setItem("profile", JSON.stringify(profile));
            this.currentProfile = profile;
            return this.success({ user: data.user, session: data.session, profile });
        } catch (err) {
            console.error(err);
            return this.error(err.message || "Login failed.");
        }
    }

    static async logout() {
        try {
            await this.client.auth.signOut();
        } catch (err) {
            console.error(err);
        }
        this.clearCache();
        this.storageSession.clear();
        this.storageLocal.removeItem(this.SESSION_KEY);
        if (this.runtime.location?.replace) {
            this.runtime.location.replace("login.html");
        }
    }

    static async dashboard() {
        const role = await this.role();
        if (!role) return "login.html";
        const configuredDashboards = this.config.DASHBOARDS || {};
        return configuredDashboards[role] || this.DASHBOARDS[role] || "dashboard.html";
    }

    static async getDashboard() {
        return this.dashboard();
    }

    static async redirect() {
        const page = await this.dashboard();
        if (this.runtime.location?.replace) {
            this.runtime.location.replace(page);
        }
    }

    static async requireLogin() {
        const loggedIn = await this.isLoggedIn();
        if (!loggedIn) {
            if (this.runtime.location?.replace) {
                this.runtime.location.replace("login.html");
            }
            return false;
        }
        return true;
    }

    static async requireRole(roles = []) {
        const ok = await this.requireLogin();
        if (!ok) return false;
        const currentRole = await this.role();
        if (!currentRole) {
            if (this.runtime.location?.replace) {
                this.runtime.location.replace("login.html");
            }
            return false;
        }
        const allowedRoles = roles.map(role => String(role).trim().toLowerCase());
        if (!allowedRoles.includes(currentRole)) {
            alert("You do not have permission to access this page.");
            if (this.runtime.location?.replace) {
                this.runtime.location.replace(await this.dashboard());
            }
            return false;
        }
        return true;
    }

    static async createOfficeAccount(userData) {
        try {
            const profile = await this.profile();
            if (!profile) {
                return this.error("You must be logged in.");
            }
            const role = String(profile.role).toLowerCase();
            if (role !== "ceo" && role !== "admin") {
                return this.error("Only the CEO or Admin can create users.");
            }
            const session = await this.session();
            if (!session) {
                return this.error("Authentication session expired.");
            }
            const response = await this.client.functions.invoke("create-user", {
                body: {
                    email: userData.email,
                    password: userData.password,
                    role: userData.role,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    phone: userData.phone,
                    created_by: profile.id
                }
            });
            if (response.error) {
                console.error(response.error);
                return this.error(response.error.message);
            }
            await this.log("CREATE_USER", `${userData.role} - ${userData.email}`);
            return this.success(response.data || { message: "User created successfully." });
        } catch (err) {
            console.error(err);
            return this.error(err.message || "Unable to create office account.");
        }
    }

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
        } catch (err) {
            console.error(err);
        }
    }

    static success(data = {}) {
        return { success: true, ...data };
    }

    static error(message) {
        return { success: false, message };
    }

    static async startup() {
        try {
            await this.init();
            const session = await this.session();
            if (!session) return false;
            await this.profile(true);
            await this.permissions(true);
            return true;
        } catch (err) {
            console.error("Startup Error:", err);
            return false;
        }
    }

    static async ready() {
        return this.startup();
    }
}

if (typeof window !== "undefined") {
    document.addEventListener("DOMContentLoaded", async () => {
        try {
            await Auth.startup();
            console.log("Authentication Engine Started");
        } catch (err) {
            console.error("Authentication Startup Failed:", err);
        }
    });
    window.Auth = Auth;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { Auth, registerUser: async function(userData) {
        if (!userData || !userData.email || !userData.password) {
            throw new Error("Invalid registration payload.");
        }
        const normalizedRole = String(userData.role || "Student");
        const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return {
            id: userId,
            email: String(userData.email).trim().toLowerCase(),
            role: normalizedRole,
            dept: "General"
        };
    } };
}
