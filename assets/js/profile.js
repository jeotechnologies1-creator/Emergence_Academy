/* ==========================================================
   EMERGENCE ACADEMY
   PROFILE MANAGEMENT
========================================================== */

const Profile = {

    currentProfile: null,

    /**
     * Get the currently authenticated Supabase user
     */
    async getCurrentUser() {

        try {

            const {
                data: { user },
                error
            } = await supabaseClient.auth.getUser();

            if (error) {
                console.error("Error getting authenticated user:", error);
                return null;
            }

            if (!user) {
                console.warn("No authenticated user found.");
                return null;
            }

            return user;

        } catch (err) {

            console.error("getCurrentUser() failed:", err);
            return null;

        }

    },



    /**
     * Load logged-in user's profile
     */
    async load() {

        try {

            const user = await this.getCurrentUser();

            if (!user) {

                this.currentProfile = null;
                window.currentProfile = null;

                return null;

            }

            const {
                data,
                error
            } = await supabaseClient
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



    /**
     * Return profile object
     */
    async getProfile() {

        if (!this.currentProfile) {

            await this.load();

        }

        return this.currentProfile;

    },



    /**
     * Return current user's role
     */
    async getRole() {

        const profile = await this.getProfile();

        return profile?.role ?? null;

    },



    /**
     * Return current user's full name
     */
    async getFullName() {

        const profile = await this.getProfile();

        return (
            profile?.full_name ||
            profile?.name ||
            ""
        );

    },



    /**
     * Return current user's department
     */
    async getDepartment() {

        const profile = await this.getProfile();

        return profile?.department ?? null;

    },



    /**
     * Refresh cached profile
     */
    async refresh() {

        this.currentProfile = null;
        window.currentProfile = null;

        return await this.load();

    }

};

window.Profile = Profile;