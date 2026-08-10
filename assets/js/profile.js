/* ==========================================================
   PROFILE COMPATIBILITY API
   Auth is the single source of truth for the current profile.
========================================================== */

const Profile = {
    currentProfile: null,

    async getCurrentUser() {
        return window.Auth?.currentUser?.() || null;
    },

    async load(refresh = false) {
        const profile = await window.Auth?.profile?.(refresh) || null;
        this.currentProfile = profile;
        window.currentProfile = profile;
        return profile;
    },

    async getProfile() {
        return this.currentProfile || this.load();
    },

    async getRole() {
        return (await this.getProfile())?.role || null;
    },

    async getFullName() {
        const profile = await this.getProfile();
        return `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
            || profile?.email || "";
    },

    async getDepartment() {
        return (await this.getProfile())?.department_id || null;
    },

    async refresh() {
        return this.load(true);
    }
};

window.Profile = Profile;
