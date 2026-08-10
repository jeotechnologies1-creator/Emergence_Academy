/* ==========================================================
   EMERGENCE ACADEMY
   PROFILE SERVICE
   Version: 2.0
========================================================== */

(function () {

    "use strict";

    class ProfileService {

        static currentProfile = null;

        static async load(forceRefresh = false) {

            if (
                this.currentProfile &&
                !forceRefresh
            ) {
                return this.currentProfile;
            }

            // Auth owns the session and profile cache. This service remains a
            // compatibility facade for permission and dashboard consumers.
            const profile = await Auth.profile(forceRefresh);

            if (!profile) {
                throw new Error("Authenticated user profile not found.");
            }

            this.currentProfile = profile;

            return profile;

        }

        static async refresh() {

            return this.load(true);

        }

        static async update(data) {

            const profile = await Auth.profile();
            if (!profile?.id) throw new Error("No authenticated user.");

            const result = await ApiService.update("profiles", profile.id, data);

            this.currentProfile =
                Array.isArray(result)
                    ? result[0]
                    : result;

            return this.currentProfile;

        }

        static async get() {

            if (!this.currentProfile) {
                await this.load();
            }

            return this.currentProfile;

        }

        static async getRole() {

            const profile =
                await this.get();

            return profile?.role || null;

        }

        static async getOffice() {

            const profile =
                await this.get();

            return profile?.office || null;

        }

        static async getDepartment() {

            const profile =
                await this.get();

            return (
                profile?.department ||
                profile?.department_id ||
                null
            );

        }

        static async getFullName() {

            const profile =
                await this.get();

            return (
                [
                    profile?.first_name,
                    profile?.last_name
                ]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                profile?.email ||
                ""
            );

        }

        static async getAvatar() {

            const profile =
                await this.get();

            return (
                profile?.avatar_url ||
                profile?.profile_image ||
                null
            );

        }

        static clearCache() {

            this.currentProfile = null;

        }

    }

    window.ProfileService =
        ProfileService;

})();
