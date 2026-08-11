/* ==========================================================
   EMERGENCE ACADEMY
   STUDENTS MODULE
========================================================== */

class StudentsModule {

    static state = {
        container: null,
        students: [],
        classes: [],
        subjects: [],
        departments: [],
        parents: [],
        profile: null,
        query: "",
        modal: {
            open: false,
            mode: "create",
            studentId: null
        }
    };

    static CREATE_ROLES = ["ceo", "admin", "executive", "admission"];
    static EDIT_ROLES = ["ceo", "admin", "executive", "admission"];
    static ARCHIVE_ROLES = ["ceo", "admin", "executive"];

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

    static canCreate() {
        return this.CREATE_ROLES.includes(this.role());
    }

    static canEdit() {
        return this.EDIT_ROLES.includes(this.role());
    }

    static canArchive() {
        return this.ARCHIVE_ROLES.includes(this.role());
    }

    static showMessage(text, tone = "success") {
        const fallback = String(text || "Action completed.");

        if (tone === "success" && window.Utils?.success) {
            Utils.success(fallback);
            return;
        }

        if (tone === "error" && window.Utils?.error) {
            Utils.error(fallback);
            return;
        }

        const targetId = tone === "success" ? "success-message" : "error-message";
        const target = document.getElementById(targetId);

        if (!target) {
            console[tone === "error" ? "error" : "log"](fallback);
            return;
        }

        target.textContent = fallback;
        target.classList.remove("hidden");

        setTimeout(() => {
            target.classList.add("hidden");
        }, 3500);
    }

    static loading() {
        return `
<div class="bg-white rounded-xl shadow p-8 text-center text-slate-500">
  Loading Students...
</div>
`;
    }

    static error(message = "Unable to load students.") {
        return `
<div class="bg-white rounded-xl shadow p-8 text-center text-red-600">
  ${this.safe(message)}
</div>
`;
    }

    static async render(container) {
        this.state.container = container;
        container.innerHTML = this.loading();

        try {
            await this.load();
            this.redraw();
        }
        catch (error) {
            console.error(error);
            container.innerHTML = this.error(error.message);
        }
    }

    static async load() {
        const [students, classes, subjects, departments, parents, profile] = await Promise.all([
            API.students.getAll(),
            API.classes.getAll(),
            API.db.from("subjects").select("id,subject_name,subject_code").order("subject_name"),
            API.db.from("departments").select("id,name").order("name"),
            API.parents.getAll(),
            Auth.profile()
        ]);

        this.state.students = Array.isArray(students) ? students : [];
        this.state.classes = Array.isArray(classes) ? classes : [];
        this.state.subjects = Array.isArray(subjects?.data) ? subjects.data : [];
        this.state.departments = Array.isArray(departments?.data) ? departments.data : [];
        this.state.parents = Array.isArray(parents) ? parents : [];
        this.state.profile = profile || null;
    }

    static currentStudent() {
        if (!this.state.modal.studentId) return null;
        return this.state.students.find((student) => String(student.id) === String(this.state.modal.studentId)) || null;
    }

    static generatePassword(length = 12) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
        let output = "";

        for (let index = 0; index < length; index += 1) {
            output += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return output;
    }

    static filteredStudents() {
        const query = String(this.state.query || "").trim().toLowerCase();

        if (!query) {
            return this.state.students;
        }

        return this.state.students.filter((student) => {
            const haystack = [
                student.student_no,
                student.admission_number,
                student.status,
                student.profiles?.first_name,
                student.profiles?.last_name,
                student.profiles?.email,
                student.profiles?.phone,
                student.classes?.class_name
            ].join(" ").toLowerCase();

            return haystack.includes(query);
        });
    }

    static classOptions(selectedValue = "") {
        const standardLevels = ["Primary 3", "Primary 4", "Primary 5", "Primary 6", "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"];
        const storedOptions = this.state.classes.map((item) => `
<option value="${this.safe(item.id)}" ${String(item.id) === String(selectedValue) ? "selected" : ""}>
  ${this.safe(item.class_name || item.class_code || item.id)}
</option>`).join("");
        const knownNames = new Set(this.state.classes.map((item) => String(item.class_name || "").trim().toLowerCase()));
        const standardOptions = standardLevels
            .filter((level) => !knownNames.has(level.toLowerCase()))
            .map((level) => `<option value="level:${this.safe(level)}" ${String(selectedValue) === `level:${level}` ? "selected" : ""}>${this.safe(level)}</option>`)
            .join("");

        return `${storedOptions}${standardOptions}`;
    }

    static departmentOptions(selectedValue = "") {
        return this.state.departments.map((department) => `<option value="${this.safe(department.id)}" ${String(department.id) === String(selectedValue) ? "selected" : ""}>${this.safe(department.name || department.id)}</option>`).join("");
    }

    static subjectOptions(selectedValues = []) {
        const selected = new Set((Array.isArray(selectedValues) ? selectedValues : []).map(String));
        return this.state.subjects.map((subject) => `<option value="${this.safe(subject.id)}" ${selected.has(String(subject.id)) ? "selected" : ""}>${this.safe(subject.subject_name || subject.subject_code || subject.id)}</option>`).join("");
    }

    static parentOptions(selectedValue = "") {
        return this.state.parents.map((parent) => {
            const name = `${parent.profiles?.first_name || ""} ${parent.profiles?.last_name || ""}`.trim();
            return `<option value="${this.safe(parent.id)}" ${String(parent.id) === String(selectedValue) ? "selected" : ""}>${this.safe(name || parent.profiles?.email || parent.id)}</option>`;
        }).join("");
    }

    static modalTemplate() {
        if (!this.state.modal.open) {
            return "";
        }

        const mode = this.state.modal.mode;
        const student = this.currentStudent();

        if (mode === "edit" && !student) {
            return "";
        }

        const title = mode === "create" ? "Admit Student" : "Edit Student";
        const passwordValue = mode === "create" ? this.generatePassword() : "";

        return `
<div class="student-admission-overlay fixed inset-0 z-50 bg-slate-900/50 flex justify-center px-3 py-3 sm:px-4 sm:py-6" data-student-overlay role="dialog" aria-modal="true" aria-labelledby="student-form-title">
  <div class="student-admission-dialog w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-4 sm:p-6">
    <div class="student-admission-heading flex items-center justify-between gap-4 mb-4">
      <h3 id="student-form-title" class="text-xl font-bold text-slate-800">${title}</h3>
      <button type="button" data-student-close class="text-slate-500 hover:text-slate-700">Close</button>
    </div>
    <form id="student-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div id="student-form-error" class="hidden md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
      ${mode === "create" ? `
      <label class="block">
        <span class="text-sm text-slate-700">First Name *</span>
        <input name="first_name" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Last Name *</span>
        <input name="last_name" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      <label class="block md:col-span-2">
        <span class="text-sm text-slate-700">Email *</span>
        <input name="email" type="email" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Phone</span>
        <input name="phone" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Class *</span>
        <select name="class_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required>
          <option value="">Select Class</option>
          ${this.classOptions()}
        </select>
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Department of Enrollment</span>
        <select name="department_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">No department</option>
          ${this.departmentOptions()}
        </select>
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Parent / Guardian</span>
        <select name="parent_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">Link later</option>
          ${this.parentOptions()}
        </select>
      </label>
      <label class="block md:col-span-2">
        <span class="text-sm text-slate-700">Subjects</span>
        <select name="subject_ids" multiple size="5" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" aria-describedby="student-subject-help">
          ${this.subjectOptions()}
        </select>
        <span id="student-subject-help" class="mt-1 block text-xs text-slate-500">Hold Ctrl (Windows) or Command (Mac) to select more than one subject.</span>
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Admission Date</span>
        <input name="admission_date" type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Temporary Password *</span>
        <input name="password" value="${this.safe(passwordValue)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      ` : `
      <label class="block">
        <span class="text-sm text-slate-700">Student Number</span>
        <input name="student_no" value="${this.safe(student?.student_no || "")}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Admission Number</span>
        <input name="admission_number" value="${this.safe(student?.admission_number || "")}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Class</span>
        <select name="class_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">Select Class</option>
          ${this.classOptions(student?.class_id || "")}
        </select>
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Department of Enrollment</span>
        <select name="department_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">No department</option>
          ${this.departmentOptions(student?.department_id || "")}
        </select>
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Status</span>
        <select name="status" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          ${["active", "inactive", "graduated", "suspended", "pending"].map((status) => `
          <option value="${status}" ${String(student?.status || "") === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label class="block md:col-span-2">
        <span class="text-sm text-slate-700">Admission Date</span>
        <input name="admission_date" type="date" value="${this.safe(String(student?.admission_date || "").slice(0, 10))}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      `}
      <div class="student-admission-actions md:col-span-2 flex items-center justify-end gap-3 mt-2">
        <button type="button" data-student-close class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
      </div>
    </form>
  </div>
</div>
`;
    }

    static table() {
        const rows = this.filteredStudents();
        const canEdit = this.canEdit();
        const canArchive = this.canArchive();

        if (!rows.length) {
            return '<div class="text-center py-8 text-slate-500">No students found.</div>';
        }

        return `
<div class="overflow-x-auto">
  <table class="min-w-full text-sm">
    <thead>
      <tr class="border-b border-slate-200 text-left text-slate-600">
        <th class="px-3 py-2.5 font-semibold">Student No</th>
        <th class="px-3 py-2.5 font-semibold">Name</th>
        <th class="px-3 py-2.5 font-semibold">Class</th>
        <th class="px-3 py-2.5 font-semibold">Email</th>
        <th class="px-3 py-2.5 font-semibold">Phone</th>
        <th class="px-3 py-2.5 font-semibold">Status</th>
        <th class="px-3 py-2.5 font-semibold text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((student) => `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-3 py-2.5">${this.safe(student.student_no || student.admission_number || "-")}</td>
        <td class="px-3 py-2.5">${this.safe(`${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() || "-")}</td>
        <td class="px-3 py-2.5">${this.safe(student.classes?.class_name || "-")}</td>
        <td class="px-3 py-2.5">${this.safe(student.profiles?.email || "-")}</td>
        <td class="px-3 py-2.5">${this.safe(student.profiles?.phone || "-")}</td>
        <td class="px-3 py-2.5">${this.safe(student.status || "-")}</td>
        <td class="px-3 py-2.5 text-right">
          ${canEdit ? `<button data-action="edit" data-id="${this.safe(student.id)}" class="text-blue-600 hover:text-blue-700 mr-3">Edit</button>` : ""}
          ${canArchive && String(student.status || "").toLowerCase() !== "inactive" ? `<button data-action="archive" data-id="${this.safe(student.id)}" class="text-red-600 hover:text-red-700">Archive</button>` : ""}
          ${!canEdit && !canArchive ? '<span class="text-slate-400">Read only</span>' : ''}
        </td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
`;
    }

    static template() {
        return `
<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div>
      <h2 class="text-3xl font-bold text-slate-800">Students</h2>
      <p class="text-sm text-slate-500 mt-1">Manage student admissions, class placement, and active records.</p>
    </div>
    <div class="flex items-center gap-2">
      ${this.canCreate() ? '<button id="addStudent" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Admit Student</button>' : ''}
      <button id="refreshStudents" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Refresh</button>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow p-5">
    <input id="studentSearch" type="text" value="${this.safe(this.state.query)}" placeholder="Search by name, email, student number, class, or status..." class="w-full rounded-lg border border-slate-300 px-4 py-2.5 mb-4" />
    ${this.table()}
  </div>

  ${this.modalTemplate()}
</div>
`;
    }

    static redraw() {
        if (!this.state.container) return;
        this.state.container.innerHTML = this.template();
        this.bindEvents();
    }

    static openModal(mode, studentId = null) {
        this.state.modal = {
            open: true,
            mode,
            studentId
        };
        this.redraw();
    }

    static closeModal() {
        this.state.modal = {
            open: false,
            mode: "create",
            studentId: null
        };
        this.redraw();
    }

    static showFormError(message) {
        const errorBox = document.getElementById("student-form-error");
        if (!errorBox) return;
        errorBox.textContent = String(message || "Unable to save student.");
        errorBox.classList.remove("hidden");
    }

    static async submitCreate(form) {
        const payload = {
            first_name: String(form.get("first_name") || "").trim(),
            last_name: String(form.get("last_name") || "").trim(),
            email: String(form.get("email") || "").trim().toLowerCase(),
            phone: String(form.get("phone") || "").trim(),
            class_id: String(form.get("class_id") || "").trim(),
            department_id: String(form.get("department_id") || "").trim() || null,
            parent_id: String(form.get("parent_id") || "").trim() || null,
            subject_ids: form.getAll("subject_ids").map((value) => String(value).trim()).filter(Boolean),
            admission_date: String(form.get("admission_date") || "").trim() || null,
            password: String(form.get("password") || "").trim() || this.generatePassword()
        };

        const selectedClass = payload.class_id;
        if (selectedClass.startsWith("level:")) {
            payload.class_level = selectedClass.slice("level:".length);
            payload.class_id = "";
        }

        if (!payload.first_name || !payload.last_name || !payload.email || (!payload.class_id && !payload.class_level) || !payload.password) {
            this.showFormError("First name, last name, email, class, and password are required.");
            return;
        }

        const result = await API.students.admit(payload);

        if (!result?.success) {
            this.showFormError(result?.message || "Unable to admit student.");
            return;
        }

        this.showMessage(`Student admitted successfully. Temporary password: ${payload.password}`, "success");
        this.closeModal();
        await this.load();
        this.redraw();
    }

    static async submitEdit(form) {
        const student = this.currentStudent();
        if (!student) {
            this.showFormError("Student record was not found.");
            return;
        }

        const payload = {
            student_no: String(form.get("student_no") || "").trim() || null,
            admission_number: String(form.get("admission_number") || "").trim() || null,
            class_id: String(form.get("class_id") || "").trim() || null,
            department_id: String(form.get("department_id") || "").trim() || null,
            status: String(form.get("status") || "").trim() || "active",
            admission_date: String(form.get("admission_date") || "").trim() || null
        };

        const result = await API.students.update(student.id, payload);

        if (!result?.success) {
            this.showFormError(result?.message || "Unable to update student.");
            return;
        }

        this.showMessage(result.message || "Student updated successfully.", "success");
        this.closeModal();
        await this.load();
        this.redraw();
    }

    static bindEvents() {
        const container = this.state.container;
        if (!container) return;

        const search = container.querySelector("#studentSearch");
        if (search) {
            search.addEventListener("input", (event) => {
                this.state.query = event.target.value || "";
                this.redraw();
            });
        }

        container.querySelector("#addStudent")?.addEventListener("click", () => {
            this.openModal("create");
        });

        container.querySelector("#refreshStudents")?.addEventListener("click", async () => {
            await this.load();
            this.redraw();
            this.showMessage("Students refreshed.", "success");
        });

        container.querySelectorAll("[data-action='edit']").forEach((button) => {
            button.addEventListener("click", () => {
                this.openModal("edit", button.getAttribute("data-id"));
            });
        });

        container.querySelectorAll("[data-action='archive']").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.getAttribute("data-id");
                const confirmed = window.confirm("Archive this student record? The account stays in Supabase, but the student will be marked inactive.");

                if (!confirmed || !id) return;

                const result = await API.students.update(id, { status: "inactive" });

                if (!result?.success) {
                    this.showMessage(result?.message || "Unable to archive student.", "error");
                    return;
                }

                this.showMessage("Student archived successfully.", "success");
                await this.load();
                this.redraw();
            });
        });

        container.querySelectorAll("[data-student-close]").forEach((button) => {
            button.addEventListener("click", () => this.closeModal());
        });

        const overlay = container.querySelector("[data-student-overlay]");
        if (overlay) {
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) {
                    this.closeModal();
                }
            });
        }

        const form = container.querySelector("#student-form");
        if (form) {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();

                const formData = new FormData(form);

                if (this.state.modal.mode === "create") {
                    await this.submitCreate(formData);
                    return;
                }

                await this.submitEdit(formData);
            });
        }
    }

}

window.StudentsModule = StudentsModule;
