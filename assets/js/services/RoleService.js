/* ==========================================================
   EMERGENCE ACADEMY
   ROLE SERVICE
   Version: 1.0.0
========================================================== */

(function () {

    "use strict";

    class RoleService {

        static currentRole = null;

        static async load(forceRefresh = false) {

            if (this.currentRole && !forceRefresh) {
                return this.currentRole;
            }

            const profile = await ProfileService.get();

            if (!profile) {
                throw new Error("Profile not found.");
            }

            const roleName = profile.role;

            if (!roleName) {
                throw new Error("User has no assigned role.");
            }

            const role = await ApiService.single("roles", {
                name: roleName
            });

            this.currentRole = role;

            return role;

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

            const role = await this.get();

            return role.name;

        }

        static async getId() {

            const role = await this.get();

            return role.id;

        }

        static async getDescription() {

            const role = await this.get();

            return role.description || "";

        }

        static async is(roleName) {

            const role = await this.get();

            return role.name === roleName;

        }

        static async isOneOf(roleNames = []) {

            const role = await this.get();

            return roleNames.includes(role.name);

        }

        static clearCache() {

            this.currentRole = null;

        }

    }

    window.RoleService = RoleService;

})();