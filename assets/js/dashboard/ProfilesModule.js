/* ==========================================================
   EMERGENCE ACADEMY
   PROFILES MODULE
========================================================== */

(function () {

    "use strict";

    class ProfilesModule {

        static async render(container) {

            container.innerHTML = `
                <div class="space-y-6">

                    <div class="flex justify-between items-center">

                        <div>
                            <h1 class="text-3xl font-bold">
                                User Profiles
                            </h1>

                            <p class="text-gray-500">
                                Manage all registered users.
                            </p>
                        </div>

                        <button
                            id="create-user-btn"
                            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                            + Create User
                        </button>

                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Total Users</h4>
                            <h2 id="total-users" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Students</h4>
                            <h2 id="student-count" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Teachers</h4>
                            <h2 id="teacher-count" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Parents</h4>
                            <h2 id="parent-count" class="text-3xl font-bold">0</h2>
                        </div>

                        <div class="bg-white rounded-lg shadow p-5">
                            <h4 class="text-gray-500">Administrators</h4>
                            <h2 id="admin-count" class="text-3xl font-bold">0</h2>
                        </div>

                    </div>

                    <div class="bg-white rounded-xl shadow p-6">

                        <div class="flex gap-4 mb-6">

                            <input
                                id="profile-search"
                                type="text"
                                placeholder="Search users..."
                                class="border rounded-lg px-4 py-2 flex-1"
                            >

                            <select
                                id="role-filter"
                                class="border rounded-lg px-4 py-2"
                            >
                                <option value="">All Roles</option>
                            </select>

                            <select
                                id="status-filter"
                                class="border rounded-lg px-4 py-2"
                            >
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                                <option value="suspended">Suspended</option>
                            </select>

                        </div>

                        <div class="overflow-auto">

                            <table class="min-w-full text-sm">

                                <thead class="bg-gray-100">

                                    <tr>

                                        <th class="p-3 text-left">Photo</th>

                                        <th class="p-3 text-left">Name</th>

                                        <th class="p-3 text-left">Email</th>

                                        <th class="p-3 text-left">Role</th>

                                        <th class="p-3 text-left">Phone</th>

                                        <th class="p-3 text-left">Status</th>

                                        <th class="p-3 text-left">Actions</th>

                                    </tr>

                                </thead>

                                <tbody id="profiles-table">

                                </tbody>

                            </table>

                        </div>

                    </div>

                </div>
            `;

            await this.loadProfiles();

        }

        static async loadProfiles() {

            try {

                const profiles = await ApiService.select("profiles", {
                    columns: "*",
                    order: {
                        column: "created_at",
                        ascending: false
                    }
                });

                this.renderTable(profiles);

                this.renderStatistics(profiles);

                this.populateRoleFilter(profiles);

            }

            catch (error) {

                console.error(error);

                UI.toast("Failed to load users.");

            }

        }

        static renderTable(profiles) {

            const tbody = document.getElementById("profiles-table");

            tbody.innerHTML = "";

            profiles.forEach(profile => {

                tbody.innerHTML += `

                    <tr class="border-b">

                        <td class="p-3">

                            <img
                                src="${profile.avatar_url || 'assets/images/default-avatar.png'}"
                                class="w-10 h-10 rounded-full object-cover"
                            >

                        </td>

                        <td class="p-3">

                            ${profile.first_name || ""}

                            ${profile.last_name || ""}

                        </td>

                        <td class="p-3">

                            ${profile.email}

                        </td>

                        <td class="p-3">

                            ${profile.role}

                        </td>

                        <td class="p-3">

                            ${profile.phone || "-"}

                        </td>

                        <td class="p-3">

                            ${profile.status}

                        </td>

                        <td class="p-3 flex gap-2">

                            <button
                                class="view-btn text-blue-600"
                                data-id="${profile.id}"
                            >
                                View
                            </button>

                            <button
                                class="edit-btn text-green-600"
                                data-id="${profile.id}"
                            >
                                Edit
                            </button>

                            <button
                                class="delete-btn text-red-600"
                                data-id="${profile.id}"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `;

            });

        }

        static renderStatistics(profiles) {

            document.getElementById("total-users").textContent =
                profiles.length;

            document.getElementById("student-count").textContent =
                profiles.filter(x => x.role === "student").length;

            document.getElementById("teacher-count").textContent =
                profiles.filter(x => x.role === "teacher").length;

            document.getElementById("parent-count").textContent =
                profiles.filter(x => x.role === "parent").length;

            document.getElementById("admin-count").textContent =
                profiles.filter(x =>
                    x.role === "admin" ||
                    x.role === "ceo" ||
                    x.role === "executive"
                ).length;

        }

        static populateRoleFilter(profiles) {

            const select = document.getElementById("role-filter");

            const roles = [...new Set(profiles.map(x => x.role))];

            roles.forEach(role => {

                select.innerHTML += `
                    <option value="${role}">
                        ${role}
                    </option>
                `;

            });

        }

    }

    window.ProfilesModule = ProfilesModule;

})();