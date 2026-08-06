// /* ==========================================================
//    EMERGENCE ACADEMY
//    PERMISSION SERVICE
// ========================================================== */

// (function () {

//     "use strict";

//     class PermissionService {

//         static cache = [];

//         static loaded = false;

//         static async load(force = false) {

//             if (this.loaded && !force) {
//                 return this.cache;
//             }

//             const profile = await ProfileService.get();

//             if (!profile) {
//                 throw new Error("Profile not found.");
//             }

//             /* Find matching role */

//             const role = await ApiService.single("roles", {
//                 name: profile.role
//             });

//             if (!role) {

//                 this.cache = [];

//                 this.loaded = true;

//                 return [];

//             }

//             /* Load role_permissions */

//             const links = await ApiService.select("role_permissions", {
//                 filters: {
//                     role_id: role.id
//                 }
//             });

//             if (!links.length) {

//                 this.cache = [];

//                 this.loaded = true;

//                 return [];

//             }

//             const permissionIds =
//                 links.map(x => x.permission_id);

//             const permissions = [];

//             for (const id of permissionIds) {

//                 const permission =
//                     await ApiService.single("permissions", {
//                         id
//                     });

//                 if (permission) {

//                     permissions.push(permission.name);

//                 }

//             }

//             this.cache = permissions;

//             this.loaded = true;

//             return permissions;

//         }

//         static async can(permission) {

//             await this.load();

//             return this.cache.includes(permission);

//         }

//         static async cannot(permission) {

//             return !(await this.can(permission));

//         }

//         static async canAny(permissionList = []) {

//             await this.load();

//             return permissionList.some(x =>
//                 this.cache.includes(x)
//             );

//         }

//         static async canAll(permissionList = []) {

//             await this.load();

//             return permissionList.every(x =>
//                 this.cache.includes(x)
//             );

//         }

//         static async list() {

//             await this.load();

//             return [...this.cache];

//         }

//         static clear() {

//             this.cache = [];

//             this.loaded = false;

//         }

//     }

//     window.PermissionService = PermissionService;

// })();

/* ==========================================================
   EMERGENCE ACADEMY
   PERMISSION SERVICE
   Production Version
========================================================== */

(function () {

    "use strict";

    class PermissionService {

        static permissions = [];

        static loaded = false;

        static async load(forceRefresh = false) {

            if (this.loaded && !forceRefresh) {
                return this.permissions;
            }

            const profile = await ProfileService.get();

            if (!profile) {
                throw new Error("User profile not found.");
            }

            /* Get Role */

            const role = await ApiService.single("roles", {
                name: profile.role
            });

            if (!role) {

                this.permissions = [];
                this.loaded = true;

                return [];

            }

            /* Get role_permissions */

            const rolePermissions =
                await ApiService.select("role_permissions", {
                    filters: {
                        role_id: role.id
                    }
                });

            if (!rolePermissions.length) {

                this.permissions = [];
                this.loaded = true;

                return [];

            }

            const ids =
                rolePermissions.map(x => x.permission_id);

            /* Get ALL permissions once */

            const allPermissions =
                await ApiService.select("permissions");

            this.permissions =
                allPermissions
                    .filter(x => ids.includes(x.id))
                    .map(x => x.name);

            this.loaded = true;

            return this.permissions;

        }

        static async can(permission) {

            await this.load();

            return this.permissions.includes(permission);

        }

        static async canAny(permissionList = []) {

            await this.load();

            return permissionList.some(permission =>
                this.permissions.includes(permission)
            );

        }

        static async canAll(permissionList = []) {

            await this.load();

            return permissionList.every(permission =>
                this.permissions.includes(permission)
            );

        }

        static async list() {

            await this.load();

            return [...this.permissions];

        }

        static clear() {

            this.permissions = [];
            this.loaded = false;

        }

    }

    window.PermissionService = PermissionService;

})();