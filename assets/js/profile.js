/* ==========================================================
   EMERGENCE ACADEMY
   PROFILE MANAGEMENT
========================================================== */

const Profile = {
    currentProfile: null,
    async getCurrentUser() {
        try {
            const { data, error } = await window.supabaseClient.auth.getUser();
            if (error) {
                console.error("Error getting authenticated user:", error);
                return null;
            }
            return data.user || null;
        } catch (err) {
            console.error("getCurrentUser() failed:", err);
            return null;
        }
    },
    async load() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                this.currentProfile = null;
                window.currentProfile = null;
                return null;
            }
            const { data, error } = await window.supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();
            if (error) {
                console.error("Profile loading error:", error);
                this.currentProfile = null;
                window.currentProfile = null;
                return null;
            }
            this.currentProfile = data;
            window.currentProfile = data;
            return data;
        } catch (err) {
            console.error("Profile.load() failed:", err);
            this.currentProfile = null;
            window.currentProfile = null;
            return null;
        }
    },
    async getProfile() {
        if (!this.currentProfile) {
            await this.load();
        }
        return this.currentProfile;
    },
    async getRole() {
        const profile = await this.getProfile();
        return profile?.role ?? null;
    },
    async getFullName() {
        const profile = await this.getProfile();
        return profile?.first_name || profile?.name || "";
    },
    async getDepartment() {
        const profile = await this.getProfile();
        return profile?.department ?? null;
    },
    async refresh() {
        this.currentProfile = null;
        window.currentProfile = null;
        return await this.load();
    }
};

window.Profile = Profile;
