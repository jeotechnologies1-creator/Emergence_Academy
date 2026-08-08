/* ==========================================================
   EMERGENCE ACADEMY
   PERMISSION SERVICE
   Version: 2.0
========================================================== */

(function () {

    "use strict";

    class PermissionService {

        static permissions = [];

        static loaded = false;

        static DEFAULTS = {

            ceo: [
                "users.view",
                "users.create",
                "users.edit",
                "users.delete",
                "students.view",
                "students.create",
                "students.edit",
                "students.delete",
                "teachers.view",
                "teachers.create",
                "teachers.edit",
                "teachers.delete",
                "parents.view",
                "parents.create",
                "parents.edit",
                "parents.delete",
                "attendance.view",
                "attendance.create",
                "attendance.edit",
                "assignments.view",
                "assignments.create",
                "assignments.edit",
                "grades.view",
                "grades.create",
                "grades.edit",
                "finance.view",
                "finance.create",
                "finance.edit",
                "reports.view",
                "notifications.view",
                "notifications.create",
                "ai.view"
            ],

            admin: [
                "users.view",
                "users.create",
                "users.edit",
                "users.delete",
                "students.view",
                "students.create",
                "students.edit",
                "students.delete",
                "teachers.view",
                "teachers.create",
                "teachers.edit",
                "teachers.delete",
                "parents.view",
                "parents.create",
                "parents.edit",
                "parents.delete",
                "attendance.view",
                "attendance.create",
                "attendance.edit",
                "assignments.view",
                "assignments.create",
                "assignments.edit",
                "grades.view",
                "grades.create",
                "grades.edit",
                "finance.view",
                "finance.create",
                "finance.edit",
                "reports.view",
                "notifications.view",
                "notifications.create",
                "ai.view"
            ],

            executive: [
                "users.view",
                "students.view",
                "students.edit",
                "teachers.view",
                "teachers.create",
                "teachers.edit",
                "parents.view",
                "attendance.view",
                "assignments.view",
                "grades.view",
                "finance.view",
                "reports.view",
                "notifications.view",
                "ai.view"
            ],

            teacher: [
                "students.view",
                "attendance.view",
                "attendance.create",
                "attendance.edit",
                "assignments.view",
                "assignments.create",
                "assignments.edit",
                "grades.view",
                "grades.create",
                "grades.edit",
                "notifications.view",
                "ai.view"
            ],

            student: [
                "assignments.view",
                "grades.view",
                "attendance.view",
                "notifications.view",
                "ai.view"
            ],

            parent: [
                "students.view",
                "attendance.view",
                "grades.view",
                "finance.view",
                "reports.view",
                "notifications.view",
                "ai.view"
            ],

            finance: [
                "finance.view",
                "finance.create",
                "finance.edit",
                "reports.view",
                "notifications.view"
            ],

            hr: [
                "teachers.view",
                "teachers.create",
                "teachers.edit",
                "reports.view",
                "notifications.view"
            ],

            admission: [
                "students.view",
                "students.create",
                "students.edit",
                "parents.view",
                "parents.create",
                "reports.view",
                "notifications.view"
            ],

            exam: [
                "assignments.view",
                "grades.view",
                "grades.create",
                "grades.edit",
                "reports.view",
                "notifications.view"
            ],

            library: [
                "students.view",
                "teachers.view",
                "notifications.view"
            ]

        };

        static async load(forceRefresh = false) {

            if (
                this.loaded &&
                !forceRefresh
            ) {
                return this.permissions;
            }

            const profile =
                await ProfileService.get();

            if (!profile) {

                this.permissions = [];
                this.loaded = true;

                return [];

            }

            const role =
                String(profile.role || "")
                    .trim()
                    .toLowerCase();

            /*
             * Attempt database permissions.
             */

            try {

                const roleRecord =
                    await ApiService.single(
                        "roles",
                        {
                            name: role
                        }
                    );

                if (roleRecord?.id) {

                    const links =
                        await ApiService.select(
                            "role_permissions",
                            {
                                filters: {
                                    role_id:
                                        roleRecord.id
                                }
                            }
                        );

                    const permissionIds =
                        links.map(
                            (item) =>
                                item.permission_id
                        );

                    if (permissionIds.length) {

                        const allPermissions =
                            await ApiService.select(
                                "permissions"
                            );

                        const databasePermissions =
                            allPermissions
                                .filter(
                                    (item) =>
                                        permissionIds.includes(
                                            item.id
                                        )
                                )
                                .map(
                                    (item) =>
                                        item.name
                                )
                                .filter(Boolean);

                        if (
                            databasePermissions.length
                        ) {

                            this.permissions =
                                databasePermissions;

                            this.loaded = true;

                            return this.permissions;

                        }

                    }

                }

            } catch (error) {

                console.warn(
                    "Database permission tables unavailable; using role defaults.",
                    error
                );

            }

            /*
             * Application fallback.
             */

            this.permissions =
                [
                    ...(this.DEFAULTS[role] || [])
                ];

            this.loaded = true;

            return this.permissions;

        }

        static async can(permission) {

            await this.load();

            return this.permissions.includes(
                permission
            );

        }

        static async cannot(permission) {

            return !(await this.can(permission));

        }

        static async canAny(permissionList = []) {

            await this.load();

            return permissionList.some(
                (permission) =>
                    this.permissions.includes(
                        permission
                    )
            );

        }

        static async canAll(permissionList = []) {

            await this.load();

            return permissionList.every(
                (permission) =>
                    this.permissions.includes(
                        permission
                    )
            );

        }

        static async list() {

            await this.load();

            return [
                ...this.permissions
            ];

        }

        static clear() {

            this.permissions = [];

            this.loaded = false;

        }

    }

    window.PermissionService =
        PermissionService;

})();