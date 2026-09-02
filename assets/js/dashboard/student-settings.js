/* ==========================================================
   EMERGENCE ACADEMY
   STUDENT SETTINGS MODULE
========================================================== */

(function () {

    "use strict";

    class StudentSettingsModule {

        static BUCKET = "profile-images";

        static state = {
            container: null,
            profile: null,
            student: null,
            previewUrl: "",
            uploading: false,
            saving: false
        };

        static safe(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        static role() {
            return String(this.state.profile?.role || "").trim().toLowerCase();
        }

        static isStudent() {
            return this.role() === "student";
        }

        static async loadStudentRecord(profileId) {
            if (!profileId) return null;

            const { data, error } = await API.db
                .from("students")
                .select(`
                    id,
                    student_no,
                    admission_number,
                    class_id,
                    department_id,
                    classes:class_id(id,class_name,class_code),
                    departments:department_id(id,name)
                `)
                .eq("profile_id", profileId)
                .maybeSingle();

            if (error) throw error;

            return data || null;
        }

        static avatarFallback() {
            const profile = this.state.profile || {};
            const initials = [profile.first_name, profile.last_name]
                .filter(Boolean)
                .map((part) => String(part).trim().charAt(0).toUpperCase())
                .slice(0, 2)
                .join("") || "S";
            return initials;
        }

        static async resolveAvatarUrl(value) {
            const path = String(value || "").trim();
            if (!path) return "";
            if (/^https?:\/\//i.test(path)) return path;
            const { data } = API.db.storage.from(this.BUCKET).getPublicUrl(path);
            return data?.publicUrl || path;
        }

        static renderAvatar() {
            const avatar = document.querySelector("[data-student-avatar]");
            if (!avatar) return;

            const url = this.state.previewUrl || this.state.profile?.avatar_url || "";
            const isImage = /^https?:\/\//i.test(url) || url.includes("/");

            avatar.textContent = isImage ? "" : this.avatarFallback();
            avatar.style.backgroundImage = isImage ? `url("${String(url).replace(/"/g, "%22")}")` : "";
            avatar.style.backgroundSize = "cover";
            avatar.style.backgroundPosition = "center";
            avatar.style.backgroundColor = isImage ? "" : "#2563eb";
        }

        static notify(message, tone = "success") {
            if (tone === "success" && window.Utils?.success) return Utils.success(message);
            if (tone === "error" && window.Utils?.error) return Utils.error(message);
            window.alert(message);
        }

        static async render(container) {
            this.state.container = container;
            container.innerHTML = `
                <div class="space-y-6">
                    <div class="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow-lg">
                        <p class="text-sm uppercase tracking-[0.25em] text-blue-100">Student Settings</p>
                        <h1 class="mt-2 text-3xl font-bold">Manage your profile</h1>
                        <p class="mt-3 max-w-2xl text-blue-100">Upload your photo and update the personal details your school office uses.</p>
                    </div>

                    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div class="flex flex-col items-center text-center">
                                <div data-student-avatar class="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-blue-100 bg-blue-600 text-3xl font-bold text-white shadow-inner"></div>
                                <h2 class="mt-4 text-xl font-semibold text-slate-900" data-student-name>Loading...</h2>
                                <p class="text-sm text-slate-500" data-student-email>...</p>
                            </div>

                            <div class="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                <div class="flex justify-between gap-3"><span class="text-slate-500">Admission No.</span><strong data-student-admission>-</strong></div>
                                <div class="flex justify-between gap-3"><span class="text-slate-500">Student No.</span><strong data-student-number>-</strong></div>
                                <div class="flex justify-between gap-3"><span class="text-slate-500">Class</span><strong data-student-class>-</strong></div>
                                <div class="flex justify-between gap-3"><span class="text-slate-500">Department</span><strong data-student-department>-</strong></div>
                            </div>
                        </div>

                        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <form id="student-settings-form" class="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-slate-700">Profile Photo</label>
                                    <div class="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
                                        <input type="file" accept="image/png,image/jpeg,image/webp" data-avatar-input class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
                                        <p class="text-xs text-slate-500">JPEG, PNG, or WebP up to 5 MB. The image is stored in your own folder.</p>
                                    </div>
                                </div>

                                <label class="block text-sm font-medium text-slate-700">First Name
                                    <input name="first_name" required class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="block text-sm font-medium text-slate-700">Last Name
                                    <input name="last_name" required class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="md:col-span-2 block text-sm font-medium text-slate-700">Email
                                    <input name="email" type="email" readonly class="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-500" />
                                </label>
                                <label class="block text-sm font-medium text-slate-700">Phone
                                    <input name="phone" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="block text-sm font-medium text-slate-700">Gender
                                    <select name="gender" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                                        <option value="">Select gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </label>
                                <label class="block text-sm font-medium text-slate-700">Date of Birth
                                    <input name="date_of_birth" type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="md:col-span-2 block text-sm font-medium text-slate-700">Address
                                    <input name="address" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="block text-sm font-medium text-slate-700">City
                                    <input name="city" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="block text-sm font-medium text-slate-700">State
                                    <input name="state" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>
                                <label class="md:col-span-2 block text-sm font-medium text-slate-700">Country
                                    <input name="country" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                                </label>

                                <div class="md:col-span-2 mt-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    <p data-settings-status>Update your details and save changes.</p>
                                    <button type="submit" class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            await this.load();
            this.bindEvents();
        }

        static async load() {
            try {
                const profile = await Profile.load(true);
                if (!profile) throw new Error("Profile not found.");

                const student = await this.loadStudentRecord(profile.id);
                this.state.profile = profile;
                this.state.student = student;
                this.state.previewUrl = await this.resolveAvatarUrl(profile.avatar_url || profile.profile_image || "");

                const form = document.getElementById("student-settings-form");
                if (form) {
                    form.elements.first_name.value = profile.first_name || "";
                    form.elements.last_name.value = profile.last_name || "";
                    form.elements.email.value = profile.email || "";
                    form.elements.phone.value = profile.phone || "";
                    form.elements.gender.value = profile.gender || "";
                    form.elements.date_of_birth.value = String(profile.date_of_birth || "").slice(0, 10);
                    form.elements.address.value = profile.address || "";
                    form.elements.city.value = profile.city || "";
                    form.elements.state.value = profile.state || "";
                    form.elements.country.value = profile.country || "";
                }

                const nameNode = document.querySelector("[data-student-name]");
                if (nameNode) nameNode.textContent = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.email || "Student";

                const emailNode = document.querySelector("[data-student-email]");
                if (emailNode) emailNode.textContent = profile.email || "";

                const admissionNode = document.querySelector("[data-student-admission]");
                if (admissionNode) admissionNode.textContent = student?.admission_number || "-";

                const numberNode = document.querySelector("[data-student-number]");
                if (numberNode) numberNode.textContent = student?.student_no || "-";

                const classNode = document.querySelector("[data-student-class]");
                if (classNode) classNode.textContent = student?.classes?.class_name || student?.classes?.class_code || "-";

                const departmentNode = document.querySelector("[data-student-department]");
                if (departmentNode) departmentNode.textContent = student?.departments?.name || "-";

                this.renderAvatar();
            } catch (error) {
                console.error(error);
                this.notify(error?.message || "Unable to load settings.", "error");
            }
        }

        static bindEvents() {
            const form = document.getElementById("student-settings-form");
            const avatarInput = document.querySelector("[data-avatar-input]");

            if (avatarInput) {
                avatarInput.addEventListener("change", async () => {
                    const file = avatarInput.files?.[0];
                    if (!file) return;
                    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
                        this.notify("Use JPEG, PNG, or WebP images.", "error");
                        avatarInput.value = "";
                        return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                        this.notify("Image must be 5 MB or smaller.", "error");
                        avatarInput.value = "";
                        return;
                    }
                    try {
                        this.state.uploading = true;
                        const profile = this.state.profile || await Profile.load();
                        const ext = (file.name.split(".").pop() || "png").toLowerCase();
                        const path = `${profile.id}/avatar.${ext}`;
                        const { error: uploadError } = await API.db.storage.from(this.BUCKET).upload(path, file, {
                            contentType: file.type,
                            upsert: true
                        });
                        if (uploadError) throw uploadError;
                        const { data } = API.db.storage.from(this.BUCKET).getPublicUrl(path);
                        this.state.previewUrl = data?.publicUrl || "";
                        this.renderAvatar();
                        this.notify("Photo selected. Save changes to publish it.");
                    } catch (error) {
                        console.error(error);
                        this.notify(error?.message || "Unable to upload photo.", "error");
                        avatarInput.value = "";
                    } finally {
                        this.state.uploading = false;
                    }
                });
            }

            if (form) {
                form.addEventListener("submit", async (event) => {
                    event.preventDefault();
                    if (this.state.saving) return;

                    const status = document.querySelector("[data-settings-status]");
                    const submitButton = form.querySelector('button[type="submit"]');
                    const profile = this.state.profile || await Profile.load();
                    if (!profile?.id) {
                        this.notify("No authenticated profile found.", "error");
                        return;
                    }

                    const payload = {
                        first_name: form.elements.first_name.value.trim(),
                        last_name: form.elements.last_name.value.trim(),
                        phone: form.elements.phone.value.trim(),
                        gender: form.elements.gender.value.trim() || null,
                        date_of_birth: form.elements.date_of_birth.value || null,
                        address: form.elements.address.value.trim() || null,
                        city: form.elements.city.value.trim() || null,
                        state: form.elements.state.value.trim() || null,
                        country: form.elements.country.value.trim() || null,
                        avatar_url: this.state.previewUrl || profile.avatar_url || null
                    };

                    try {
                        this.state.saving = true;
                        if (submitButton) {
                            submitButton.disabled = true;
                            submitButton.textContent = "Saving...";
                        }
                        if (status) status.textContent = "Saving your profile...";

                        const { data, error } = await API.db
                            .from("profiles")
                            .update(payload)
                            .eq("id", profile.id)
                            .select()
                            .single();

                        if (error) throw error;

                        this.state.profile = data || profile;
                        if (typeof Profile.refresh === "function") {
                            await Profile.refresh();
                        }
                        if (typeof window.displayUser === "function") {
                            await window.displayUser();
                        }
                        this.renderAvatar();
                        if (status) status.textContent = "Profile saved successfully.";
                        this.notify("Profile updated successfully.");
                    } catch (error) {
                        console.error(error);
                        if (status) status.textContent = error?.message || "Unable to save changes.";
                        this.notify(error?.message || "Unable to save changes.", "error");
                    } finally {
                        this.state.saving = false;
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = "Save Changes";
                        }
                    }
                });
            }
        }

    }

    window.StudentSettingsModule = StudentSettingsModule;

})();