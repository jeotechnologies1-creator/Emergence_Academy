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

            const user =
                await AuthService.getUser();

            if (!user) {
                throw new Error(
                    "No authenticated user."
                );
            }

            const profile =
                await ApiService.single(
                    "profiles",
                    {
                        id: user.id
                    }
                );

            this.currentProfile = profile;

            return profile;

        }

        static async refresh() {

            return this.load(true);

        }

        static async update(data) {

            const user =
                await AuthService.getUser();

            if (!user) {
                throw new Error(
                    "No authenticated user."
                );
            }

            /*
             * IMPORTANT:
             *
             * ApiService.update()
             * expects:
             *
             * update(table, id, payload)
             */

            const result =
                await ApiService.update(
                    "profiles",
                    user.id,
                    data
                );

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
                profile?.full_name ||
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