/* ==========================================================
   EMERGENCE ACADEMY
   PROFILE MANAGEMENT
   Unified Profile Adapter
========================================================== */

(function () {

    "use strict";

    const Profile = {

        currentProfile: null,

        async getCurrentUser() {

            try {

                if (typeof window.waitForSupabase === "function") {
                    await window.waitForSupabase();
                }

                if (window.Auth?.user) {
                    return await Auth.user();
                }

                if (!window.supabaseClient) {
                    return null;
                }

                const { data, error } =
                    await window.supabaseClient.auth.getUser();

                if (error) {
                    console.error(
                        "Error getting authenticated user:",
                        error
                    );

                    return null;
                }

                return data?.user || null;

            } catch (error) {

                console.error(
                    "Profile.getCurrentUser() failed:",
                    error
                );

                return null;

            }

        },

        async load(refresh = false) {

            try {

                if (
                    this.currentProfile &&
                    !refresh
                ) {
                    return this.currentProfile;
                }

                if (window.Auth?.profile) {

                    const profile =
                        await Auth.profile(refresh);

                    this.currentProfile =
                        profile || null;

                    window.currentProfile =
                        this.currentProfile;

                    return this.currentProfile;
                }

                const user =
                    await this.getCurrentUser();

                if (!user) {

                    this.currentProfile = null;
                    window.currentProfile = null;

                    return null;

                }

                const { data, error } =
                    await window.supabaseClient
                        .from("profiles")
                        .select("*")
                        .eq("id", user.id)
                        .single();

                if (error) {
                    throw error;
                }

                this.currentProfile = data;
                window.currentProfile = data;

                return data;

            } catch (error) {

                console.error(
                    "Profile.load() failed:",
                    error
                );

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

            const profile =
                await this.getProfile();

            return profile?.role || null;

        },

        async getFullName() {

            const profile =
                await this.getProfile();

            if (!profile) {
                return "";
            }

            return (
                profile.full_name ||
                [
                    profile.first_name,
                    profile.last_name
                ]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                profile.name ||
                profile.email ||
                ""
            );

        },

        async getDepartment() {

            const profile =
                await this.getProfile();

            return (
                profile?.department ||
                profile?.department_id ||
                null
            );

        },

        async refresh() {

            this.currentProfile = null;
            window.currentProfile = null;

            return await this.load(true);

        },

        clear() {

            this.currentProfile = null;
            window.currentProfile = null;

        }

    };

    window.Profile = Profile;

})();