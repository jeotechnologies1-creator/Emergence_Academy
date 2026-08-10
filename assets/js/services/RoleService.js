/* ==========================================================
   EMERGENCE ACADEMY
   ROLE SERVICE
   Version: 2.0
========================================================== */

(function () {

    "use strict";

    class RoleService {

        static currentRole = null;

        static normalize(role) {

            if (typeof window.normalizeEmergenceRole === "function") {
                return window.normalizeEmergenceRole(role, "");
            }

            return String(role || "")
                .trim()
                .toLowerCase()
                .replace(/[\-_]+/g, " ")
                .replace(/\s+/g, " ");

        }

        static async load(forceRefresh = false) {

            if (
                this.currentRole &&
                !forceRefresh
            ) {
                return this.currentRole;
            }

            const profile =
                await ProfileService.get();

            if (!profile) {

                throw new Error(
                    "Authenticated user profile not found."
                );

            }

            const roleName =
                this.normalize(profile.role);

            if (!roleName) {

                throw new Error(
                    "User has no assigned role."
                );

            }

            /*
             * Try the roles table first.
             *
             * If the table does not exist,
             * is blocked by RLS, or does not
             * contain this role, we still use
             * profiles.role.
             */

            try {

                const role =
                    await ApiService.single(
                        "roles",
                        {
                            name: roleName
                        }
                    );

                if (role) {

                    this.currentRole = role;

                    return role;

                }

            } catch (error) {

                console.warn(
                    "Roles table unavailable; using profiles.role.",
                    error
                );

            }

            this.currentRole = {

                id: null,

                name: roleName,

                description: "",

                source: "profiles"

            };

            return this.currentRole;

        }

        static async refresh() {

            return this.load(true);

        }

        static async get() {

            if (!this.currentRole) {
                await this.load();
            }

            return this.currentRole;

        }

        static async getName() {

            const role =
                await this.get();

            return role?.name || null;

        }

        static async getId() {

            const role =
                await this.get();

            return role?.id || null;

        }

        static async getDescription() {

            const role =
                await this.get();

            return role?.description || "";

        }

        static async is(roleName) {

            const current =
                await this.getName();

            return (
                this.normalize(current) ===
                this.normalize(roleName)
            );

        }

        static async isOneOf(roleNames = []) {

            const current =
                this.normalize(await this.getName());

            return roleNames
                .map((role) => this.normalize(role))
                .includes(current);

        }

        static clearCache() {

            this.currentRole = null;

        }

    }

    window.RoleService = RoleService;

})();
