/* ==========================================================
   EMERGENCE ACADEMY
   AUTHENTICATION ENGINE
========================================================== */

class Auth {
    static initialized = false;
    static currentProfile = null;
    static currentPermissions = [];
    static logoutRefreshScheduled = false;
    static SESSION_KEY = "emergence_session";
    static LAST_LOGIN_ROLE_KEY = "emergence_last_login_role";
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

    static ROLE_ALIASES = {
        administrator: "admin",
        "super admin": "admin",
        super_admin: "admin",
        admissions: "admission",
        "admission office": "admission",
        exams: "exam",
        "exam office": "exam",
        librarian: "library",
        "library office": "library",
        accounting: "finance",
        accounts: "finance",
        "finance office": "finance",
        "human resources": "hr",
        human_resource: "hr"
    };

    static normalizeRole(rawRole) {
        if (typeof this.runtime.normalizeEmergenceRole === "function") {
            return this.runtime.normalizeEmergenceRole(rawRole, "");
        }
        const role = String(rawRole || "")
            .trim()
            .toLowerCase()
            .replace(/[\-_]+/g, " ")
            .replace(/\s+/g, " ");

        if (!role) {
            return "";
        }

        return this.ROLE_ALIASES[role] || role;
    }

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

        throw new Error("Supabase client is not initialized. Check SUPABASE URL, ANON KEY, and SDK load order.");
    }

    static get client() {
        return this.ensureSupabaseClient();
    }

    static refreshAfterLogout() {
        if (this.logoutRefreshScheduled) {
            return;
        }

        this.logoutRefreshScheduled = true;

        const location = this.runtime.location;
        if (!location) {
            return;
        }

        const currentPath = String(location.pathname || "").toLowerCase();

        // A logout from any tab must remove protected dashboard state. On the
        // login page, reload in place; everywhere else, replace the protected
        // page with a fresh login page so browser Back cannot reveal it.
        if (currentPath.endsWith("/login.html") || currentPath === "login.html") {
            if (typeof location.reload === "function") {
                location.reload();
            }
            return;
        }

        if (typeof location.replace === "function") {
            location.replace("login.html?logout=1");
        }
    }

    static async init() {
        if (this.initialized) return;
        if (typeof this.runtime.waitForSupabase === "function") {
            await this.runtime.waitForSupabase();
        }
        const { data, error } = await this.client.auth.getSession();
        if (error) {
            console.error(error);
        }
        this.runtime.currentSession = data?.session || null;
        const handleAuthState = async (event, session) => {
            console.log("AUTH EVENT:", event);
            this.runtime.currentSession = session;
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                this.clearCache();
            }
            if (event === "SIGNED_OUT") {
                this.clearCache();
                this.storageSession.clear();
                this.storageLocal.removeItem(this.SESSION_KEY);
                this.refreshAfterLogout();
            }
        };
        if (typeof this.runtime.addEventListener === "function") {
            this.runtime.addEventListener("supabase:auth", (event) => {
                handleAuthState(event.detail?.event, event.detail?.session);
            });
        } else {
            this.client.auth.onAuthStateChange(handleAuthState);
        }
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
        const session = await this.session();
        if (!session?.access_token) {
            return false;
        }

        // getSession() only reads the locally persisted session. Validate its
        // access token with Auth so a revoked or stale browser session cannot
        // continue into a privileged dashboard action.
        const { data, error } = await this.client.auth.getUser(session.access_token);
        if (error || !data?.user) {
            this.clearCache();
            return false;
        }

        return true;
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
        const fallbackRole = this.normalizeRole(String(
            this.resolvePreferredRole(preferredRole) ||
            user?.user_metadata?.role ||
            this.config.DEFAULT_ROLE
        ));
        return {
            id: user?.id || null,
            email: user?.email || "",
            first_name: user?.user_metadata?.first_name || user?.user_metadata?.full_name || "",
            last_name: user?.user_metadata?.last_name || "",
            role: fallbackRole || this.normalizeRole(this.config.DEFAULT_ROLE),
            status: this.config.STATUS?.ACTIVE || "active",
            created_at: new Date().toISOString(),
            source: "auth-fallback"
        };
    }

    static resolvePreferredRole(preferredRole = null) {
        const direct = this.normalizeRole(preferredRole || "");
        if (direct) return direct;

        try {
            const cachedProfileRaw = this.storageSession.getItem("profile");
            if (cachedProfileRaw) {
                const cachedProfile = JSON.parse(cachedProfileRaw);
                const cachedRole = this.normalizeRole(cachedProfile?.role || "");
                if (cachedRole) return cachedRole;
            }
        } catch (error) {
            console.error("Unable to parse cached profile role:", error);
        }

        const lastRole = this.normalizeRole(this.storageSession.getItem(this.LAST_LOGIN_ROLE_KEY) || "");
        if (lastRole) return lastRole;

        return "";
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
                // Never derive authorization from browser storage or user
                // metadata. A profile-policy failure must be repaired in RLS.
                console.error("Profile access was denied by database policy.");
                return await this.recoverProfile();
            }
            const missingProfile = message.includes("no rows") || message.includes("not found") || message.includes("could not find") || String(error.details || "").toLowerCase().includes("not found");
            if (missingProfile) {
                console.error("Profile is missing. It must be created by the database auth trigger or a trusted Edge Function.");
                return await this.recoverProfile();
            }
            console.error(error);
            return await this.recoverProfile();
        }
        this.currentProfile = data;
        this.storageSession.setItem("profile", JSON.stringify(data));
        return data;
    }

    static async recoverProfile() {
        try {
            const { data, error } = await this.client.functions.invoke("ensure-profile", { body: {} });
            if (error || !data?.profile) {
                console.error("Profile recovery failed:", error || data?.error);
                return null;
            }
            this.currentProfile = data.profile;
            this.storageSession.setItem("profile", JSON.stringify(data.profile));
            return data.profile;
        } catch (error) {
            console.error("Profile recovery request failed:", error);
            return null;
        }
    }

    static async role() {
        const profile = await this.profile();
        if (!profile) return null;
        return this.normalizeRole(profile.role || "");
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
                // Do not destroy a valid Auth session because a profile read
                // was delayed or blocked by a transient policy/network error.
                // Signing out here caused an immediate redirect that hid the
                // actionable error and affected every office portal.
                return this.error("Your account profile could not be loaded. Please try again or contact an administrator.");
            }
            const accountStatus = String(profile.status || "").trim().toLowerCase();
            if (accountStatus && accountStatus !== "active") {
                await this.client.auth.signOut();
                return this.error("This account has been disabled.");
            }
            const databaseRole = this.normalizeRole(profile.role || "");
            const loginRole = this.normalizeRole(selectedRole || "");
            if (loginRole && databaseRole !== loginRole) {
                // The role stored in the protected database is authoritative.
                // The form selection is only a convenience, never a reason to
                // sign a valid user out immediately after authentication.
                console.warn(`Selected '${loginRole}' portal, using account role '${databaseRole}' instead.`);
            }
            if (databaseRole) {
                this.storageSession.setItem(this.LAST_LOGIN_ROLE_KEY, databaseRole);
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
        this.refreshAfterLogout();
    }

    static async dashboard() {
        const role = this.normalizeRole(await this.role());
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
            const role = this.normalizeRole(profile.role);
            if (role !== "ceo" && role !== "admin") {
                return this.error("Only the CEO or Admin can create users.");
            }
            const session = await this.session();
            if (!session) {
                return this.error("Authentication session expired.");
            }

            const firstName = String(userData.first_name || "").trim();
            const lastName = String(userData.last_name || "").trim();
            const email = String(userData.email || "").trim().toLowerCase();
            const password = String(userData.password || "").trim();
            const targetRole = this.normalizeRole(userData.role || "executive");
            const phone = String(userData.phone || "").trim();

            if (!firstName || !lastName || !email || !password) {
                return this.error("First name, last name, email, and password are required.");
            }

            if (targetRole === "student") {
                return this.error("Students must be admitted from the Students module.");
            }

            const response = await this.client.functions.invoke("create-user", {
                body: {
                    email,
                    password,
                    role: targetRole,
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    parent_data: targetRole === "parent" ? userData.parent_data : undefined,
                    created_by: profile.id
                }
            });
            if (response.error) {
                console.error(response.error);

                let message = response.error.message || "Unable to create office account.";
                let statusCode = null;

                try {
                    const ctx = response.error.context;
                    if (ctx) {
                        statusCode = ctx.status || null;
                        const rawText = await ctx.clone().text();
                        if (rawText) {
                            try {
                                const details = JSON.parse(rawText);
                                message = details?.error || details?.message || message;
                            } catch {
                                message = rawText;
                            }
                        }
                    }
                } catch (parseError) {
                    console.error("Unable to parse edge function error payload:", parseError);
                }

                if (String(message).includes("non-2xx")) {
                    message = "Create-user function failed (non-2xx). Check function deployment, env secrets, or if the email already exists.";
                }

                if (statusCode) {
                    message = `Create-user failed (${statusCode}): ${message}`;
                }

                return this.error(message);
            }
            await this.log("CREATE_USER", `${targetRole} - ${email}`);
            return this.success(response.data || { message: "User created successfully." });
        } catch (err) {
            console.error(err);
            return this.error(err.message || "Unable to create office account.");
        }
    }

    static async changeInitialOfficePassword(password) {
        const value = String(password || "").trim();
        if (value.length < 8) {
            return this.error("Use at least 8 characters for your new password.");
        }
        try {
            const { data, error } = await this.client.functions.invoke("create-user", {
                body: { operation: "change-initial-password", password: value }
            });
            if (error) {
                let message = error.message || "Unable to change password.";
                try {
                    const raw = await error.context?.clone()?.text();
                    message = JSON.parse(raw || "{}")?.error || message;
                } catch (_) { /* use the function error message */ }
                return this.error(message);
            }
            if (data?.error) return this.error(data.error);
            this.currentProfile = { ...(this.currentProfile || {}), must_change_password: false };
            this.storageSession.setItem("profile", JSON.stringify(this.currentProfile));
            return this.success(data || {});
        } catch (error) {
            console.error(error);
            return this.error(error.message || "Unable to change password.");
        }
    }

    static async enforceInitialOfficePasswordChange(profile) {
        if (!profile?.must_change_password || document.getElementById("initial-password-modal")) return;
        const modal = document.createElement("div");
        modal.id = "initial-password-modal";
        modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4";
        modal.innerHTML = `
          <form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" id="initial-password-form">
            <h2 class="text-xl font-bold text-slate-900">Create your personal password</h2>
            <p class="mt-2 text-sm text-slate-600">Your administrator issued a temporary password. Replace it now to continue to the dashboard.</p>
            <label class="mt-5 block text-sm font-medium text-slate-700">New password
              <input name="password" type="password" minlength="8" required autocomplete="new-password" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
            </label>
            <label class="mt-4 block text-sm font-medium text-slate-700">Confirm new password
              <input name="confirm_password" type="password" minlength="8" required autocomplete="new-password" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
            </label>
            <p data-password-error class="hidden mt-3 rounded bg-red-50 p-3 text-sm text-red-700"></p>
            <button class="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700">Save password and continue</button>
          </form>`;
        document.body.appendChild(modal);
        const form = modal.querySelector("form");
        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const values = new FormData(form);
            const password = String(values.get("password") || "");
            const errorBox = form.querySelector("[data-password-error]");
            if (password !== String(values.get("confirm_password") || "")) {
                errorBox.textContent = "The passwords do not match.";
                errorBox.classList.remove("hidden");
                return;
            }
            const submit = form.querySelector("button");
            submit.disabled = true;
            const result = await this.changeInitialOfficePassword(password);
            if (!result.success) {
                errorBox.textContent = result.message;
                errorBox.classList.remove("hidden");
                submit.disabled = false;
                return;
            }
            modal.remove();
            window.Utils?.success?.("Your password has been updated.");
        });
    }

    static async log(action, description = "") {
        try {
            const user = await this.user();
            if (!user) return;
            await this.client
                .from("activity_logs")
                .insert({
                    user_id: user.id,
                    action,
                    description,
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
            await this.profile(true, this.resolvePreferredRole());
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
