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
        admissionSubmitting: false,
        detailLoading: false,
        studentDetails: null,
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
    static DELETE_ROLES = ["ceo", "admin", "executive"];

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

    static canDelete() {
        return this.DELETE_ROLES.includes(this.role());
    }

    static canCreateParent() {
        return ["ceo", "admin"].includes(this.role());
    }

    static isTeacher() {
        return this.role() === "teacher";
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
        const profile = await Auth.profile();

        // Teachers only need the RLS-scoped student roster. Loading office-only
        // reference data here can otherwise prevent that roster from rendering.
        if (String(profile?.role || "").trim().toLowerCase() === "teacher") {
            const students = await API.students.getAll();

            this.state.students = Array.isArray(students) ? students : [];
            this.state.classes = [];
            this.state.subjects = [];
            this.state.departments = [];
            this.state.parents = [];
            this.state.profile = profile || null;

            if (window.DashboardService?.updateStudentBadge) {
                await window.DashboardService.updateStudentBadge();
            }
            return;
        }

        const [students, classes, subjectsResult, departmentsResult, parents] = await Promise.all([
            API.students.getAll(),
            API.classes.getAll(),
            API.db.from("subjects").select("id,subject_name,subject_code").order("subject_name"),
            API.db.from("departments").select("id,name").order("name"),
            API.parents.getAll()
        ]);

        if (subjectsResult.error) throw subjectsResult.error;
        if (departmentsResult.error) throw departmentsResult.error;

        this.state.students = Array.isArray(students) ? students : [];
        this.state.classes = Array.isArray(classes) ? classes : [];
        this.state.subjects = Array.isArray(subjectsResult.data) ? subjectsResult.data : [];
        this.state.departments = Array.isArray(departmentsResult.data) ? departmentsResult.data : [];
        this.state.parents = Array.isArray(parents) ? parents : [];
        this.state.profile = profile || null;

        if (window.DashboardService?.updateStudentBadge) {
            await window.DashboardService.updateStudentBadge();
        }
    }

    static currentStudent() {
        if (!this.state.modal.studentId) return null;
        return this.state.students.find((student) => String(student.id) === String(this.state.modal.studentId)) || null;
    }

    static currentStudentDetails() {
        if (!this.state.modal.studentId) return null;
        return this.state.studentDetails || this.currentStudent();
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

    static admissionFormTemplate() {
        const passwordValue = this.generatePassword();
        const today = new Date().toISOString().slice(0, 10);
        const isSubmitting = this.state.admissionSubmitting;

        return `
      <div class="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Database-connected admission</strong>
        <span class="block mt-1 text-blue-700">Class, department, guardian, and subject options are loaded from Supabase. Student ID is generated securely after admission.</span>
      </div>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">First Name <span class="text-red-600">*</span></span>
        <input name="first_name" autocomplete="given-name" maxlength="80" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Last Name <span class="text-red-600">*</span></span>
        <input name="last_name" autocomplete="family-name" maxlength="80" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      <label class="block md:col-span-2">
        <span class="text-sm font-medium text-slate-700">Email Address <span class="text-red-600">*</span></span>
        <input name="email" type="email" autocomplete="email" maxlength="254" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Phone Number</span>
        <input name="phone" type="tel" autocomplete="tel" maxlength="40" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Gender</span>
        <select name="gender" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Date of Birth</span>
        <input name="date_of_birth" type="date" autocomplete="bday" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Class <span class="text-red-600">*</span></span>
        <select name="class_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required>
          <option value="">Select a class</option>
          ${this.classOptions()}
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Department</span>
        <select name="department_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">No department</option>
          ${this.departmentOptions()}
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Parent / Guardian</span>
        <select name="parent_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
          <option value="">Link later</option>
          ${this.parentOptions()}
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Guardian Relationship</span>
        <input name="parent_relationship" maxlength="80" placeholder="e.g. Mother, Father, Guardian" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block md:col-span-2">
        <span class="text-sm font-medium text-slate-700">Subjects *</span>
        <select required name="subject_ids" multiple size="6" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" aria-describedby="student-subject-help">
          ${this.subjectOptions()}
        </select>
        <span id="student-subject-help" class="mt-1 block text-xs text-slate-500">Select every subject this student offers. Hold Ctrl (Windows) or Command (Mac) to select multiple subjects.</span>
      </label>
      <label class="block md:col-span-2">
        <span class="text-sm font-medium text-slate-700">Home Address</span>
        <input name="address" autocomplete="street-address" maxlength="300" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">City</span>
        <input name="city" autocomplete="address-level2" maxlength="100" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">State</span>
        <input name="state" autocomplete="address-level1" maxlength="100" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Country</span>
        <input name="country" autocomplete="country-name" maxlength="100" value="Nigeria" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Admission Date</span>
        <input name="admission_date" type="date" value="${today}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Temporary Password <span class="text-red-600">*</span></span>
        <div class="relative mt-1"><input name="password" type="password" minlength="8" value="${this.safe(passwordValue)}" class="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-16" required /><button type="button" data-password-toggle class="absolute inset-y-0 right-2 text-sm text-blue-700 hover:text-blue-900" aria-label="Show password">Show</button></div>
        <span class="mt-1 block text-xs text-slate-500">Share this securely with the student or guardian.</span>
      </label>
      <div class="student-admission-actions md:col-span-2 flex items-center justify-end gap-3 mt-2">
        <button type="button" data-student-close class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50" ${isSubmitting ? "disabled" : ""}>Cancel</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" ${isSubmitting ? "disabled" : ""}>${isSubmitting ? "Saving to Supabase…" : "Admit Student"}</button>
      </div>`;
    }

    static modalTemplate() {
        if (!this.state.modal.open) {
            return "";
        }

        const mode = this.state.modal.mode;
        const student = this.currentStudent();

        if (["edit", "details"].includes(mode) && !student) {
            return "";
        }

        const title = mode === "create" ? "Admit Student" : mode === "details" ? "Student Details" : "Edit Student";
        if (mode === "details") {
            return this.detailsModalTemplate();
        }
        return `
<div class="student-admission-overlay fixed inset-0 z-50 bg-slate-900/50 flex justify-center px-3 py-3 sm:px-4 sm:py-6" data-student-overlay role="dialog" aria-modal="true" aria-labelledby="student-form-title">
  <div class="student-admission-dialog w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-4 sm:p-6">
    <div class="student-admission-heading flex items-center justify-between gap-4 mb-4">
      <h3 id="student-form-title" class="text-xl font-bold text-slate-800">${title}</h3>
      <button type="button" data-student-close class="text-slate-500 hover:text-slate-700">Close</button>
    </div>
    <form id="student-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div id="student-form-error" class="hidden md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
      ${mode === "create" ? this.admissionFormTemplate() : `
      <label class="block">
        <span class="text-sm text-slate-700">Student Number</span>
        <input value="${this.safe(student?.student_no || "")}" readonly class="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-700">Admission Number</span>
        <input value="${this.safe(student?.admission_number || "")}" readonly class="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" />
      </label>
      <label class="block"><span class="text-sm text-slate-700">First Name</span><input name="first_name" value="${this.safe(student?.profiles?.first_name || "")}" required maxlength="80" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
      <label class="block"><span class="text-sm text-slate-700">Last Name</span><input name="last_name" value="${this.safe(student?.profiles?.last_name || "")}" required maxlength="80" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
      <label class="block md:col-span-2"><span class="text-sm text-slate-700">Email Address</span><input name="email" type="email" value="${this.safe(student?.profiles?.email || "")}" required maxlength="254" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
      <label class="block"><span class="text-sm text-slate-700">Phone Number</span><input name="phone" value="${this.safe(student?.profiles?.phone || "")}" maxlength="40" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
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
      <div class="student-admission-actions md:col-span-2 flex items-center justify-end gap-3 mt-2">
        <button type="button" data-student-close class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
      </div>`}
    </form>
  </div>
</div>
`;
    }

    static detailValue(value) {
        return this.safe(String(value ?? "").trim() || "—");
    }

    static detailsModalTemplate() {
        const student = this.currentStudentDetails();
        if (!student) return "";
        if (this.state.detailLoading) {
            return `<div class="student-admission-overlay fixed inset-0 z-50 bg-slate-900/50 flex justify-center px-3 py-3 sm:px-4 sm:py-6" data-student-overlay><div class="w-full max-w-3xl self-start rounded-2xl bg-white p-6 shadow-2xl text-slate-500">Loading student details…</div></div>`;
        }

        const profile = student.profiles || {};
        const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Student";
        const subjects = Array.isArray(student.subjects) ? student.subjects : [];
        const guardians = Array.isArray(student.guardians) ? student.guardians : [];
        const attendance = Array.isArray(student.attendance) ? student.attendance : [];
        const grades = Array.isArray(student.grades) ? student.grades : [];
        const payments = Array.isArray(student.payments) ? student.payments : [];
        const fields = [
            ["Student ID", student.student_no || student.admission_number],
            ["Admission Number", student.admission_number],
            ["Class", student.classes?.class_name || student.classes?.class_code],
            ["Department", student.departments?.name],
            ["Status", student.status],
            ["Admission Date", student.admission_date ? String(student.admission_date).slice(0, 10) : ""],
            ["Email", profile.email],
            ["Phone", profile.phone],
            ["Gender", profile.gender],
            ["Date of Birth", profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : ""],
            ["Address", [profile.address, profile.city, profile.state, profile.country].filter(Boolean).join(", ")]
        ];

        return `
<div class="student-admission-overlay fixed inset-0 z-50 bg-slate-900/50 flex justify-center overflow-y-auto px-3 py-3 sm:px-4 sm:py-6" data-student-overlay role="dialog" aria-modal="true" aria-labelledby="student-details-title">
  <div class="w-full max-w-3xl self-start rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
    <div class="mb-5 flex items-start justify-between gap-4"><div><h3 id="student-details-title" class="text-xl font-bold text-slate-800">${this.safe(fullName)}</h3><p class="mt-1 text-sm text-slate-500">Complete enrolled-student record</p></div><button type="button" data-student-close class="text-slate-500 hover:text-slate-700">Close</button></div>
    <dl class="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">${fields.map(([label, value]) => `<div><dt class="font-medium text-slate-500">${this.safe(label)}</dt><dd class="mt-1 text-slate-800 break-words">${this.detailValue(value)}</dd></div>`).join("")}</dl>
    <div class="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2"><div><h4 class="font-semibold text-slate-700">Enrolled Subjects</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">${subjects.length ? subjects.map((subject) => `<li>${this.safe(subject.subject_name || subject.subject_code || "Subject")}</li>`).join("") : "<li>None assigned</li>"}</ul></div><div><h4 class="font-semibold text-slate-700">Parent / Guardian</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">${guardians.length ? guardians.map((guardian) => `<li>${this.safe(`${guardian.name || guardian.email || "Guardian"}${guardian.relationship ? ` (${guardian.relationship})` : ""}`)}</li>`).join("") : "<li>None linked</li>"}</ul></div><div><h4 class="font-semibold text-slate-700">Recent Attendance</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">${attendance.length ? attendance.map((item) => `<li>${this.safe(`${String(item.date || "").slice(0, 10)} — ${item.status || "recorded"}`)}</li>`).join("") : "<li>No attendance records</li>"}</ul></div><div><h4 class="font-semibold text-slate-700">Recent Grades</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">${grades.length ? grades.map((item) => `<li>${this.safe(`${item.subjects?.subject_name || "Subject"}: ${item.grade || item.score || "recorded"}`)}</li>`).join("") : "<li>No grades recorded</li>"}</ul></div><div class="sm:col-span-2"><h4 class="font-semibold text-slate-700">Payments</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">${payments.length ? payments.map((item) => `<li>${this.safe(`${item.payment_status || "pending"} — ₦${item.amount || 0}${item.created_at ? ` (${new Date(item.created_at).toLocaleDateString()})` : ""}`)}</li>`).join("") : "<li>No payment records</li>"}</ul></div></div>
  </div>
</div>`;
    }

    static table() {
        const rows = this.filteredStudents();
        const canEdit = this.canEdit();
        const canArchive = this.canArchive();
        const canDelete = this.canDelete();

        if (!rows.length) {
            return `<div class="text-center py-8 text-slate-500">${this.isTeacher()
                ? "No students are enrolled in your assigned classes yet."
                : "No students found."}</div>`;
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
          <button data-action="details" data-id="${this.safe(student.id)}" class="mr-3 text-slate-700 hover:text-slate-900">Details</button>
          ${this.canCreateParent() ? `<button data-action="create-parent" data-id="${this.safe(student.id)}" class="mr-3 text-blue-600 hover:text-blue-700">Create Parent</button>` : ""}
          ${canEdit ? `<button data-action="edit" data-id="${this.safe(student.id)}" class="text-blue-600 hover:text-blue-700 mr-3">Edit</button>` : ""}
          ${canArchive && String(student.status || "").toLowerCase() !== "inactive" ? `<button data-action="archive" data-id="${this.safe(student.id)}" class="text-red-600 hover:text-red-700">Archive</button>` : ""}
          ${canDelete ? `<button data-action="delete" data-id="${this.safe(student.id)}" class="ml-3 text-red-700 hover:text-red-900">Delete</button>` : ""}
          ${!canEdit && !canArchive && !canDelete ? '<span class="text-slate-400">Read only</span>' : ''}
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
      <p class="text-sm text-slate-500 mt-1">${this.isTeacher()
          ? "Students appear automatically when they are enrolled in any class assigned to you."
          : "Manage student admissions, class placement, and active records."}</p>
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
        this.state.studentDetails = null;
        this.redraw();
    }

    static closeModal() {
        this.state.modal = {
            open: false,
            mode: "create",
            studentId: null
        };
        this.state.studentDetails = null;
        this.state.detailLoading = false;
        this.redraw();
    }

    static async openDetails(studentId) {
        const student = this.state.students.find((item) => String(item.id) === String(studentId));
        if (!student) return;
        this.state.modal = { open: true, mode: "details", studentId };
        this.state.studentDetails = student;
        this.state.detailLoading = true;
        this.redraw();

        try {
            const [subjectResult, guardianResult, attendanceResult, gradesResult, paymentsResult] = await Promise.all([
                API.db.from("student_subjects").select("subjects:subject_id(subject_name,subject_code)").eq("student_id", studentId),
                API.db.from("parent_students").select("relationship,parents:parent_id(profiles:profile_id(first_name,last_name,email))").eq("student_id", studentId),
                API.db.from("attendance").select("date,status").eq("student_id", studentId).order("date", { ascending: false }).limit(5),
                API.db.from("grades").select("score,grade,subjects:subject_id(subject_name)").eq("student_id", studentId).order("created_at", { ascending: false }).limit(5),
                API.db.from("payments").select("amount,payment_status,created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(5)
            ]);
            if (subjectResult.error) throw subjectResult.error;
            if (guardianResult.error) throw guardianResult.error;
            if (attendanceResult.error) throw attendanceResult.error;
            if (gradesResult.error) throw gradesResult.error;
            if (paymentsResult.error) throw paymentsResult.error;
            this.state.studentDetails = {
                ...student,
                subjects: (subjectResult.data || []).map((item) => item.subjects).filter(Boolean),
                guardians: (guardianResult.data || []).map((item) => {
                    const profile = item.parents?.profiles || {};
                    return { name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(), email: profile.email, relationship: item.relationship };
                }),
                attendance: attendanceResult.data || [],
                grades: gradesResult.data || [],
                payments: paymentsResult.data || []
            };
        } catch (error) {
            console.error("Unable to load student details:", error);
            this.showMessage("Some linked student details could not be loaded.", "error");
        } finally {
            this.state.detailLoading = false;
            this.redraw();
        }
    }

    static showFormError(message) {
        const errorBox = document.getElementById("student-form-error");
        if (!errorBox) return;
        errorBox.textContent = String(message || "Unable to save student.");
        errorBox.classList.remove("hidden");
    }

    static async submitCreate(form) {
        if (this.state.admissionSubmitting) return;

        const payload = {
            first_name: String(form.get("first_name") || "").trim(),
            last_name: String(form.get("last_name") || "").trim(),
            email: String(form.get("email") || "").trim().toLowerCase(),
            phone: String(form.get("phone") || "").trim(),
            gender: String(form.get("gender") || "").trim() || null,
            date_of_birth: String(form.get("date_of_birth") || "").trim() || null,
            class_id: String(form.get("class_id") || "").trim(),
            department_id: String(form.get("department_id") || "").trim() || null,
            parent_id: String(form.get("parent_id") || "").trim() || null,
            parent_relationship: String(form.get("parent_relationship") || "").trim() || null,
            subject_ids: form.getAll("subject_ids").map((value) => String(value).trim()).filter(Boolean),
            address: String(form.get("address") || "").trim() || null,
            city: String(form.get("city") || "").trim() || null,
            state: String(form.get("state") || "").trim() || null,
            country: String(form.get("country") || "").trim() || "Nigeria",
            admission_date: String(form.get("admission_date") || "").trim() || null,
            password: String(form.get("password") || "").trim() || this.generatePassword()
        };

        const selectedClass = payload.class_id;
        if (selectedClass.startsWith("level:")) {
            payload.class_level = selectedClass.slice("level:".length);
            payload.class_id = "";
        }

        if (!payload.first_name || !payload.last_name || !payload.email || (!payload.class_id && !payload.class_level) || !payload.password || !payload.subject_ids.length) {
            this.showFormError("First name, last name, email, class, at least one subject, and password are required.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            this.showFormError("Enter a valid email address.");
            return;
        }
        if (payload.password.length < 8) {
            this.showFormError("Temporary password must be at least 8 characters.");
            return;
        }

        this.state.admissionSubmitting = true;
        this.redraw();

        let result;
        try {
            result = await API.students.admit(payload);
        } catch (error) {
            result = { success: false, message: error?.message || "Unable to connect to Supabase." };
        } finally {
            this.state.admissionSubmitting = false;
        }

        if (!result?.success) {
            this.redraw();
            this.showFormError(result?.message || "Unable to admit student.");
            return;
        }

        const admittedStudent = result?.data?.student || {};
        const studentNumber = String(
            admittedStudent.student_no || admittedStudent.admission_number || ""
        ).trim();
        const studentIdNotice = studentNumber ? ` Student ID: ${studentNumber}.` : "";
        this.showMessage(
            `Student admitted successfully.${studentIdNotice} Temporary password: ${payload.password}`,
            "success"
        );
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
            class_id: String(form.get("class_id") || "").trim() || null,
            department_id: String(form.get("department_id") || "").trim() || null,
            status: String(form.get("status") || "").trim() || "active",
            admission_date: String(form.get("admission_date") || "").trim() || null,
            profile: {
                first_name: String(form.get("first_name") || "").trim(), last_name: String(form.get("last_name") || "").trim(),
                email: String(form.get("email") || "").trim().toLowerCase(), phone: String(form.get("phone") || "").trim() || null
            }
        };

        const result = await API.students.manage("update", student.id, payload);

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

        container.querySelectorAll("[data-action='details']").forEach((button) => {
            button.addEventListener("click", () => this.openDetails(button.getAttribute("data-id")));
        });

        container.querySelectorAll("[data-action='create-parent']").forEach((button) => {
            button.addEventListener("click", async () => {
                const studentId = button.getAttribute("data-id");
                if (!studentId || !window.Router || !window.ParentsModule?.openForStudent) return;
                await Router.navigate("parents");
                window.ParentsModule.openForStudent(studentId);
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

        container.querySelectorAll("[data-action='delete']").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.getAttribute("data-id");
                if (!id || !window.confirm("Permanently delete this student and their login? This cannot be undone.")) return;
                const result = await API.students.manage("delete", id);
                if (!result?.success) return this.showMessage(result?.message || "Unable to delete student.", "error");
                this.showMessage("Student and login deleted successfully.", "success");
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
        container.querySelectorAll("[data-password-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const input = button.parentElement?.querySelector('input[type="password"], input[type="text"]');
                if (!input) return;
                const hidden = input.type === "password";
                input.type = hidden ? "text" : "password";
                button.textContent = hidden ? "Hide" : "Show";
                button.setAttribute("aria-label", `${hidden ? "Hide" : "Show"} password`);
            });
        });
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
