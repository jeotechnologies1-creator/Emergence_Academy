// class OfficeModuleEngine {

//   static state = {};

//   static create(config) {
//     return class {
//       static config = config;

//       static async render(container) {
//         return OfficeModuleEngine.render(this, container);
//       }
//     };
//   }

//   static getState(moduleClass) {
//     const key = moduleClass.config.moduleKey;
//     if (!this.state[key]) {
//       this.state[key] = {
//         rows: [],
//         page: 1,
//         pageSize: 10,
//         search: "",
//         status: "all",
//         sortKey: moduleClass.config.defaultSortKey || "",
//         sortDir: "desc",
//         columns: moduleClass.config.columns || [],
//         lookups: {},
//         profile: null,
//         modal: {
//           open: false,
//           mode: "create",
//           rowId: null
//         },
//         container: null
//       };
//     }
//     return this.state[key];
//   }

//   static async resolveProfile() {
//     try {
//       if (window.Auth && typeof window.Auth.profile === "function") {
//         return await window.Auth.profile();
//       }
//     } catch (error) {
//       console.error("Unable to resolve current profile for module scope:", error);
//     }
//     return null;
//   }

//   static showMessage(text, kind = "success") {
//     const fallback = typeof text === "string" ? text : "Action completed.";

//     if (kind === "success" && window.Utils?.success) {
//       Utils.success(fallback);
//       return;
//     }

//     if (kind === "error" && window.Utils?.error) {
//       Utils.error(fallback);
//       return;
//     }

//     const targetId = kind === "success" ? "success-message" : "error-message";
//     const target = document.getElementById(targetId);

//     if (!target) {
//       if (kind === "error") {
//         console.error(fallback);
//       } else {
//         console.log(fallback);
//       }
//       return;
//     }

//     target.textContent = fallback;
//     target.classList.remove("hidden");
//     setTimeout(() => {
//       target.classList.add("hidden");
//     }, 3000);
//   }

//   static safe(value) {
//     return String(value ?? "")
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;")
//       .replace(/"/g, "&quot;")
//       .replace(/'/g, "&#39;");
//   }

//   static normalizeRowValue(value) {
//     if (value === null || value === undefined) return "-";
//     if (typeof value === "object") {
//       if (value.first_name || value.last_name) {
//         return `${value.first_name || ""} ${value.last_name || ""}`.trim() || "-";
//       }
//       if (value.name) return value.name;
//       if (value.email) return value.email;
//       if (value.class_name) return value.class_name;
//       if (value.subject_name) return value.subject_name;
//       return JSON.stringify(value);
//     }
//     return String(value);
//   }

//   static tableFromForeignKey(key) {
//     const mappings = {
//       student_id: "students",
//       teacher_id: "teachers",
//       class_id: "classes",
//       subject_id: "subjects",
//       parent_id: "parents",
//       profile_id: "profiles",
//       user_id: "profiles",
//       created_by: "profiles"
//     };

//     if (mappings[key]) {
//       return mappings[key];
//     }

//     if (key.endsWith("_id")) {
//       return `${key.replace(/_id$/, "")}s`;
//     }

//     return null;
//   }

//   static getLookupLabel(table, row) {
//     if (!row || typeof row !== "object") {
//       return "-";
//     }

//     const tableLabelResolvers = {
//       students: () => row.student_no || row.admission_number || row.id,
//       teachers: () => row.employee_id || row.staff_number || row.id,
//       classes: () => row.class_name || row.class_code || row.id,
//       subjects: () => row.subject_name || row.subject_code || row.id,
//       parents: () => row.occupation || row.id,
//       profiles: () => {
//         const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
//         return fullName || row.email || row.id;
//       }
//     };

//     const resolver = tableLabelResolvers[table];
//     if (resolver) {
//       return this.normalizeRowValue(resolver());
//     }

//     return this.normalizeRowValue(
//       row.name || row.title || row.code || row.id
//     );
//   }

//   static profileDisplayName(profileRow) {
//     if (!profileRow || typeof profileRow !== "object") {
//       return "";
//     }

//     const fullName = `${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim();
//     return fullName || String(profileRow.email || "").trim() || "";
//   }

//   static async loadLookups(moduleClass, state) {
//     state.lookups = {};

//     const explicitLookups = moduleClass.config.lookups || {};
//     const columns = moduleClass.config.columns || [];
//     const inferredKeys = columns
//       .map((column) => column.key)
//       .filter((key) => key.endsWith("_id") || ["user_id", "profile_id", "created_by"].includes(key));

//     const keys = Array.from(new Set([
//       ...Object.keys(explicitLookups),
//       ...inferredKeys
//     ]));

//     for (const key of keys) {
//       const table = explicitLookups[key]?.table || this.tableFromForeignKey(key);
//       if (!table) {
//         continue;
//       }

//       try {
//         const records = await API.records.getAll(table, {
//           orderBy: "created_at",
//           ascending: false,
//           select: "*"
//         });

//         const lookupConfig = explicitLookups[key] || {};
//         const labelKey = lookupConfig.labelKey || "";
//         const labelResolver = typeof lookupConfig.labelResolver === "function"
//           ? lookupConfig.labelResolver
//           : null;

//         let profileMap = null;

//         if (lookupConfig.preferProfileName) {
//           const profiles = await API.records.getAll("profiles", {
//             orderBy: "created_at",
//             ascending: false,
//             select: "*"
//           });

//           profileMap = {};
//           profiles.forEach((profileRow) => {
//             if (!profileRow || typeof profileRow.id === "undefined" || profileRow.id === null) {
//               return;
//             }
//             profileMap[String(profileRow.id)] = this.profileDisplayName(profileRow);
//           });
//         }

//         const map = {};
//         const recordFilter = typeof lookupConfig.filter === "function" ? lookupConfig.filter : null;
//         records.filter((item) => !recordFilter || recordFilter(item)).forEach((item) => {
//           const id = item?.id;
//           if (id === null || typeof id === "undefined") {
//             return;
//           }

//           let label = "";

//           if (
//             profileMap &&
//             item &&
//             typeof item.profile_id !== "undefined" &&
//             item.profile_id !== null
//           ) {
//             label = String(profileMap[String(item.profile_id)] || "").trim();
//           }

//           // Teacher lookups should always retain the generated employee ID.
//           // This keeps the same identifier visible in assignments, grades, and
//           // any other module that selects a teacher by their profile name.
//           if (label && table === "teachers") {
//             const employeeId = String(item.employee_id || item.teacher_no || "").trim();
//             if (employeeId) {
//               label = `${label} (${employeeId})`;
//             }
//           }

//           // Student choices must identify the enrolled learner unambiguously.
//           // Names can be shared, while student numbers are unique and are what
//           // teachers and students are given during admission.
//           if (label && table === "students") {
//             const studentNumber = String(item.student_no || item.admission_number || "").trim();
//             if (studentNumber) {
//               label = `${label} (${studentNumber})`;
//             }
//           }

//           if (!label && labelResolver) {
//             const profileName = profileMap && item && item.profile_id
//               ? String(profileMap[String(item.profile_id)] || "").trim()
//               : "";
//             label = this.normalizeRowValue(labelResolver(item, { profileName }));
//           }

//           if (!label && labelKey) {
//             label = this.normalizeRowValue(item[labelKey]);
//           }

//           if (!label) {
//             label = this.getLookupLabel(table, item);
//           }

//           map[String(id)] = label;
//         });

//         state.lookups[key] = {
//           table,
//           map
//         };
//       } catch (error) {
//         console.error(`Lookup load failed for ${key} (${table}):`, error);
//       }
//     }
//   }

//   static getDisplayValue(row, key, state) {
//     const value = row?.[key];
//     const lookupMap = state?.lookups?.[key]?.map;
//     if (lookupMap && value !== null && typeof value !== "undefined") {
//       const resolved = lookupMap[String(value)];
//       if (resolved) {
//         return resolved;
//       }
//     }
//     return this.normalizeRowValue(value);
//   }

//   static fieldLabel(field) {
//     return String(field || "")
//       .replace(/_/g, " ")
//       .replace(/\b\w/g, (chr) => chr.toUpperCase());
//   }

//   static clearModalErrors(form) {
//     if (!form) return;

//     const global = form.querySelector("[data-modal-error]");
//     if (global) {
//       global.textContent = "";
//       global.classList.add("hidden");
//     }

//     form.querySelectorAll("[data-field-error]").forEach((el) => {
//       el.textContent = "";
//       el.classList.add("hidden");
//     });

//     form.querySelectorAll("input, select, textarea").forEach((input) => {
//       input.classList.remove("border-red-500", "ring-1", "ring-red-300");
//     });
//   }

//   static showModalError(form, message) {
//     if (!form) {
//       this.showMessage(message, "error");
//       return;
//     }

//     const global = form.querySelector("[data-modal-error]");
//     if (!global) {
//       this.showMessage(message, "error");
//       return;
//     }

//     global.textContent = String(message || "Please correct the highlighted fields.");
//     global.classList.remove("hidden");
//   }

//   static showFieldError(form, field, message) {
//     if (!form || !field) {
//       return;
//     }

//     const input = form.querySelector(`[name="${field}"]`);
//     const error = form.querySelector(`[data-field-error="${field}"]`);

//     if (input) {
//       input.classList.add("border-red-500", "ring-1", "ring-red-300");
//       try {
//         input.focus();
//       } catch (errorFocus) {
//         console.error("Unable to focus invalid field:", errorFocus);
//       }
//     }

//     if (error) {
//       error.textContent = String(message || "Invalid value.");
//       error.classList.remove("hidden");
//     }
//   }

//   static async auditAction(moduleClass, state, action, payload = {}, recordId = null) {
//     try {
//       const moduleKey = String(moduleClass?.config?.moduleKey || "module");
//       const role = String(state?.profile?.role || "unknown");
//       const userId = String(state?.profile?.id || "");

//       const normalized = {};
//       Object.entries(payload || {}).slice(0, 10).forEach(([key, value]) => {
//         if (["password", "token", "secret"].includes(String(key).toLowerCase())) {
//           return;
//         }
//         normalized[key] = String(value ?? "").slice(0, 120);
//       });

//       const details = JSON.stringify({
//         module: moduleKey,
//         action,
//         role,
//         record_id: recordId,
//         fields: normalized
//       });

//       if (window.Auth && typeof window.Auth.log === "function") {
//         await window.Auth.log(`MODULE_${String(action).toUpperCase()}`, details);
//         return;
//       }

//       await API.records.create("activity_logs", {
//         user_id: userId || null,
//         action: `MODULE_${String(action).toUpperCase()}`,
//         description: details,
//         created_at: new Date().toISOString()
//       });
//     } catch (error) {
//       console.error("Audit log write failed:", error);
//     }
//   }

//   static validatePayload(moduleClass, payload, mode = "create") {
//     const required = (mode === "edit" ? moduleClass.config.editRequiredFields : moduleClass.config.requiredFields)
//       || moduleClass.config.requiredFields
//       || [];
//     const fieldTypes = moduleClass.config.fieldTypes || {};
//     const fieldOptions = moduleClass.config.fieldOptions || {};
//     const fieldRules = moduleClass.config.fieldRules || {};

//     for (const field of required) {
//       const value = String(payload[field] ?? "").trim();
//       if (!value) {
//         return {
//           field,
//           message: `"${this.fieldLabel(field)}" is required.`
//         };
//       }
//     }

//     for (const [field, type] of Object.entries(fieldTypes)) {
//       const raw = String(payload[field] ?? "").trim();
//       if (!raw) {
//         continue;
//       }

//       if (type === "number") {
//         const parsed = Number(raw);
//         if (!Number.isFinite(parsed)) {
//           return {
//             field,
//             message: `"${this.fieldLabel(field)}" must be a valid number.`
//           };
//         }
//       }

//       if (type === "date") {
//         const parsed = Date.parse(raw);
//         if (Number.isNaN(parsed)) {
//           return {
//             field,
//             message: `"${this.fieldLabel(field)}" must be a valid date.`
//           };
//         }
//       }

//       if (type === "email") {
//         const ok = /^\S+@\S+\.\S+$/.test(raw);
//         if (!ok) {
//           return {
//             field,
//             message: `"${this.fieldLabel(field)}" must be a valid email address.`
//           };
//         }
//       }
//     }

//     for (const [field, options] of Object.entries(fieldOptions)) {
//       if (!Array.isArray(options) || !options.length) {
//         continue;
//       }

//       const value = String(payload[field] ?? "").trim();
//       if (!value) {
//         continue;
//       }

//       if (!options.map((opt) => String(opt)).includes(value)) {
//         return {
//           field,
//           message: `"${this.fieldLabel(field)}" must be one of: ${options.join(", ")}.`
//         };
//       }
//     }

//     for (const [field, rules] of Object.entries(fieldRules)) {
//       const raw = String(payload[field] ?? "").trim();
//       if (!raw) {
//         continue;
//       }

//       if (typeof rules.min === "number") {
//         const numeric = Number(raw);
//         if (!Number.isNaN(numeric) && numeric < rules.min) {
//           return {
//             field,
//             message: `"${this.fieldLabel(field)}" must be at least ${rules.min}.`
//           };
//         }
//       }

//       if (typeof rules.max === "number") {
//         const numeric = Number(raw);
//         if (!Number.isNaN(numeric) && numeric > rules.max) {
//           return {
//             field,
//             message: `"${this.fieldLabel(field)}" must be at most ${rules.max}.`
//           };
//         }
//       }

//       if (rules.notPast) {
//         const valueDate = new Date(raw);
//         if (!Number.isNaN(valueDate.getTime())) {
//           const today = new Date();
//           today.setHours(0, 0, 0, 0);
//           valueDate.setHours(0, 0, 0, 0);
//           if (valueDate < today) {
//             return {
//               field,
//               message: `"${this.fieldLabel(field)}" cannot be in the past.`
//             };
//           }
//         }
//       }

//       if (rules.notFuture) {
//         const valueDate = new Date(raw);
//         if (!Number.isNaN(valueDate.getTime())) {
//           const today = new Date();
//           today.setHours(0, 0, 0, 0);
//           valueDate.setHours(0, 0, 0, 0);
//           if (valueDate > today) {
//             return {
//               field,
//               message: `"${this.fieldLabel(field)}" cannot be in the future.`
//             };
//           }
//         }
//       }
//     }

//     return null;
//   }

//   static parsePayload(moduleClass, payload) {
//     const fieldTypes = moduleClass.config.fieldTypes || {};
//     const output = { ...payload };

//     Object.entries(fieldTypes).forEach(([field, type]) => {
//       const raw = String(output[field] ?? "").trim();
//       if (!raw) {
//         return;
//       }
//       if (type === "number") {
//         output[field] = Number(raw);
//       }
//     });

//     return output;
//   }

//   static getInputType(moduleClass, field) {
//     const typeMap = moduleClass.config.fieldTypes || {};
//     const declared = typeMap[field];
//     if (declared === "number") return "number";
//     if (declared === "date") return "date";
//     if (declared === "email") return "email";
//     if (declared === "password") return "password";
//     return "text";
//   }

//   static generatedFieldValue(moduleClass, field) {
//     const generator = moduleClass.config.fieldGenerators?.[field];
//     return typeof generator === "function" ? String(generator() || "") : "";
//   }

//   static buildColumns(rows, moduleClass) {
//     const configured = moduleClass.config.columns || [];
//     if (configured.length) return configured;

//     const row = rows.find(Boolean) || {};
//     return Object.keys(row)
//       .filter((key) => !["id", "created_at", "updated_at"].includes(key))
//       .slice(0, 6)
//       .map((key) => ({ key, label: key.replace(/_/g, " ") }));
//   }

//   static async load(moduleClass) {
//     const state = this.getState(moduleClass);
//     const { tableName, orderBy = "created_at" } = moduleClass.config;

//     state.profile = await this.resolveProfile();

//     state.rows = await API.records.getAll(tableName, {
//       orderBy,
//       ascending: false,
//       select: "*"
//     });

//     await this.loadLookups(moduleClass, state);

//     state.columns = this.buildColumns(state.rows, moduleClass);
//   }

//   static roleScopeCandidates(role) {
//     if (role === "teacher") {
//       return ["teacher_id", "profile_id", "created_by", "user_id"];
//     }
//     if (role === "student") {
//       return ["student_id", "profile_id", "user_id"];
//     }
//     if (role === "parent") {
//       return ["parent_id", "profile_id", "user_id"];
//     }
//     return [];
//   }

//   static applyRoleScope(rows, state, moduleClass) {
//     const role = String(state.profile?.role || "").toLowerCase();
//     const userId = String(state.profile?.id || "");

//     if (!role || !userId) {
//       return rows;
//     }

//     if (["ceo", "admin", "executive", "finance", "hr", "admission", "exam", "library"].includes(role)) {
//       return rows;
//     }

//     if (typeof moduleClass.config.scopeRows === "function") {
//       return moduleClass.config.scopeRows(rows, state.profile);
//     }

//     const keys = this.roleScopeCandidates(role);
//     if (!keys.length) {
//       return rows;
//     }

//     return rows.filter((row) => {
//       const keysPresent = keys.filter((key) => typeof row[key] !== "undefined" && row[key] !== null && row[key] !== "");
//       if (!keysPresent.length) {
//         return true;
//       }
//       return keysPresent.some((key) => String(row[key]) === userId);
//     });
//   }

//   static currentRole(state) {
//     return String(state?.profile?.role || "").toLowerCase();
//   }

//   static defaultRolePermissions(moduleClass) {
//     const moduleKey = String(moduleClass.config.moduleKey || "");

//     const byModule = {
//       teachers: ["ceo", "admin", "executive", "hr"],
//       parents: ["ceo", "admin", "executive", "admission"],
//       attendance: ["ceo", "admin", "executive", "teacher", "exam"],
//       assignments: ["ceo", "admin", "executive", "teacher", "exam"],
//       grades: ["ceo", "admin", "executive", "teacher", "exam"],
//       finance: ["ceo", "admin", "executive", "finance"],
//       notifications: ["ceo", "admin", "executive", "hr", "admission", "exam", "library", "finance"],
//       reports: []
//     };

//     const allowed = byModule[moduleKey] || ["ceo", "admin", "executive"];

//     return {
//       create: allowed,
//       edit: allowed,
//       delete: ["ceo", "admin", "executive"]
//     };
//   }

//   static deleteConfig(moduleClass) {
//     const softDelete = Boolean(moduleClass.config.softDelete);
//     const softDeleteField = String(moduleClass.config.softDeleteField || "status").trim();
//     const softDeleteValue = String(moduleClass.config.softDeleteValue || "archived").trim();
//     const softRestoreValue = String(moduleClass.config.softRestoreValue || "active").trim();

//     return {
//       softDelete,
//       softDeleteField,
//       softDeleteValue,
//       softRestoreValue
//     };
//   }

//   static isActionAllowed(moduleClass, state, action) {
//     if (moduleClass.config.readOnly) {
//       return false;
//     }

//     const role = this.currentRole(state);

//     if (!role) {
//       return false;
//     }

//     const permissions = moduleClass.config.permissions || this.defaultRolePermissions(moduleClass);
//     const allowedRoles = permissions[action] || [];

//     if (allowedRoles.includes("*")) {
//       return true;
//     }

//     return allowedRoles.includes(role);
//   }

//   static getRows(moduleClass) {
//     const state = this.getState(moduleClass);
//     const search = state.search.trim().toLowerCase();
//     const statusFilter = String(state.status || "all").toLowerCase();

//     let rows = this.applyRoleScope([...state.rows], state, moduleClass);

//     if (search) {
//       rows = rows.filter((row) => {
//         return state.columns.some((column) => {
//           const value = this.getDisplayValue(row, column.key, state).toLowerCase();
//           return value.includes(search);
//         });
//       });
//     }

//     if (statusFilter !== "all") {
//       rows = rows.filter((row) => String(row.status || "").toLowerCase() === statusFilter);
//     }

//     const key = state.sortKey;
//     if (key) {
//       rows.sort((a, b) => {
//         const aValue = this.getDisplayValue(a, key, state).toLowerCase();
//         const bValue = this.getDisplayValue(b, key, state).toLowerCase();

//         if (aValue < bValue) return state.sortDir === "asc" ? -1 : 1;
//         if (aValue > bValue) return state.sortDir === "asc" ? 1 : -1;
//         return 0;
//       });
//     }

//     return rows;
//   }

//   static pagedRows(moduleClass) {
//     const state = this.getState(moduleClass);
//     const rows = this.getRows(moduleClass);
//     const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
//     state.page = Math.min(state.page, totalPages);
//     const start = (state.page - 1) * state.pageSize;

//     return {
//       rows: rows.slice(start, start + state.pageSize),
//       total: rows.length,
//       totalPages
//     };
//   }

//   static statusOptions(moduleClass) {
//     const state = this.getState(moduleClass);
//     const set = new Set(["all"]);

//     state.rows.forEach((row) => {
//       if (row && typeof row.status !== "undefined" && row.status !== null && String(row.status).trim()) {
//         set.add(String(row.status).toLowerCase());
//       }
//     });

//     return Array.from(set);
//   }

//   static template(moduleClass) {
//     const state = this.getState(moduleClass);
//     const pageData = this.pagedRows(moduleClass);
//     const statusOptions = this.statusOptions(moduleClass);
//     const canWrite = !moduleClass.config.readOnly;
//     const canCreate = this.isActionAllowed(moduleClass, state, "create");

//     return `
// <div class="space-y-6">
//   <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
//     <div>
//       <h2 class="text-3xl font-bold text-slate-800">${this.safe(moduleClass.config.title)}</h2>
//       <p class="text-sm text-slate-500 mt-1">Live records with search, sorting, pagination, and exports.</p>
//     </div>
//     <div class="flex flex-wrap items-center gap-2">
//       ${canWrite && canCreate ? `<button data-action="create" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Add Record</button>` : ""}
//       <button data-action="refresh" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Refresh</button>
//       <button data-action="csv" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Export CSV</button>
//       <button data-action="excel" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Export Excel</button>
//       <button data-action="print" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Print</button>
//     </div>
//   </div>

//   <div class="bg-white rounded-xl shadow p-4 md:p-5">
//     <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
//       <input data-input="search" data-module="${this.safe(moduleClass.config.moduleKey)}" value="${this.safe(state.search)}" placeholder="Search records..." class="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2.5" />
//       <select data-input="sort" data-module="${this.safe(moduleClass.config.moduleKey)}" class="rounded-lg border border-slate-300 px-3 py-2.5">
//         ${state.columns.map((col) => `<option value="${this.safe(col.key)}" ${state.sortKey === col.key ? "selected" : ""}>Sort: ${this.safe(col.label || col.key)}</option>`).join("")}
//       </select>
//       <select data-input="status" data-module="${this.safe(moduleClass.config.moduleKey)}" class="rounded-lg border border-slate-300 px-3 py-2.5">
//         ${statusOptions.map((option) => `<option value="${this.safe(option)}" ${state.status === option ? "selected" : ""}>${option === "all" ? "All Status" : this.safe(option)}</option>`).join("")}
//       </select>
//     </div>

//     <div class="overflow-x-auto">
//       <table class="min-w-full text-sm">
//         <thead>
//           <tr class="border-b border-slate-200 text-left text-slate-600">
//             ${state.columns.map((col) => `<th class="px-3 py-2.5 font-semibold">${this.safe(col.label || col.key)}</th>`).join("")}
//             <th class="px-3 py-2.5 font-semibold text-right">Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${pageData.rows.length ? pageData.rows.map((row) => this.rowTemplate(row, state.columns, moduleClass)).join("") : `<tr><td colspan="${state.columns.length + 1}" class="px-3 py-8 text-center text-slate-500">No records found.</td></tr>`}
//         </tbody>
//       </table>
//     </div>

//     <div class="mt-4 flex items-center justify-between gap-3 text-sm">
//       <div class="text-slate-500">Showing ${pageData.rows.length} of ${pageData.total} record(s).</div>
//       <div class="flex items-center gap-2">
//         <button data-action="prev" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50" ${state.page <= 1 ? "disabled" : ""}>Prev</button>
//         <span class="text-slate-600">Page ${state.page} / ${pageData.totalPages}</span>
//         <button data-action="next" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50" ${state.page >= pageData.totalPages ? "disabled" : ""}>Next</button>
//       </div>
//     </div>
//   </div>
// </div>
// ${this.modalTemplate(moduleClass)}
// `;
//   }

//   static rowTemplate(row, columns, moduleClass) {
//     const state = this.getState(moduleClass);
//     const deletion = this.deleteConfig(moduleClass);
//     const canEdit = this.isActionAllowed(moduleClass, state, "edit");
//     const canDelete = this.isActionAllowed(moduleClass, state, "delete");
//     const rowStatus = String(row?.[deletion.softDeleteField] || "").toLowerCase();
//     const isArchived = deletion.softDelete && rowStatus === String(deletion.softDeleteValue || "").toLowerCase();
//     const canRestore = deletion.softDelete && this.isActionAllowed(moduleClass, state, "edit");
//     const canWrite = canEdit || canDelete || canRestore;
//     const cells = columns.map((column) => {
//       const rawValue = this.getDisplayValue(row, column.key, state);
//       const value = rawValue.length > 80 ? `${rawValue.slice(0, 77)}...` : rawValue;
//       return `<td class="px-3 py-2.5 border-b border-slate-100">${this.safe(value)}</td>`;
//     }).join("");

//     const rowId = this.safe(row.id || "");

//     return `
// <tr class="hover:bg-slate-50">
//   ${cells}
//   <td class="px-3 py-2.5 border-b border-slate-100 text-right">
//     ${isArchived
//       ? (canRestore
//         ? `<button data-action="restore" data-id="${rowId}" data-module="${this.safe(moduleClass.config.moduleKey)}" class="text-emerald-600 hover:text-emerald-700">Restore</button>`
//         : `<span class="text-slate-400">Archived</span>`)
//       : `${canEdit ? `<button data-action="edit" data-id="${rowId}" data-module="${this.safe(moduleClass.config.moduleKey)}" class="text-blue-600 hover:text-blue-700 mr-3">Edit</button>` : ""}${canDelete ? `<button data-action="delete" data-id="${rowId}" data-module="${this.safe(moduleClass.config.moduleKey)}" class="text-red-600 hover:text-red-700">${deletion.softDelete ? "Archive" : "Delete"}</button>` : ""}`}
//     ${canWrite ? "" : `<span class="text-slate-400">Read only</span>`}
//   </td>
// </tr>
// `;
//   }

//   static async render(moduleClass, container) {
//     const state = this.getState(moduleClass);
//     state.container = container;

//     container.innerHTML = `
// <div class="bg-white rounded-xl shadow p-8 text-center text-slate-500">
//   Loading ${this.safe(moduleClass.config.title)}...
// </div>
// `;

//     await this.load(moduleClass);
//     container.innerHTML = this.template(moduleClass);
//     this.bindEvents(moduleClass);
//   }

//   static bindEvents(moduleClass) {
//     const state = this.getState(moduleClass);
//     const container = state.container;
//     if (!container) return;

//     const searchInput = container.querySelector('[data-input="search"]');
//     const sortInput = container.querySelector('[data-input="sort"]');
//     const statusInput = container.querySelector('[data-input="status"]');

//     if (searchInput) {
//       searchInput.addEventListener("input", () => {
//         state.search = searchInput.value || "";
//         state.page = 1;
//         container.innerHTML = this.template(moduleClass);
//         this.bindEvents(moduleClass);
//       });
//     }

//     if (sortInput) {
//       sortInput.addEventListener("change", () => {
//         if (state.sortKey === sortInput.value) {
//           state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
//         } else {
//           state.sortKey = sortInput.value;
//           state.sortDir = "asc";
//         }
//         container.innerHTML = this.template(moduleClass);
//         this.bindEvents(moduleClass);
//       });
//     }

//     if (statusInput) {
//       statusInput.addEventListener("change", () => {
//         state.status = statusInput.value;
//         state.page = 1;
//         container.innerHTML = this.template(moduleClass);
//         this.bindEvents(moduleClass);
//       });
//     }

//     container.querySelectorAll("[data-action]").forEach((button) => {
//       button.addEventListener("click", async () => {
//         const action = button.getAttribute("data-action");
//         const id = button.getAttribute("data-id");
//         await this.handleAction(moduleClass, action, id);
//       });
//     });

//     this.bindModalEvents(moduleClass);
//   }

//   static async handleAction(moduleClass, action, id) {
//     const state = this.getState(moduleClass);

//     if (action === "prev") {
//       state.page = Math.max(1, state.page - 1);
//       state.container.innerHTML = this.template(moduleClass);
//       this.bindEvents(moduleClass);
//       return;
//     }

//     if (action === "next") {
//       const total = this.getRows(moduleClass).length;
//       const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
//       state.page = Math.min(totalPages, state.page + 1);
//       state.container.innerHTML = this.template(moduleClass);
//       this.bindEvents(moduleClass);
//       return;
//     }

//     if (action === "refresh") {
//       await this.render(moduleClass, state.container);
//       this.showMessage("Module refreshed.", "success");
//       return;
//     }

//     if (action === "csv") {
//       this.exportRows(moduleClass, "csv");
//       return;
//     }

//     if (action === "excel") {
//       this.exportRows(moduleClass, "excel");
//       return;
//     }

//     if (action === "print") {
//       this.printRows(moduleClass);
//       return;
//     }

//     if (moduleClass.config.readOnly) {
//       this.showMessage("This module is read-only for safety.", "error");
//       return;
//     }

//     if (["create", "edit", "delete"].includes(action) && !this.isActionAllowed(moduleClass, state, action)) {
//       this.showMessage("You do not have permission to perform this action.", "error");
//       return;
//     }

//     if (action === "restore" && !this.isActionAllowed(moduleClass, state, "edit")) {
//       this.showMessage("You do not have permission to restore this record.", "error");
//       return;
//     }

//     if (action === "create") {
//       this.openModal(moduleClass, "create");
//       return;
//     }

//     if (action === "edit") {
//       const row = state.rows.find((item) => String(item.id) === String(id));
//       if (!row) {
//         this.showMessage("Record not found.", "error");
//         return;
//       }
//       this.openModal(moduleClass, "edit", id);
//       return;
//     }

//     if (action === "delete") {
//       const deletion = this.deleteConfig(moduleClass);
//       const promptMessage = deletion.softDelete
//         ? "Archive this record? It will remain in the database and can be restored later."
//         : "Delete this record permanently?";

//       const confirmed = window.confirm(promptMessage);
//       if (!confirmed) return;

//       const existing = state.rows.find((item) => String(item.id) === String(id)) || null;

//       let result;

//       if (deletion.softDelete) {
//         result = await API.records.update(
//           moduleClass.config.tableName,
//           id,
//           {
//             [deletion.softDeleteField]: deletion.softDeleteValue
//           }
//         );
//       } else {
//         result = await API.records.remove(moduleClass.config.tableName, id);
//       }

//       if (!result.success) {
//         this.showMessage(result.message || "Unable to remove record.", "error");
//         return;
//       }

//       await this.auditAction(
//         moduleClass,
//         state,
//         deletion.softDelete ? "archive" : "delete",
//         existing || {},
//         id
//       );

//       const okMessage = deletion.softDelete
//         ? "Record archived successfully."
//         : (result.message || "Record deleted.");

//       this.showMessage(okMessage, "success");
//       await this.render(moduleClass, state.container);
//       return;
//     }

//     if (action === "restore") {
//       const deletion = this.deleteConfig(moduleClass);
//       const existing = state.rows.find((item) => String(item.id) === String(id)) || null;

//       const result = await API.records.update(
//         moduleClass.config.tableName,
//         id,
//         {
//           [deletion.softDeleteField]: deletion.softRestoreValue
//         }
//       );

//       if (!result.success) {
//         this.showMessage(result.message || "Unable to restore record.", "error");
//         return;
//       }

//       await this.auditAction(moduleClass, state, "restore", existing || {}, id);

//       this.showMessage("Record restored successfully.", "success");
//       await this.render(moduleClass, state.container);
//       return;
//     }
//   }

//   static openModal(moduleClass, mode = "create", rowId = null) {
//     const state = this.getState(moduleClass);
//     state.modal = {
//       open: true,
//       mode,
//       rowId
//     };
//     state.container.innerHTML = this.template(moduleClass);
//     this.bindEvents(moduleClass);
//   }

//   static closeModal(moduleClass) {
//     const state = this.getState(moduleClass);
//     state.modal = {
//       open: false,
//       mode: "create",
//       rowId: null
//     };
//     state.container.innerHTML = this.template(moduleClass);
//     this.bindEvents(moduleClass);
//   }

//   static modalTemplate(moduleClass) {
//     const state = this.getState(moduleClass);
//     if (!state.modal?.open) {
//       return "";
//     }

//     const fields = (state.modal.mode === "edit" ? moduleClass.config.editFormFields : moduleClass.config.formFields)
//       || (moduleClass.config.columns || []).map((col) => col.key);
//     const row = state.modal.mode === "edit"
//       ? state.rows.find((item) => String(item.id) === String(state.modal.rowId)) || null
//       : null;

//     const title = state.modal.mode === "edit"
//       ? `Edit ${moduleClass.config.title}`
//       : `Add ${moduleClass.config.title.slice(0, -1) || moduleClass.config.title}`;

//     const inputs = fields
//       .filter((field) => !["id", "created_at", "updated_at"].includes(field))
//       .map((field) => {
//         const label = field.replace(/_/g, " ").replace(/\b\w/g, (chr) => chr.toUpperCase());
//         const value = row ? this.normalizeRowValue(row[field]) : this.generatedFieldValue(moduleClass, field);
//         const safeValue = this.safe(value === "-" ? "" : value);

//         const options = moduleClass.config.fieldOptions?.[field] || null;
//         const lookupMap = state.lookups?.[field]?.map || null;
//         const required = (moduleClass.config.requiredFields || []).includes(field);

//         if (options && Array.isArray(options) && options.length) {
//           return `
// <label class="block">
//   <span class="text-sm text-slate-700">${this.safe(label)}${required ? " *" : ""}</span>
//   <select name="${this.safe(field)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
//     <option value="">Select ${this.safe(label)}</option>
//     ${options.map((option) => `<option value="${this.safe(option)}" ${String(option) === String(value) ? "selected" : ""}>${this.safe(option)}</option>`).join("")}
//   </select>
//   <span data-field-error="${this.safe(field)}" class="hidden mt-1 block text-xs text-red-600"></span>
// </label>
// `;
//         }

//         if (lookupMap && typeof lookupMap === "object") {
//           const current = row ? String(row[field] ?? "") : "";
//           return `
// <label class="block">
//   <span class="text-sm text-slate-700">${this.safe(label)}${required ? " *" : ""}</span>
//   <select name="${this.safe(field)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
//     <option value="">Select ${this.safe(label)}</option>
//     ${Object.entries(lookupMap).map(([id, text]) => `<option value="${this.safe(id)}" ${id === current ? "selected" : ""}>${this.safe(text)}</option>`).join("")}
//   </select>
//   <span data-field-error="${this.safe(field)}" class="hidden mt-1 block text-xs text-red-600"></span>
// </label>
// `;
//         }

//         const inputType = this.getInputType(moduleClass, field);
//         const canGenerate = !row && typeof moduleClass.config.fieldGenerators?.[field] === "function";
//         const generateLabel = moduleClass.config.fieldGeneratorLabels?.[field] || "Generate";
//         return `
// <label class="block">
//   <span class="text-sm text-slate-700">${this.safe(label)}${required ? " *" : ""}</span>
//   <div class="mt-1 flex gap-2">
//     <input type="${inputType}" name="${this.safe(field)}" value="${safeValue}" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
//     ${canGenerate ? `<button type="button" data-generate-field="${this.safe(field)}" class="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">${this.safe(generateLabel)}</button>` : ""}
//   </div>
//   <span data-field-error="${this.safe(field)}" class="hidden mt-1 block text-xs text-red-600"></span>
// </label>
// `;
//       }).join("");

//     return `
// <div class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center px-4" data-modal-overlay="${this.safe(moduleClass.config.moduleKey)}">
//   <div class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6">
//     <div class="flex items-center justify-between mb-4">
//       <h3 class="text-xl font-bold text-slate-800">${this.safe(title)}</h3>
//       <button type="button" data-modal-close="${this.safe(moduleClass.config.moduleKey)}" class="text-slate-500 hover:text-slate-700">Close</button>
//     </div>
//     <form data-modal-form="${this.safe(moduleClass.config.moduleKey)}" class="grid grid-cols-1 md:grid-cols-2 gap-4">
//       <div data-modal-error class="hidden md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
//       ${inputs}
//       <div class="md:col-span-2 flex items-center justify-end gap-3 mt-2">
//         <button type="button" data-modal-close="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
//         <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
//       </div>
//     </form>
//   </div>
// </div>
// `;
//   }

//   static bindModalEvents(moduleClass) {
//     const state = this.getState(moduleClass);
//     const container = state.container;
//     if (!container) return;

//     container.querySelectorAll("[data-modal-close]").forEach((button) => {
//       button.addEventListener("click", () => {
//         this.closeModal(moduleClass);
//       });
//     });

//     const overlay = container.querySelector(`[data-modal-overlay="${moduleClass.config.moduleKey}"]`);
//     if (overlay) {
//       overlay.addEventListener("click", (event) => {
//         if (event.target === overlay) {
//           this.closeModal(moduleClass);
//         }
//       });
//     }

//     const form = container.querySelector(`[data-modal-form="${moduleClass.config.moduleKey}"]`);
//     container.querySelectorAll("[data-generate-field]").forEach((button) => {
//       button.addEventListener("click", () => {
//         const field = button.getAttribute("data-generate-field");
//         const input = field ? form?.querySelector(`[name="${field}"]`) : null;
//         if (input && field) input.value = this.generatedFieldValue(moduleClass, field);
//       });
//     });

//     if (form) {
//       form.addEventListener("submit", async (event) => {
//         event.preventDefault();

//         this.clearModalErrors(form);

//         const formData = new FormData(form);
//         const payload = {};

//         for (const [key, value] of formData.entries()) {
//           payload[key] = String(value || "").trim();
//         }

//         const hasAnyValue = Object.values(payload).some((value) => String(value).trim() !== "");
//         if (!hasAnyValue) {
//           this.showModalError(form, "Please provide at least one value.");
//           return;
//         }

//         const validationError = this.validatePayload(moduleClass, payload, state.modal.mode);
//         if (validationError) {
//           this.showModalError(form, validationError.message);
//           this.showFieldError(form, validationError.field, validationError.message);
//           return;
//         }

//         const parsedPayload = this.parsePayload(moduleClass, payload);

//         let result;

//         if (state.modal.mode === "edit" && state.modal.rowId) {
//           result = await API.records.update(moduleClass.config.tableName, state.modal.rowId, parsedPayload);
//         } else if (typeof moduleClass.config.createRecord === "function") {
//           result = await moduleClass.config.createRecord(parsedPayload);
//         } else {
//           result = await API.records.create(moduleClass.config.tableName, parsedPayload);
//         }

//         if (!result?.success) {
//           this.showModalError(form, result?.message || "Unable to save record.");
//           return;
//         }

//         const action = state.modal.mode === "edit" ? "update" : "create";
//         const recordId = state.modal.mode === "edit"
//           ? state.modal.rowId
//           : (result?.data?.id || null);

//         await this.auditAction(moduleClass, state, action, parsedPayload, recordId);

//         this.showMessage(result.message || "Record saved successfully.", "success");
//         this.closeModal(moduleClass);
//         await this.render(moduleClass, state.container);
//       });
//     }
//   }

//   static promptForPayload(moduleClass, existingRow = null) {
//     const fields = moduleClass.config.formFields ||
//       (moduleClass.config.columns || []).map((col) => col.key);

//     if (!fields.length) {
//       alert("No editable fields configured for this module.");
//       return null;
//     }

//     const payload = {};

//     for (const field of fields) {
//       if (["id", "created_at", "updated_at"].includes(field)) {
//         continue;
//       }

//       const label = field.replace(/_/g, " ").replace(/\b\w/g, (chr) => chr.toUpperCase());
//       const currentValue = existingRow ? this.normalizeRowValue(existingRow[field]) : "";
//       const answer = window.prompt(`${label}:`, currentValue);

//       if (answer === null) {
//         return null;
//       }

//       payload[field] = answer.trim();
//     }

//     return payload;
//   }

//   static exportRows(moduleClass, type = "csv") {
//     const state = this.getState(moduleClass);
//     const rows = this.getRows(moduleClass);
//     const columns = state.columns;

//     const header = columns.map((col) => `"${String(col.label || col.key).replace(/"/g, '""')}"`).join(",");
//     const body = rows.map((row) => {
//       return columns.map((col) => {
//         const value = this.getDisplayValue(row, col.key, state);
//         return `"${String(value).replace(/"/g, '""')}"`;
//       }).join(",");
//     }).join("\n");

//     const csv = `${header}\n${body}`;
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
//     const ext = type === "excel" ? "xls" : "csv";

//     link.href = url;
//     link.download = `${moduleClass.config.moduleKey}-${stamp}.${ext}`;
//     document.body.appendChild(link);
//     link.click();
//     link.remove();
//     URL.revokeObjectURL(url);

//     this.showMessage(`${moduleClass.config.title} exported (${type.toUpperCase()}).`, "success");
//   }

//   static printRows(moduleClass) {
//     const state = this.getState(moduleClass);
//     const rows = this.getRows(moduleClass);
//     const columns = state.columns;

//     const tableRows = rows.map((row) => {
//       const cells = columns.map((col) => `<td>${this.safe(this.getDisplayValue(row, col.key, state))}</td>`).join("");
//       return `<tr>${cells}</tr>`;
//     }).join("");

//     const html = `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8" />
//   <title>${this.safe(moduleClass.config.title)} Print</title>
//   <style>
//     body { font-family: Arial, sans-serif; padding: 24px; }
//     h1 { margin-bottom: 16px; }
//     table { width: 100%; border-collapse: collapse; }
//     th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
//     th { background: #f1f5f9; }
//   </style>
// </head>
// <body>
//   <h1>${this.safe(moduleClass.config.title)}</h1>
//   <table>
//     <thead>
//       <tr>${columns.map((col) => `<th>${this.safe(col.label || col.key)}</th>`).join("")}</tr>
//     </thead>
//     <tbody>${tableRows}</tbody>
//   </table>
// </body>
// </html>
// `;

//     const w = window.open("", "_blank", "noopener,noreferrer");
//     if (!w) {
//       this.showMessage("Unable to open print window.", "error");
//       return;
//     }

//     w.document.open();
//     w.document.write(html);
//     w.document.close();
//     w.focus();
//     w.print();
//   }
// }

// window.OfficeModuleEngine = OfficeModuleEngine;

// if (!window.TeachersModule) {
//   window.TeachersModule = window.OfficeModuleEngine.create({ moduleKey: "teachers", title: "Teachers", tableName: "teachers", columns: [] });
// }

// if (!window.ParentsModule) {
//   window.ParentsModule = window.OfficeModuleEngine.create({ moduleKey: "parents", title: "Parents", tableName: "parents", columns: [] });
// }

// if (!window.AttendanceModule) {
//   window.AttendanceModule = window.OfficeModuleEngine.create({ moduleKey: "attendance", title: "Attendance", tableName: "attendance", columns: [] });
// }

// if (!window.AssignmentModule) {
//   window.AssignmentModule = window.OfficeModuleEngine.create({ moduleKey: "assignments", title: "Assignments", tableName: "assignments", columns: [] });
// }

// if (!window.GradesModule) {
//   window.GradesModule = window.OfficeModuleEngine.create({ moduleKey: "grades", title: "Grades", tableName: "grades", columns: [] });
// }

// if (!window.FinanceModule) {
//   window.FinanceModule = window.OfficeModuleEngine.create({ moduleKey: "finance", title: "Finance", tableName: "payments", columns: [] });
// }

// if (!window.ReportsModule) {
//   window.ReportsModule = window.OfficeModuleEngine.create({ moduleKey: "reports", title: "Reports", tableName: "activity_logs", readOnly: true, columns: [] });
// }

// if (!window.NotificationModule) {
//   window.NotificationModule = window.OfficeModuleEngine.create({ moduleKey: "notifications", title: "Notifications", tableName: "notifications", columns: [] });
// }

// if (!window.AIModule) {
//   window.AIModule = class {
//     static async render(container) {
//       container.innerHTML = '<div class="bg-white rounded-xl shadow p-6 text-slate-600">AI Assistant is ready.</div>';
//     }
//   };
// }

'use strict';

/* =========================================================
   EMERGENCE ACADEMY — MODULE STUB
   Student-aware module loader
   ========================================================= */

const ModuleStub = (() => {
    const state = {
        profile: null,
        student: null,
        studentId: null,
        enrollment: null,
        enrollments: [],
        subjects: [],
        initialized: false,
        loading: false
    };

    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    const supabaseClient = () => {
        if (typeof window !== 'undefined' && window.supabaseClient) {
            return window.supabaseClient;
        }

        if (typeof window !== 'undefined' && window.supabase) {
            return window.supabase;
        }

        return null;
    };

    const getClient = () => {
        const client = supabaseClient();

        if (!client) {
            throw new Error('Supabase client is not available.');
        }

        return client;
    };

    const escapeHtml = (value) => {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const showError = (message) => {
        console.error('[ModuleStub]', message);

        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(message, 'error');
            return;
        }

        if (typeof window !== 'undefined' && typeof window.toast === 'function') {
            window.toast(message, 'error');
        }
    };

    const showSuccess = (message) => {
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(message, 'success');
            return;
        }

        if (typeof window !== 'undefined' && typeof window.toast === 'function') {
            window.toast(message, 'success');
        }
    };

    const getCurrentPath = () => {
        if (typeof window === 'undefined') {
            return '';
        }

        return window.location.pathname || '';
    };

    const getCurrentModule = () => {
        if (typeof window === 'undefined') {
            return '';
        }

        const params = new URLSearchParams(window.location.search);

        return (
            params.get('module') ||
            params.get('page') ||
            window.currentModule ||
            ''
        );
    };

    /* =====================================================
       AUTH / PROFILE / STUDENT RESOLUTION
       ===================================================== */

    async function getAuthenticatedUser() {
        const client = getClient();

        const { data, error } = await client.auth.getUser();

        if (error) {
            throw error;
        }

        return data?.user || null;
    }

    async function loadProfile(userId) {
        if (!userId) {
            return null;
        }

        const client = getClient();

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;
    }

    /*
     * IMPORTANT:
     *
     * profiles.id and students.id are NOT the same UUID.
     *
     * The relationship is:
     *
     *     auth.uid()
     *         ↓
     *     profiles.id
     *         ↓
     *     students.profile_id
     *         ↓
     *     students.id
     *
     * Student modules must use students.id when filtering
     * tables whose foreign key is student_id.
     */
    async function loadStudent(profileId) {
        if (!profileId) {
            return null;
        }

        const client = getClient();

        const { data, error } = await client
            .from('students')
            .select('*')
            .eq('profile_id', profileId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;
    }

    async function loadStudentEnrollments(studentId) {
        if (!studentId) {
            return [];
        }

        const client = getClient();

        const { data, error } = await client
            .from('student_enrollments')
            .select(`
                *,
                classes (
                    id,
                    class_name,
                    class_code
                ),
                academic_sessions (
                    id,
                    session_name,
                    start_date,
                    end_date,
                    is_current
                )
            `)
            .eq('student_id', studentId)
            .order('enrolled_at', { ascending: false });

        if (error) {
            throw error;
        }

        return data || [];
    }

    async function loadStudentSubjects(studentId) {
        if (!studentId) {
            return [];
        }

        const client = getClient();

        const { data, error } = await client
            .from('student_subjects')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `)
            .eq('student_id', studentId);

        if (error) {
            throw error;
        }

        return data || [];
    }

    async function resolveStudentContext() {
        const client = getClient();

        const user = await getAuthenticatedUser();

        if (!user) {
            state.profile = null;
            state.student = null;
            state.studentId = null;
            state.enrollment = null;
            state.enrollments = [];
            state.subjects = [];

            return null;
        }

        const profile = await loadProfile(user.id);

        state.profile = profile;

        if (!profile || profile.role !== 'student') {
            state.student = null;
            state.studentId = null;
            state.enrollment = null;
            state.enrollments = [];
            state.subjects = [];

            return {
                user,
                profile,
                student: null
            };
        }

        const student = await loadStudent(profile.id);

        state.student = student;
        state.studentId = student?.id || null;

        if (!student) {
            state.enrollment = null;
            state.enrollments = [];
            state.subjects = [];

            console.warn(
                '[ModuleStub] Student profile exists but no students record was found.'
            );

            return {
                user,
                profile,
                student: null
            };
        }

        const enrollments = await loadStudentEnrollments(student.id);
        const subjects = await loadStudentSubjects(student.id);

        state.enrollments = enrollments;
        state.subjects = subjects;

        state.enrollment =
            enrollments.find(
                enrollment =>
                    enrollment?.academic_sessions?.is_current === true
            ) ||
            enrollments[0] ||
            null;

        return {
            user,
            profile,
            student,
            enrollments,
            enrollment: state.enrollment,
            subjects
        };
    }

    /* =====================================================
       STUDENT CONTEXT HELPERS
       ===================================================== */

    function isStudent() {
        return state.profile?.role === 'student';
    }

    function getStudentId() {
        return state.studentId || state.student?.id || null;
    }

    function getProfileId() {
        return state.profile?.id || null;
    }

    function getStudentClassIds() {
        const ids = [];

        for (const enrollment of state.enrollments || []) {
            if (enrollment?.class_id) {
                ids.push(enrollment.class_id);
            }
        }

        if (state.student?.class_id) {
            ids.push(state.student.class_id);
        }

        return [...new Set(ids.filter(Boolean))];
    }

    function getStudentSubjectIds() {
        return [
            ...new Set(
                (state.subjects || [])
                    .map(row => row?.subject_id)
                    .filter(Boolean)
            )
        ];
    }

    function getCurrentEnrollment() {
        return (
            state.enrollments?.find(
                enrollment =>
                    enrollment?.academic_sessions?.is_current === true
            ) ||
            state.enrollment ||
            null
        );
    }

    function getCurrentClassId() {
        const enrollment = getCurrentEnrollment();

        return (
            enrollment?.class_id ||
            state.student?.class_id ||
            null
        );
    }

    function getCurrentSessionId() {
        const enrollment = getCurrentEnrollment();

        return (
            enrollment?.session_id ||
            enrollment?.academic_sessions?.id ||
            null
        );
    }

    function getCurrentSubjectIds() {
        return getStudentSubjectIds();
    }

    /* =====================================================
       STUDENT-SPECIFIC QUERY SCOPING
       ===================================================== */

    /*
     * Tables whose student_id column refers to students.id.
     */
    const STUDENT_ID_TABLES = new Set([
        'attendance',
        'assignment_submissions',
        'grades',
        'exam_results',
        'report_cards',
        'payments',
        'invoices',
        'library_loans',
        'student_transport',
        'hostel_allocations',
        'student_enrollments',
        'student_subjects'
    ]);

    /*
     * Tables whose user/profile identity is profiles.id.
     */
    const PROFILE_ID_TABLES = new Set([
        'notifications'
    ]);

    /*
     * Assignment records require BOTH:
     *
     *     class_id = one of the student's enrolled classes
     *
     * and:
     *
     *     subject_id = one of the student's assigned subjects
     */
    const ASSIGNMENT_TABLES = new Set([
        'assignments'
    ]);

    /*
     * Live classes use enrollment/class/subject context.
     */
    const LIVE_CLASS_TABLES = new Set([
        'live_classes'
    ]);

    function hasStudentContext() {
        return Boolean(getStudentId());
    }

    function hasClassContext() {
        return getStudentClassIds().length > 0;
    }

    function hasSubjectContext() {
        return getStudentSubjectIds().length > 0;
    }

    function scopeStudentQuery(query, tableName) {
        if (!isStudent()) {
            return query;
        }

        const studentId = getStudentId();

        if (!studentId) {
            /*
             * Fail closed.
             *
             * A student without a valid students.id must not
             * accidentally receive unfiltered student data.
             */
            return query.eq('student_id', '00000000-0000-0000-0000-000000000000');
        }

        if (STUDENT_ID_TABLES.has(tableName)) {
            return query.eq('student_id', studentId);
        }

        if (PROFILE_ID_TABLES.has(tableName)) {
            const profileId = getProfileId();

            if (!profileId) {
                return query.eq('user_id', '00000000-0000-0000-0000-000000000000');
            }

            return query.eq('user_id', profileId);
        }

        if (ASSIGNMENT_TABLES.has(tableName)) {
            const classIds = getStudentClassIds();
            const subjectIds = getStudentSubjectIds();

            /*
             * If either side of the student's academic context
             * cannot be resolved, fail closed.
             */
            if (!classIds.length || !subjectIds.length) {
                return query.eq(
                    'id',
                    '00000000-0000-0000-0000-000000000000'
                );
            }

            return query
                .in('class_id', classIds)
                .in('subject_id', subjectIds);
        }

        if (LIVE_CLASS_TABLES.has(tableName)) {
            const classIds = getStudentClassIds();
            const subjectIds = getStudentSubjectIds();

            if (!classIds.length) {
                return query.eq(
                    'id',
                    '00000000-0000-0000-0000-000000000000'
                );
            }

            /*
             * live_classes may not have subject_id in every
             * deployment, so class filtering is applied here.
             * Additional subject filtering is handled where
             * the returned row contains subject_id.
             */
            return query.in('class_id', classIds);
        }

        return query;
    }

    function filterReturnedStudentRows(rows, tableName) {
        if (!isStudent()) {
            return rows || [];
        }

        const studentId = getStudentId();
        const profileId = getProfileId();

        if (STUDENT_ID_TABLES.has(tableName)) {
            return (rows || []).filter(
                row => row?.student_id === studentId
            );
        }

        if (PROFILE_ID_TABLES.has(tableName)) {
            return (rows || []).filter(
                row =>
                    row?.user_id === profileId ||
                    row?.profile_id === profileId
            );
        }

        if (ASSIGNMENT_TABLES.has(tableName)) {
            const classIds = new Set(getStudentClassIds());
            const subjectIds = new Set(getStudentSubjectIds());

            return (rows || []).filter(row => {
                const classMatches =
                    !row?.class_id ||
                    classIds.has(row.class_id);

                const subjectMatches =
                    !row?.subject_id ||
                    subjectIds.has(row.subject_id);

                return classMatches && subjectMatches;
            });
        }

        if (LIVE_CLASS_TABLES.has(tableName)) {
            const classIds = new Set(getStudentClassIds());
            const subjectIds = new Set(getStudentSubjectIds());

            return (rows || []).filter(row => {
                const classMatches =
                    !row?.class_id ||
                    classIds.has(row.class_id);

                const subjectMatches =
                    !row?.subject_id ||
                    subjectIds.has(row.subject_id);

                return classMatches && subjectMatches;
            });
        }

        return rows || [];
    }

    /* =====================================================
       GENERIC QUERY BUILDER
       ===================================================== */

    async function fetchModuleData({
        table,
        select = '*',
        filters = [],
        orderBy = null,
        ascending = false,
        limit = null
    }) {
        const client = getClient();

        let query = client
            .from(table)
            .select(select);

        query = scopeStudentQuery(query, table);

        for (const filter of filters || []) {
            if (!filter || !filter.type) {
                continue;
            }

            switch (filter.type) {
                case 'eq':
                    query = query.eq(filter.column, filter.value);
                    break;

                case 'neq':
                    query = query.neq(filter.column, filter.value);
                    break;

                case 'gt':
                    query = query.gt(filter.column, filter.value);
                    break;

                case 'gte':
                    query = query.gte(filter.column, filter.value);
                    break;

                case 'lt':
                    query = query.lt(filter.column, filter.value);
                    break;

                case 'lte':
                    query = query.lte(filter.column, filter.value);
                    break;

                case 'in':
                    query = query.in(filter.column, filter.value);
                    break;

                case 'is':
                    query = query.is(filter.column, filter.value);
                    break;

                case 'ilike':
                    query = query.ilike(filter.column, filter.value);
                    break;

                case 'like':
                    query = query.like(filter.column, filter.value);
                    break;

                case 'or':
                    query = query.or(filter.value);
                    break;

                default:
                    console.warn(
                        '[ModuleStub] Unsupported filter type:',
                        filter.type
                    );
            }
        }

        if (orderBy) {
            query = query.order(orderBy, {
                ascending
            });
        }

        if (limit !== null && limit !== undefined) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return filterReturnedStudentRows(
            data || [],
            table
        );
    }

    /* =====================================================
       MODULE CONFIGURATION
       ===================================================== */

    const MODULE_CONFIG = {
        assignments: {
            table: 'assignments',
            title: 'Assignments',
            studentScoped: true
        },

        attendance: {
            table: 'attendance',
            title: 'Attendance',
            studentScoped: true
        },

        grades: {
            table: 'grades',
            title: 'Grades',
            studentScoped: true
        },

        exam_results: {
            table: 'exam_results',
            title: 'Exam Results',
            studentScoped: true
        },

        report_cards: {
            table: 'report_cards',
            title: 'Report Cards',
            studentScoped: true
        },

        payments: {
            table: 'payments',
            title: 'Payments',
            studentScoped: true
        },

        invoices: {
            table: 'invoices',
            title: 'Invoices',
            studentScoped: true
        },

        library_loans: {
            table: 'library_loans',
            title: 'Library',
            studentScoped: true
        },

        student_transport: {
            table: 'student_transport',
            title: 'Transport',
            studentScoped: true
        },

        hostel_allocations: {
            table: 'hostel_allocations',
            title: 'Hostel',
            studentScoped: true
        },

        notifications: {
            table: 'notifications',
            title: 'Notifications',
            profileScoped: true
        },

        live_classes: {
            table: 'live_classes',
            title: 'Live Classes',
            studentScoped: true
        },

        student_subjects: {
            table: 'student_subjects',
            title: 'Subjects',
            studentScoped: true
        },

        student_enrollments: {
            table: 'student_enrollments',
            title: 'Enrollment',
            studentScoped: true
        }
    };

    /* =====================================================
       MODULE DATA LOADERS
       ===================================================== */

    async function loadAssignments() {
        return fetchModuleData({
            table: 'assignments',
            select: `
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                ),
                classes (
                    id,
                    class_name,
                    class_code
                )
            `,
            orderBy: 'due_date',
            ascending: true
        });
    }

    async function loadAttendance() {
        return fetchModuleData({
            table: 'attendance',
            select: `
                *,
                classes (
                    id,
                    class_name
                )
            `,
            orderBy: 'attendance_date',
            ascending: false
        });
    }

    async function loadGrades() {
        return fetchModuleData({
            table: 'grades',
            select: `
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `,
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadExamResults() {
        return fetchModuleData({
            table: 'exam_results',
            select: `
                *,
                exams (
                    id,
                    exam_name,
                    exam_date
                ),
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `,
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadReportCards() {
        return fetchModuleData({
            table: 'report_cards',
            select: `
                *,
                academic_sessions (
                    id,
                    session_name
                )
            `,
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadPayments() {
        return fetchModuleData({
            table: 'payments',
            select: '*',
            orderBy: 'payment_date',
            ascending: false
        });
    }

    async function loadInvoices() {
        return fetchModuleData({
            table: 'invoices',
            select: '*',
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadLibraryLoans() {
        return fetchModuleData({
            table: 'library_loans',
            select: `
                *,
                library_books (
                    id,
                    title,
                    author
                )
            `,
            orderBy: 'borrowed_at',
            ascending: false
        });
    }

    async function loadTransport() {
        return fetchModuleData({
            table: 'student_transport',
            select: `
                *,
                transport_routes (
                    id,
                    route_name
                )
            `,
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadHostel() {
        return fetchModuleData({
            table: 'hostel_allocations',
            select: `
                *,
                hostel_rooms (
                    id,
                    room_number,
                    room_name
                )
            `,
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadNotifications() {
        return fetchModuleData({
            table: 'notifications',
            select: '*',
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadStudentSubjectsData() {
        return fetchModuleData({
            table: 'student_subjects',
            select: `
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `,
            orderBy: 'created_at',
            ascending: false
        });
    }

    async function loadStudentEnrollmentsData() {
        return fetchModuleData({
            table: 'student_enrollments',
            select: `
                *,
                classes (
                    id,
                    class_name,
                    class_code
                ),
                academic_sessions (
                    id,
                    session_name,
                    start_date,
                    end_date,
                    is_current
                )
            `,
            orderBy: 'enrolled_at',
            ascending: false
        });
    }

    async function loadLiveClasses() {
        const rows = await fetchModuleData({
            table: 'live_classes',
            select: `
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                ),
                classes (
                    id,
                    class_name,
                    class_code
                )
            `,
            orderBy: 'start_time',
            ascending: false
        });

        /*
         * Some live_classes records may not contain class_id
         * depending on how they were created. In that case,
         * only return records whose subject belongs to the
         * student's subjects.
         */
        const classIds = new Set(getStudentClassIds());
        const subjectIds = new Set(getStudentSubjectIds());

        return rows.filter(row => {
            const classMatches =
                !row.class_id ||
                classIds.has(row.class_id);

            const subjectMatches =
                !row.subject_id ||
                subjectIds.has(row.subject_id);

            return classMatches && subjectMatches;
        });
    }

    /* =====================================================
       MODULE DISPATCH
       ===================================================== */

    async function loadModuleData(moduleName) {
        switch (moduleName) {
            case 'assignments':
                return loadAssignments();

            case 'attendance':
                return loadAttendance();

            case 'grades':
                return loadGrades();

            case 'exam_results':
                return loadExamResults();

            case 'report_cards':
                return loadReportCards();

            case 'payments':
                return loadPayments();

            case 'invoices':
                return loadInvoices();

            case 'library_loans':
                return loadLibraryLoans();

            case 'student_transport':
                return loadTransport();

            case 'hostel_allocations':
                return loadHostel();

            case 'notifications':
                return loadNotifications();

            case 'live_classes':
                return loadLiveClasses();

            case 'student_subjects':
                return loadStudentSubjectsData();

            case 'student_enrollments':
                return loadStudentEnrollmentsData();

            default:
                return null;
        }
    }

    /* =====================================================
       ROLE SCOPE
       ===================================================== */

    function applyRoleScope(moduleName, rows) {
        if (!isStudent()) {
            return rows || [];
        }

        const table =
            MODULE_CONFIG[moduleName]?.table ||
            moduleName;

        return filterReturnedStudentRows(
            rows || [],
            table
        );
    }

    /* =====================================================
       PUBLIC LOAD
       ===================================================== */

    async function load(moduleName = getCurrentModule()) {
        if (state.loading) {
            return null;
        }

        state.loading = true;

        try {
            /*
             * Always resolve the authenticated profile first.
             */
            const context = await resolveStudentContext();

            /*
             * If this is a student, student.id must exist before
             * any student-specific module is queried.
             */
            if (
                context?.profile?.role === 'student' &&
                !context.student
            ) {
                throw new Error(
                    'Your student profile could not be linked to a student record.'
                );
            }

            const rows = await loadModuleData(moduleName);

            if (rows === null) {
                return null;
            }

            return applyRoleScope(
                moduleName,
                rows
            );

        } catch (error) {
            console.error(
                `[ModuleStub] Failed to load ${moduleName}:`,
                error
            );

            showError(
                error?.message ||
                `Unable to load ${moduleName}.`
            );

            return [];
        } finally {
            state.loading = false;
        }
    }

    /* =====================================================
       STUDENT CONTEXT PUBLIC API
       ===================================================== */

    function getStudentContext() {
        return {
            profile: state.profile,
            student: state.student,
            studentId: state.studentId,
            enrollment: state.enrollment,
            enrollments: state.enrollments,
            subjects: state.subjects,
            classId: getCurrentClassId(),
            sessionId: getCurrentSessionId(),
            subjectIds: getCurrentSubjectIds()
        };
    }

    async function refreshStudentContext() {
        return resolveStudentContext();
    }

    /* =====================================================
       MODULE RENDERING HELPERS
       ===================================================== */

    function renderEmptyState(message = 'No records found.') {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3>No Records</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    function renderErrorState(message = 'Unable to load this module.') {
        return `
            <div class="error-state">
                <div class="error-state-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Something went wrong</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function getModuleContainer(moduleName) {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.querySelector(
                `[data-module="${moduleName}"]`
            ) ||
            document.getElementById(`${moduleName}-module`) ||
            document.getElementById(moduleName)
        );
    }

    function setModuleContent(moduleName, html) {
        const container = getModuleContainer(moduleName);

        if (!container) {
            return false;
        }

        container.innerHTML = html;

        return true;
    }

    /* =====================================================
       BASIC STUDENT SUMMARY
       ===================================================== */

    function renderStudentSummary() {
        if (!isStudent() || !state.student) {
            return '';
        }

        const student = state.student;
        const enrollment = getCurrentEnrollment();

        const className =
            enrollment?.classes?.class_name ||
            '';

        const sessionName =
            enrollment?.academic_sessions?.session_name ||
            '';

        return `
            <div class="student-context-summary">
                <div class="student-context-item">
                    <span class="label">Student No.</span>
                    <strong>${escapeHtml(student.student_no || '')}</strong>
                </div>

                <div class="student-context-item">
                    <span class="label">Class</span>
                    <strong>${escapeHtml(className)}</strong>
                </div>

                <div class="student-context-item">
                    <span class="label">Session</span>
                    <strong>${escapeHtml(sessionName)}</strong>
                </div>

                <div class="student-context-item">
                    <span class="label">Subjects</span>
                    <strong>${state.subjects.length}</strong>
                </div>
            </div>
        `;
    }

    /* =====================================================
       ASSIGNMENT HELPERS
       ===================================================== */

    function isAssignmentVisibleToStudent(assignment) {
        if (!isStudent()) {
            return true;
        }

        if (!assignment) {
            return false;
        }

        const classIds = new Set(
            getStudentClassIds()
        );

        const subjectIds = new Set(
            getStudentSubjectIds()
        );

        if (
            assignment.class_id &&
            !classIds.has(assignment.class_id)
        ) {
            return false;
        }

        if (
            assignment.subject_id &&
            !subjectIds.has(assignment.subject_id)
        ) {
            return false;
        }

        return true;
    }

    function filterAssignmentsForStudent(assignments) {
        if (!isStudent()) {
            return assignments || [];
        }

        return (assignments || []).filter(
            isAssignmentVisibleToStudent
        );
    }

    /* =====================================================
       SUBJECT HELPERS
       ===================================================== */

    function studentHasSubject(subjectId) {
        if (!subjectId) {
            return false;
        }

        return getStudentSubjectIds().includes(subjectId);
    }

    function getStudentSubject(subjectId) {
        return (
            state.subjects.find(
                row => row?.subject_id === subjectId
            ) || null
        );
    }

    /* =====================================================
       ENROLLMENT HELPERS
       ===================================================== */

    function studentIsEnrolledInClass(classId) {
        if (!classId) {
            return false;
        }

        return getStudentClassIds().includes(classId);
    }

    function studentIsEnrolledInSession(sessionId) {
        if (!sessionId) {
            return false;
        }

        return (state.enrollments || []).some(
            enrollment =>
                enrollment?.session_id === sessionId
        );
    }

    /* =====================================================
       EVENT HELPERS
       ===================================================== */

    function on(eventName, handler) {
        if (
            typeof document === 'undefined' ||
            typeof handler !== 'function'
        ) {
            return;
        }

        document.addEventListener(
            eventName,
            handler
        );
    }

    function emit(eventName, detail = {}) {
        if (typeof document === 'undefined') {
            return;
        }

        document.dispatchEvent(
            new CustomEvent(
                eventName,
                { detail }
            )
        );
    }

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function init() {
        if (state.initialized) {
            return getStudentContext();
        }

        try {
            await resolveStudentContext();

            state.initialized = true;

            emit(
                'moduleStubReady',
                getStudentContext()
            );

            return getStudentContext();

        } catch (error) {
            console.error(
                '[ModuleStub] Initialization failed:',
                error
            );

            showError(
                error?.message ||
                'Unable to initialize dashboard.'
            );

            return null;
        }
    }

    /* =====================================================
       EXPORT
       ===================================================== */

    return {
        init,
        load,
        refreshStudentContext,
        getStudentContext,

        getStudentId,
        getProfileId,

        getCurrentEnrollment,
        getCurrentClassId,
        getCurrentSessionId,

        getStudentClassIds,
        getStudentSubjectIds,
        getCurrentSubjectIds,

        studentHasSubject,
        getStudentSubject,

        studentIsEnrolledInClass,
        studentIsEnrolledInSession,

        loadAssignments,
        loadAttendance,
        loadGrades,
        loadExamResults,
        loadReportCards,
        loadPayments,
        loadInvoices,
        loadLibraryLoans,
        loadTransport,
        loadHostel,
        loadNotifications,
        loadLiveClasses,
        loadStudentSubjectsData,
        loadStudentEnrollmentsData,

        renderStudentSummary,
        renderEmptyState,
        renderLoadingState,
        renderErrorState,

        showError,
        showSuccess,
        escapeHtml,

        on,
        emit
    };
})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

if (typeof window !== 'undefined') {
    window.ModuleStub = ModuleStub;
}


/* =========================================================
   AUTO INITIALIZATION
   ========================================================= */

if (
    typeof document !== 'undefined' &&
    document.readyState === 'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        () => {
            ModuleStub.init();
        },
        { once: true }
    );
} else if (typeof document !== 'undefined') {
    ModuleStub.init();
}
/* =========================================================
   MODULE-SPECIFIC RENDERERS
   ========================================================= */

/*
 * These renderers intentionally remain lightweight.
 * Existing dedicated module pages can continue to render
 * their own UI; these helpers are available when the generic
 * module container is used.
 */

function renderAssignmentRows(assignments) {
    const rows = filterAssignmentsForStudent(assignments);

    if (!rows.length) {
        return renderEmptyState(
            'There are no assignments available for your enrolled class and subjects.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Due Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(assignment => {
                        const subjectName =
                            assignment?.subjects?.subject_name ||
                            assignment?.subject_name ||
                            '—';

                        const className =
                            assignment?.classes?.class_name ||
                            assignment?.class_name ||
                            '—';

                        const dueDate =
                            assignment?.due_date ||
                            assignment?.deadline ||
                            null;

                        const status =
                            assignment?.status ||
                            'Pending';

                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        assignment?.title ||
                                        assignment?.name ||
                                        'Untitled Assignment'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(subjectName)}
                                </td>
                                <td>
                                    ${escapeHtml(className)}
                                </td>
                                <td>
                                    ${dueDate
                                        ? escapeHtml(
                                            new Date(dueDate)
                                                .toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                                <td>
                                    ${escapeHtml(status)}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderAttendanceRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No attendance records are available yet.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Class</th>
                        <th>Remark</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        const date =
                            record?.attendance_date ||
                            record?.date ||
                            record?.created_at;

                        return `
                            <tr>
                                <td>
                                    ${date
                                        ? escapeHtml(
                                            new Date(date)
                                                .toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.status ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.classes?.class_name ||
                                        record?.class_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.remark ||
                                        record?.remarks ||
                                        ''
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderGradeRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No grades have been recorded yet.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th>Assessment</th>
                        <th>Score</th>
                        <th>Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.subjects?.subject_name ||
                                        record?.subject_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.assessment_name ||
                                        record?.assessment_type ||
                                        record?.title ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.score ??
                                        record?.marks ??
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.grade ||
                                        '—'
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderExamResultRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No examination results are available yet.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Exam</th>
                        <th>Subject</th>
                        <th>Score</th>
                        <th>Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.exams?.exam_name ||
                                        record?.exam_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.subjects?.subject_name ||
                                        record?.subject_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.score ??
                                        record?.marks ??
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.grade ||
                                        '—'
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderReportCardRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No report cards are available yet.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Session</th>
                        <th>Term</th>
                        <th>Average</th>
                        <th>Position</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.academic_sessions?.session_name ||
                                        record?.session_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.term ||
                                        record?.term_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.average ??
                                        record?.average_score ??
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.position ??
                                        '—'
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderPaymentRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No payment records are available yet.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${record?.payment_date
                                        ? escapeHtml(
                                            new Date(
                                                record.payment_date
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.reference ||
                                        record?.payment_reference ||
                                        record?.receipt_no ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.amount ??
                                        record?.paid_amount ??
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.status ||
                                        '—'
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderInvoiceRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No invoices are available yet.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.invoice_number ||
                                        record?.invoice_no ||
                                        record?.reference ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${record?.created_at
                                        ? escapeHtml(
                                            new Date(
                                                record.created_at
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.amount ??
                                        record?.total_amount ??
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.status ||
                                        '—'
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderLibraryRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'You have no library loans at the moment.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Book</th>
                        <th>Borrowed</th>
                        <th>Due</th>
                        <th>Returned</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.library_books?.title ||
                                        record?.book_title ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${record?.borrowed_at
                                        ? escapeHtml(
                                            new Date(
                                                record.borrowed_at
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                                <td>
                                    ${record?.due_date
                                        ? escapeHtml(
                                            new Date(
                                                record.due_date
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                                <td>
                                    ${record?.returned_at
                                        ? escapeHtml(
                                            new Date(
                                                record.returned_at
                                            ).toLocaleDateString()
                                        )
                                        : 'Not returned'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderTransportRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No transport allocation is currently available.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Route</th>
                        <th>Status</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.transport_routes?.route_name ||
                                        record?.route_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.status ||
                                        'Active'
                                    )}
                                </td>
                                <td>
                                    ${record?.start_date
                                        ? escapeHtml(
                                            new Date(
                                                record.start_date
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderHostelRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No hostel allocation is currently available.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Room</th>
                        <th>Status</th>
                        <th>Allocated</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.hostel_rooms?.room_number ||
                                        record?.room_number ||
                                        record?.hostel_rooms?.room_name ||
                                        '—'
                                    )}
                                </td>
                                <td>
                                    ${escapeHtml(
                                        record?.status ||
                                        'Active'
                                    )}
                                </td>
                                <td>
                                    ${record?.created_at
                                        ? escapeHtml(
                                            new Date(
                                                record.created_at
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderNotificationRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'You have no notifications.'
        );
    }

    return `
        <div class="notification-list">
            ${records.map(record => {
                return `
                    <article class="notification-item">
                        <div class="notification-item-header">
                            <strong>
                                ${escapeHtml(
                                    record?.title ||
                                    'Notification'
                                )}
                            </strong>

                            <span>
                                ${record?.created_at
                                    ? escapeHtml(
                                        new Date(
                                            record.created_at
                                        ).toLocaleString()
                                    )
                                    : ''}
                            </span>
                        </div>

                        <div class="notification-item-body">
                            ${escapeHtml(
                                record?.message ||
                                record?.body ||
                                ''
                            )}
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}


function renderSubjectRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No subjects are assigned to your enrollment.'
        );
    }

    return `
        <div class="module-grid">
            ${records.map(record => {
                const subject =
                    record?.subjects ||
                    {};

                return `
                    <div class="module-card subject-card">
                        <div class="module-card-icon">
                            <i class="fas fa-book"></i>
                        </div>

                        <div class="module-card-content">
                            <h3>
                                ${escapeHtml(
                                    subject?.subject_name ||
                                    record?.subject_name ||
                                    'Subject'
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(
                                    subject?.subject_code ||
                                    record?.subject_code ||
                                    ''
                                )}
                            </p>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}


function renderEnrollmentRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No enrollment records are available.'
        );
    }

    return `
        <div class="module-table-wrapper">
            <table class="module-table">
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Session</th>
                        <th>Status</th>
                        <th>Enrolled</th>
                    </tr>
                </thead>

                <tbody>
                    ${records.map(record => {
                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        record?.classes?.class_name ||
                                        record?.class_name ||
                                        '—'
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        record?.academic_sessions?.session_name ||
                                        record?.session_name ||
                                        '—'
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        record?.status ||
                                        'Active'
                                    )}
                                </td>

                                <td>
                                    ${record?.enrolled_at
                                        ? escapeHtml(
                                            new Date(
                                                record.enrolled_at
                                            ).toLocaleDateString()
                                        )
                                        : '—'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function renderLiveClassRows(records) {
    if (!records?.length) {
        return renderEmptyState(
            'No live classes are currently available for your class and subjects.'
        );
    }

    return `
        <div class="module-grid live-class-grid">
            ${records.map(record => {
                return `
                    <div class="module-card live-class-card">
                        <div class="module-card-icon">
                            <i class="fas fa-video"></i>
                        </div>

                        <div class="module-card-content">
                            <h3>
                                ${escapeHtml(
                                    record?.title ||
                                    record?.name ||
                                    'Live Class'
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(
                                    record?.subjects?.subject_name ||
                                    record?.subject_name ||
                                    ''
                                )}
                            </p>

                            <p>
                                ${escapeHtml(
                                    record?.classes?.class_name ||
                                    record?.class_name ||
                                    ''
                                )}
                            </p>

                            ${
                                record?.meeting_url ||
                                record?.join_url ||
                                record?.url
                                    ? `
                                        <a
                                            class="btn btn-primary"
                                            href="${escapeHtml(
                                                record?.meeting_url ||
                                                record?.join_url ||
                                                record?.url
                                            )}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Join Class
                                        </a>
                                    `
                                    : ''
                            }
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}


/* =========================================================
   GENERIC MODULE RENDER
   ========================================================= */

function renderModule(moduleName, rows) {
    const safeRows = rows || [];

    switch (moduleName) {
        case 'assignments':
            return renderAssignmentRows(safeRows);

        case 'attendance':
            return renderAttendanceRows(safeRows);

        case 'grades':
            return renderGradeRows(safeRows);

        case 'exam_results':
            return renderExamResultRows(safeRows);

        case 'report_cards':
            return renderReportCardRows(safeRows);

        case 'payments':
            return renderPaymentRows(safeRows);

        case 'invoices':
            return renderInvoiceRows(safeRows);

        case 'library_loans':
            return renderLibraryRows(safeRows);

        case 'student_transport':
            return renderTransportRows(safeRows);

        case 'hostel_allocations':
            return renderHostelRows(safeRows);

        case 'notifications':
            return renderNotificationRows(safeRows);

        case 'student_subjects':
            return renderSubjectRows(safeRows);

        case 'student_enrollments':
            return renderEnrollmentRows(safeRows);

        case 'live_classes':
            return renderLiveClassRows(safeRows);

        default:
            if (!safeRows.length) {
                return renderEmptyState();
            }

            return `
                <div class="module-table-wrapper">
                    <table class="module-table">
                        <thead>
                            <tr>
                                <th>Record</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${safeRows.map(row => `
                                <tr>
                                    <td>
                                        ${escapeHtml(
                                            row?.name ||
                                            row?.title ||
                                            row?.id ||
                                            'Record'
                                        )}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
    }
}


/* =========================================================
   LOAD + RENDER MODULE
   ========================================================= */

async function loadAndRenderModule(moduleName) {
    const container = getModuleContainer(moduleName);

    if (container) {
        container.innerHTML = renderLoadingState();
    }

    try {
        const rows = await load(moduleName);

        if (rows === null) {
            if (container) {
                container.innerHTML = renderEmptyState(
                    'This module is not available.'
                );
            }

            return null;
        }

        const html = renderModule(
            moduleName,
            rows
        );

        if (container) {
            container.innerHTML = html;
        }

        return rows;

    } catch (error) {
        console.error(
            `[ModuleStub] Rendering failed for ${moduleName}:`,
            error
        );

        if (container) {
            container.innerHTML =
                renderErrorState(
                    error?.message ||
                    'Unable to load this module.'
                );
        }

        return [];
    }
}


/* =========================================================
   STUDENT DASHBOARD SUMMARY
   ========================================================= */

async function loadStudentDashboardSummary() {
    if (!isStudent()) {
        return null;
    }

    if (!state.student) {
        await resolveStudentContext();
    }

    if (!state.student) {
        return null;
    }

    const enrollment = getCurrentEnrollment();

    return {
        studentId: state.student.id,
        studentNo: state.student.student_no || null,

        classId:
            enrollment?.class_id ||
            state.student.class_id ||
            null,

        className:
            enrollment?.classes?.class_name ||
            null,

        sessionId:
            enrollment?.session_id ||
            enrollment?.academic_sessions?.id ||
            null,

        sessionName:
            enrollment?.academic_sessions?.session_name ||
            null,

        subjectsCount:
            state.subjects.length,

        enrollmentCount:
            state.enrollments.length
    };
}


/* =========================================================
   MODULE COUNTS
   ========================================================= */

async function getStudentModuleCounts() {
    if (!isStudent()) {
        return {};
    }

    if (!state.student) {
        await resolveStudentContext();
    }

    if (!state.student) {
        return {};
    }

    const counts = {};

    const modules = [
        'assignments',
        'attendance',
        'grades',
        'exam_results',
        'report_cards',
        'payments',
        'invoices',
        'library_loans',
        'student_transport',
        'hostel_allocations'
    ];

    for (const moduleName of modules) {
        try {
            const rows =
                await loadModuleData(moduleName);

            counts[moduleName] =
                Array.isArray(rows)
                    ? rows.length
                    : 0;

        } catch (error) {
            console.warn(
                `[ModuleStub] Unable to count ${moduleName}:`,
                error
            );

            counts[moduleName] = 0;
        }
    }

    counts.subjects =
        state.subjects.length;

    counts.enrollments =
        state.enrollments.length;

    return counts;
}


/* =========================================================
   STUDENT PROFILE SUMMARY
   ========================================================= */

function getStudentDisplayInfo() {
    if (!isStudent() || !state.student) {
        return null;
    }

    const enrollment =
        getCurrentEnrollment();

    return {
        id: state.student.id,

        studentNo:
            state.student.student_no ||
            '',

        firstName:
            state.student.first_name ||
            state.profile?.first_name ||
            '',

        lastName:
            state.student.last_name ||
            state.profile?.last_name ||
            '',

        fullName:
            state.student.full_name ||
            [
                state.student.first_name,
                state.student.last_name
            ]
                .filter(Boolean)
                .join(' ') ||
            state.profile?.full_name ||
            '',

        classId:
            enrollment?.class_id ||
            state.student.class_id ||
            null,

        className:
            enrollment?.classes?.class_name ||
            '',

        sessionId:
            enrollment?.session_id ||
            enrollment?.academic_sessions?.id ||
            null,

        sessionName:
            enrollment?.academic_sessions?.session_name ||
            '',

        subjectCount:
            state.subjects.length
    };
}


/* =========================================================
   STUDENT-SAFE QUERY HELPERS
   ========================================================= */

/*
 * Use these helpers when another frontend module needs to
 * query a student-owned table.
 *
 * Example:
 *
 *     const query = ModuleStub.studentQuery(
 *         supabase.from('grades').select('*'),
 *         'grades'
 *     );
 *
 * This prevents individual modules from accidentally using
 * profile.id where students.id is required.
 */

function studentQuery(query, tableName) {
    if (!query) {
        throw new Error(
            'A Supabase query is required.'
        );
    }

    return scopeStudentQuery(
        query,
        tableName
    );
}


function studentFilterRows(rows, tableName) {
    return filterReturnedStudentRows(
        rows || [],
        tableName
    );
}


/* =========================================================
   ENROLLMENT-BASED ASSIGNMENT QUERY
   ========================================================= */

async function getStudentAssignments() {
    if (!isStudent()) {
        return [];
    }

    if (!getStudentId()) {
        return [];
    }

    const classIds =
        getStudentClassIds();

    const subjectIds =
        getStudentSubjectIds();

    if (!classIds.length || !subjectIds.length) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('assignments')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                ),
                classes (
                    id,
                    class_name,
                    class_code
                )
            `)
            .in('class_id', classIds)
            .in('subject_id', subjectIds)
            .order(
                'due_date',
                {
                    ascending: true
                }
            );

    if (error) {
        throw error;
    }

    return filterAssignmentsForStudent(
        data || []
    );
}


/* =========================================================
   ENROLLMENT-BASED LIVE CLASS QUERY
   ========================================================= */

async function getStudentLiveClasses() {
    if (!isStudent()) {
        return [];
    }

    if (!getStudentId()) {
        return [];
    }

    const classIds =
        getStudentClassIds();

    const subjectIds =
        getStudentSubjectIds();

    if (!classIds.length) {
        return [];
    }

    const client =
        getClient();

    let query =
        client
            .from('live_classes')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                ),
                classes (
                    id,
                    class_name,
                    class_code
                )
            `)
            .in(
                'class_id',
                classIds
            );

    /*
     * If subject_id exists in the live_classes table,
     * use the student's subjects as an additional scope.
     *
     * The returned-row filter below also protects us in
     * deployments where some records do not have subject_id.
     */
    if (subjectIds.length) {
        query = query.in(
            'subject_id',
            subjectIds
        );
    }

    const { data, error } =
        await query.order(
            'start_time',
            {
                ascending: false
            }
        );

    if (error) {
        throw error;
    }

    return (data || []).filter(row => {
        const classMatches =
            !row?.class_id ||
            classIds.includes(
                row.class_id
            );

        const subjectMatches =
            !row?.subject_id ||
            subjectIds.includes(
                row.subject_id
            );

        return (
            classMatches &&
            subjectMatches
        );
    });
}


/* =========================================================
   STUDENT SUBJECT DATA
   ========================================================= */

async function getStudentSubjects() {
    if (!isStudent()) {
        return [];
    }

    if (!getStudentId()) {
        return [];
    }

    return loadStudentSubjectsData();
}


/* =========================================================
   STUDENT ENROLLMENT DATA
   ========================================================= */

async function getStudentEnrollments() {
    if (!isStudent()) {
        return [];
    }

    if (!getStudentId()) {
        return [];
    }

    return loadStudentEnrollmentsData();
}


/* =========================================================
   STUDENT ACADEMIC CONTEXT
   ========================================================= */

function getAcademicContext() {
    const enrollment =
        getCurrentEnrollment();

    return {
        studentId:
            getStudentId(),

        profileId:
            getProfileId(),

        classId:
            enrollment?.class_id ||
            state.student?.class_id ||
            null,

        className:
            enrollment?.classes?.class_name ||
            null,

        sessionId:
            enrollment?.session_id ||
            enrollment?.academic_sessions?.id ||
            null,

        sessionName:
            enrollment?.academic_sessions?.session_name ||
            null,

        subjectIds:
            getStudentSubjectIds()
    };
}


/* =========================================================
   STUDENT MODULE ACCESS CHECK
   ========================================================= */

function canStudentAccessModule(
    moduleName
) {
    if (!isStudent()) {
        return true;
    }

    if (!getStudentId()) {
        return false;
    }

    const restrictedModules = [
        'assignments',
        'attendance',
        'grades',
        'exam_results',
        'report_cards',
        'payments',
        'invoices',
        'library_loans',
        'student_transport',
        'hostel_allocations',
        'live_classes',
        'student_subjects',
        'student_enrollments'
    ];

    if (
        restrictedModules.includes(
            moduleName
        )
    ) {
        return true;
    }

    return true;
}


/* =========================================================
   SAFE MODULE LOAD
   ========================================================= */

async function safeLoadModule(
    moduleName
) {
    if (
        isStudent() &&
        !canStudentAccessModule(
            moduleName
        )
    ) {
        showError(
            'You do not have access to this module.'
        );

        return [];
    }

    return load(
        moduleName
    );
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshModule(
    moduleName
) {
    await refreshStudentContext();

    return safeLoadModule(
        moduleName
    );
}


/* =========================================================
   DASHBOARD EVENT INTEGRATION
   ========================================================= */

function bindModuleEvents() {
    if (
        typeof document === 'undefined'
    ) {
        return;
    }

    on(
        'dashboardModuleRequested',
        async event => {
            const moduleName =
                event?.detail?.module ||
                event?.detail?.moduleName;

            if (!moduleName) {
                return;
            }

            await loadAndRenderModule(
                moduleName
            );
        }
    );

    on(
        'refreshDashboardModule',
        async event => {
            const moduleName =
                event?.detail?.module ||
                event?.detail?.moduleName;

            if (!moduleName) {
                return;
            }

            await refreshModule(
                moduleName
            );
        }
    );
}


/* =========================================================
   INITIALIZATION EXTENSION
   ========================================================= */

async function initializeModuleEngine() {
    await init();

    bindModuleEvents();

    emit(
        'studentContextReady',
        getAcademicContext()
    );

    return getAcademicContext();
}


/* =========================================================
   ADDITIONAL PUBLIC API
   ========================================================= */

ModuleStub.renderModule =
    renderModule;

ModuleStub.loadAndRenderModule =
    loadAndRenderModule;

ModuleStub.loadStudentDashboardSummary =
    loadStudentDashboardSummary;

ModuleStub.getStudentModuleCounts =
    getStudentModuleCounts;

ModuleStub.getStudentDisplayInfo =
    getStudentDisplayInfo;

ModuleStub.studentQuery =
    studentQuery;

ModuleStub.studentFilterRows =
    studentFilterRows;

ModuleStub.getStudentAssignments =
    getStudentAssignments;

ModuleStub.getStudentLiveClasses =
    getStudentLiveClasses;

ModuleStub.getStudentSubjects =
    getStudentSubjects;

ModuleStub.getStudentEnrollments =
    getStudentEnrollments;

ModuleStub.getAcademicContext =
    getAcademicContext;

ModuleStub.canStudentAccessModule =
    canStudentAccessModule;

ModuleStub.safeLoadModule =
    safeLoadModule;

ModuleStub.refreshModule =
    refreshModule;

ModuleStub.initializeModuleEngine =
    initializeModuleEngine;


/* =========================================================
   AUTOMATIC MODULE ENGINE START
   ========================================================= */

if (
    typeof document !== 'undefined'
) {
    const startModuleEngine =
        () => {
            initializeModuleEngine()
                .catch(error => {
                    console.error(
                        '[ModuleStub] Automatic initialization failed:',
                        error
                    );
                });
        };

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            startModuleEngine,
            { once: true }
        );
    } else {
        startModuleEngine();
    }
}
/* =========================================================
   STUDENT DASHBOARD MODULE BOOTSTRAP
   ========================================================= */

async function bootstrapStudentModules() {
    try {
        const context =
            await initializeModuleEngine();

        if (!context) {
            return null;
        }

        if (
            !isStudent()
        ) {
            return context;
        }

        /*
         * Make the resolved student context available to other
         * frontend modules without requiring them to duplicate
         * the auth/profile/student lookup.
         */
        if (
            typeof window !== 'undefined'
        ) {
            window.currentStudentId =
                getStudentId();

            window.currentStudent =
                state.student;

            window.currentStudentProfile =
                state.profile;

            window.currentStudentEnrollment =
                getCurrentEnrollment();

            window.currentStudentEnrollments =
                state.enrollments;

            window.currentStudentSubjects =
                state.subjects;

            window.currentStudentClassId =
                getCurrentClassId();

            window.currentStudentSessionId =
                getCurrentSessionId();
        }

        emit(
            'studentModulesBootstrapped',
            {
                context,
                academicContext:
                    getAcademicContext()
            }
        );

        return context;

    } catch (error) {
        console.error(
            '[ModuleStub] Student module bootstrap failed:',
            error
        );

        showError(
            error?.message ||
            'Unable to connect your student modules.'
        );

        return null;
    }
}


/* =========================================================
   GLOBAL STUDENT CONTEXT SYNCHRONIZATION
   ========================================================= */

function syncStudentGlobals() {
    if (
        typeof window === 'undefined'
    ) {
        return;
    }

    window.currentStudentId =
        getStudentId();

    window.currentStudent =
        state.student;

    window.currentStudentProfile =
        state.profile;

    window.currentStudentEnrollment =
        getCurrentEnrollment();

    window.currentStudentEnrollments =
        state.enrollments;

    window.currentStudentSubjects =
        state.subjects;

    window.currentStudentClassId =
        getCurrentClassId();

    window.currentStudentSessionId =
        getCurrentSessionId();
}


/* =========================================================
   PROFILE → STUDENT RESOLUTION
   ========================================================= */

/*
 * Some older frontend modules may already have a variable
 * called studentId. This helper gives them the correct value.
 *
 * IMPORTANT:
 *     studentId = students.id
 *
 * NOT:
 *     studentId = profiles.id
 */
function resolveStudentId() {
    return (
        state.student?.id ||
        state.studentId ||
        null
    );
}


/*
 * Some modules need profileId rather than studentId.
 */
function resolveProfileId() {
    return (
        state.profile?.id ||
        null
    );
}


/* =========================================================
   ENROLLMENT RESOLUTION
   ========================================================= */

function resolveEnrollmentId() {
    return (
        getCurrentEnrollment()?.id ||
        null
    );
}


function resolveClassId() {
    return (
        getCurrentEnrollment()?.class_id ||
        state.student?.class_id ||
        null
    );
}


function resolveSessionId() {
    return (
        getCurrentEnrollment()?.session_id ||
        getCurrentEnrollment()?.academic_sessions?.id ||
        null
    );
}


/* =========================================================
   SUBJECT RESOLUTION
   ========================================================= */

function resolveSubjectIds() {
    return [
        ...new Set(
            (state.subjects || [])
                .map(row =>
                    row?.subject_id ||
                    row?.subjects?.id ||
                    null
                )
                .filter(Boolean)
        )
    ];
}


function resolveSubjects() {
    return (
        state.subjects ||
        []
    );
}


/* =========================================================
   FULL STUDENT CONNECTION OBJECT
   ========================================================= */

function getStudentConnection() {
    const enrollment =
        getCurrentEnrollment();

    return {
        profileId:
            resolveProfileId(),

        studentId:
            resolveStudentId(),

        studentNo:
            state.student?.student_no ||
            null,

        enrollmentId:
            enrollment?.id ||
            null,

        classId:
            enrollment?.class_id ||
            state.student?.class_id ||
            null,

        sessionId:
            enrollment?.session_id ||
            enrollment?.academic_sessions?.id ||
            null,

        subjectIds:
            resolveSubjectIds(),

        student:
            state.student,

        profile:
            state.profile,

        enrollment,

        enrollments:
            state.enrollments || [],

        subjects:
            resolveSubjects()
    };
}


/* =========================================================
   VALIDATE STUDENT CONNECTION
   ========================================================= */

function validateStudentConnection() {
    const connection =
        getStudentConnection();

    const missing = [];

    if (!connection.profileId) {
        missing.push(
            'profile_id'
        );
    }

    if (!connection.studentId) {
        missing.push(
            'student_id'
        );
    }

    if (!connection.enrollmentId) {
        missing.push(
            'enrollment_id'
        );
    }

    if (!connection.classId) {
        missing.push(
            'class_id'
        );
    }

    if (!connection.sessionId) {
        missing.push(
            'session_id'
        );
    }

    return {
        valid:
            missing.length === 0,

        missing,

        connection
    };
}


/* =========================================================
   STUDENT CONNECTION EVENT
   ========================================================= */

async function ensureStudentConnection() {
    if (
        !isStudent()
    ) {
        return {
            valid: true,
            missing: [],
            connection:
                getStudentConnection()
        };
    }

    /*
     * Refresh only when necessary.
     */
    if (
        !state.student ||
        !state.enrollments?.length
    ) {
        await resolveStudentContext();
    }

    syncStudentGlobals();

    const result =
        validateStudentConnection();

    if (
        !result.valid
    ) {
        console.warn(
            '[ModuleStub] Student connection is incomplete:',
            result.missing
        );

        emit(
            'studentConnectionIncomplete',
            result
        );
    } else {
        emit(
            'studentConnectionReady',
            result.connection
        );
    }

    return result;
}


/* =========================================================
   MODULE DATA CONNECTION MAP
   ========================================================= */

/*
 * This map describes how each student-facing module connects
 * to the student's enrollment.
 *
 * It is also used by other frontend code to understand which
 * ID must be supplied to a particular module.
 */
const STUDENT_MODULE_CONNECTIONS = {
    assignments: {
        studentId:
            false,

        classId:
            true,

        sessionId:
            false,

        subjectId:
            true,

        enrollmentId:
            false
    },

    attendance: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    grades: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            true,

        enrollmentId:
            false
    },

    exam_results: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            true,

        enrollmentId:
            false
    },

    report_cards: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            true,

        subjectId:
            false,

        enrollmentId:
            false
    },

    payments: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    invoices: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    library_loans: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    student_transport: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    hostel_allocations: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    live_classes: {
        studentId:
            false,

        classId:
            true,

        sessionId:
            false,

        subjectId:
            true,

        enrollmentId:
            false
    },

    student_subjects: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    },

    student_enrollments: {
        studentId:
            true,

        classId:
            false,

        sessionId:
            false,

        subjectId:
            false,

        enrollmentId:
            false
    }
};


/* =========================================================
   MODULE CONNECTION INFORMATION
   ========================================================= */

function getModuleConnection(
    moduleName
) {
    return (
        STUDENT_MODULE_CONNECTIONS[
            moduleName
        ] || {
            studentId:
                false,

            classId:
                false,

            sessionId:
                false,

            subjectId:
                false,

            enrollmentId:
                false
        }
    );
}


/* =========================================================
   BUILD MODULE CONTEXT
   ========================================================= */

function buildModuleContext(
    moduleName
) {
    const connection =
        getStudentConnection();

    const requirements =
        getModuleConnection(
            moduleName
        );

    return {
        module:
            moduleName,

        studentId:
            connection.studentId,

        profileId:
            connection.profileId,

        enrollmentId:
            connection.enrollmentId,

        classId:
            connection.classId,

        sessionId:
            connection.sessionId,

        subjectIds:
            connection.subjectIds,

        requirements
    };
}


/* =========================================================
   MODULE CONTEXT VALIDATION
   ========================================================= */

function validateModuleContext(
    moduleName
) {
    const context =
        buildModuleContext(
            moduleName
        );

    const missing = [];

    if (
        context.requirements.studentId &&
        !context.studentId
    ) {
        missing.push(
            'student_id'
        );
    }

    if (
        context.requirements.classId &&
        !context.classId
    ) {
        missing.push(
            'class_id'
        );
    }

    if (
        context.requirements.sessionId &&
        !context.sessionId
    ) {
        missing.push(
            'session_id'
        );
    }

    if (
        context.requirements.subjectId &&
        !context.subjectIds.length
    ) {
        missing.push(
            'subject_id'
        );
    }

    if (
        context.requirements.enrollmentId &&
        !context.enrollmentId
    ) {
        missing.push(
            'enrollment_id'
        );
    }

    return {
        valid:
            missing.length === 0,

        missing,

        context
    };
}


/* =========================================================
   MODULE CONTEXT ENFORCEMENT
   ========================================================= */

async function ensureModuleContext(
    moduleName
) {
    if (
        !isStudent()
    ) {
        return {
            valid: true,
            missing: [],
            context:
                buildModuleContext(
                    moduleName
                )
        };
    }

    await ensureStudentConnection();

    const validation =
        validateModuleContext(
            moduleName
        );

    if (
        !validation.valid
    ) {
        console.warn(
            `[ModuleStub] ${moduleName} is missing required student context:`,
            validation.missing
        );

        emit(
            'moduleContextIncomplete',
            {
                module:
                    moduleName,

                missing:
                    validation.missing,

                context:
                    validation.context
            }
        );
    }

    return validation;
}


/* =========================================================
   ASSIGNMENT QUERY WITH FULL ENROLLMENT CONTEXT
   ========================================================= */

async function fetchStudentAssignments() {
    const validation =
        await ensureModuleContext(
            'assignments'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const classIds =
        getStudentClassIds();

    const subjectIds =
        getStudentSubjectIds();

    if (
        !classIds.length ||
        !subjectIds.length
    ) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('assignments')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                ),
                classes (
                    id,
                    class_name,
                    class_code
                )
            `)
            .in(
                'class_id',
                classIds
            )
            .in(
                'subject_id',
                subjectIds
            )
            .order(
                'due_date',
                {
                    ascending: true
                }
            );

    if (error) {
        throw error;
    }

    return filterAssignmentsForStudent(
        data || []
    );
}


/* =========================================================
   ATTENDANCE QUERY
   ========================================================= */

async function fetchStudentAttendance() {
    const validation =
        await ensureModuleContext(
            'attendance'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('attendance')
            .select(`
                *,
                classes (
                    id,
                    class_name,
                    class_code
                )
            `)
            .eq(
                'student_id',
                studentId
            )
            .order(
                'attendance_date',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   GRADES QUERY
   ========================================================= */

async function fetchStudentGrades() {
    const validation =
        await ensureModuleContext(
            'grades'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    const subjectIds =
        resolveSubjectIds();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    let query =
        client
            .from('grades')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `)
            .eq(
                'student_id',
                studentId
            );

    /*
     * Grades should normally be restricted to subjects assigned
     * to the student. This protects against an old grade row
     * referencing a subject outside the current enrollment.
     */
    if (
        subjectIds.length
    ) {
        query =
            query.in(
                'subject_id',
                subjectIds
            );
    }

    const { data, error } =
        await query.order(
            'created_at',
            {
                ascending: false
            }
        );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   EXAM RESULTS QUERY
   ========================================================= */

async function fetchStudentExamResults() {
    const validation =
        await ensureModuleContext(
            'exam_results'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    const subjectIds =
        resolveSubjectIds();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    let query =
        client
            .from('exam_results')
            .select(`
                *,
                exams (
                    id,
                    exam_name,
                    exam_date
                ),
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `)
            .eq(
                'student_id',
                studentId
            );

    if (
        subjectIds.length
    ) {
        query =
            query.in(
                'subject_id',
                subjectIds
            );
    }

    const { data, error } =
        await query.order(
            'created_at',
            {
                ascending: false
            }
        );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   REPORT CARD QUERY
   ========================================================= */

async function fetchStudentReportCards() {
    const validation =
        await ensureModuleContext(
            'report_cards'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    const sessionId =
        resolveSessionId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    let query =
        client
            .from('report_cards')
            .select(`
                *,
                academic_sessions (
                    id,
                    session_name,
                    start_date,
                    end_date
                )
            `)
            .eq(
                'student_id',
                studentId
            );

    /*
     * Prefer the student's current enrollment session.
     */
    if (
        sessionId
    ) {
        query =
            query.eq(
                'session_id',
                sessionId
            );
    }

    const { data, error } =
        await query.order(
            'created_at',
            {
                ascending: false
            }
        );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   PAYMENT QUERY
   ========================================================= */

async function fetchStudentPayments() {
    const validation =
        await ensureModuleContext(
            'payments'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('payments')
            .select('*')
            .eq(
                'student_id',
                studentId
            )
            .order(
                'payment_date',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   INVOICE QUERY
   ========================================================= */

async function fetchStudentInvoices() {
    const validation =
        await ensureModuleContext(
            'invoices'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('invoices')
            .select('*')
            .eq(
                'student_id',
                studentId
            )
            .order(
                'created_at',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   LIBRARY QUERY
   ========================================================= */

async function fetchStudentLibraryLoans() {
    const validation =
        await ensureModuleContext(
            'library_loans'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('library_loans')
            .select(`
                *,
                library_books (
                    id,
                    title,
                    author
                )
            `)
            .eq(
                'student_id',
                studentId
            )
            .order(
                'borrowed_at',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   TRANSPORT QUERY
   ========================================================= */

async function fetchStudentTransport() {
    const validation =
        await ensureModuleContext(
            'student_transport'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('student_transport')
            .select(`
                *,
                transport_routes (
                    id,
                    route_name
                )
            `)
            .eq(
                'student_id',
                studentId
            )
            .order(
                'created_at',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   HOSTEL QUERY
   ========================================================= */

async function fetchStudentHostel() {
    const validation =
        await ensureModuleContext(
            'hostel_allocations'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('hostel_allocations')
            .select(`
                *,
                hostel_rooms (
                    id,
                    room_number,
                    room_name
                )
            `)
            .eq(
                'student_id',
                studentId
            )
            .order(
                'created_at',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   NOTIFICATION QUERY
   ========================================================= */

async function fetchStudentNotifications() {
    if (
        !isStudent()
    ) {
        return [];
    }

    const profileId =
        resolveProfileId();

    if (!profileId) {
        return [];
    }

    const client =
        getClient();

    /*
     * Notifications in this application are profile/user
     * scoped rather than student scoped.
     */
    let query =
        client
            .from('notifications')
            .select('*');

    /*
     * Support both common column names without assuming that
     * a student UUID belongs in a profile/user column.
     */
    const { data, error } =
        await query
            .or(
                `user_id.eq.${profileId},profile_id.eq.${profileId}`
            )
            .order(
                'created_at',
                {
                    ascending: false
                }
            );

    if (error) {
        /*
         * If the deployment has only one of user_id/profile_id,
         * fall back to the common user_id column.
         */
        const fallback =
            await client
                .from('notifications')
                .select('*')
                .eq(
                    'user_id',
                    profileId
                )
                .order(
                    'created_at',
                    {
                        ascending: false
                    }
                );

        if (fallback.error) {
            throw error;
        }

        return (
            fallback.data || []
        );
    }

    return (
        data || []
    );
}


/* =========================================================
   SUBJECT QUERY
   ========================================================= */

async function fetchStudentSubjects() {
    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('student_subjects')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                )
            `)
            .eq(
                'student_id',
                studentId
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   ENROLLMENT QUERY
   ========================================================= */

async function fetchStudentEnrollmentRecords() {
    const studentId =
        resolveStudentId();

    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('student_enrollments')
            .select(`
                *,
                classes (
                    id,
                    class_name,
                    class_code
                ),
                academic_sessions (
                    id,
                    session_name,
                    start_date,
                    end_date,
                    is_current
                )
            `)
            .eq(
                'student_id',
                studentId
            )
            .order(
                'enrolled_at',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    );
}


/* =========================================================
   LIVE CLASS QUERY
   ========================================================= */

async function fetchStudentLiveClassRecords() {
    const validation =
        await ensureModuleContext(
            'live_classes'
        );

    if (
        !validation.valid
    ) {
        return [];
    }

    const classIds =
        getStudentClassIds();

    const subjectIds =
        getStudentSubjectIds();

    if (
        !classIds.length
    ) {
        return [];
    }

    const client =
        getClient();

    const { data, error } =
        await client
            .from('live_classes')
            .select(`
                *,
                subjects (
                    id,
                    subject_name,
                    subject_code
                ),
                classes (
                    id,
                    class_name,
                    class_code
                )
            `)
            .in(
                'class_id',
                classIds
            )
            .order(
                'start_time',
                {
                    ascending: false
                }
            );

    if (error) {
        throw error;
    }

    return (
        data || []
    ).filter(row => {
        const classMatches =
            !row?.class_id ||
            classIds.includes(
                row.class_id
            );

        const subjectMatches =
            !row?.subject_id ||
            subjectIds.includes(
                row.subject_id
            );

        return (
            classMatches &&
            subjectMatches
        );
    });
}


/* =========================================================
   REPLACE GENERIC LOADERS WITH FULLY CONNECTED LOADERS
   ========================================================= */

ModuleStub.fetchStudentAssignments =
    fetchStudentAssignments;

ModuleStub.fetchStudentAttendance =
    fetchStudentAttendance;

ModuleStub.fetchStudentGrades =
    fetchStudentGrades;

ModuleStub.fetchStudentExamResults =
    fetchStudentExamResults;

ModuleStub.fetchStudentReportCards =
    fetchStudentReportCards;

ModuleStub.fetchStudentPayments =
    fetchStudentPayments;

ModuleStub.fetchStudentInvoices =
    fetchStudentInvoices;

ModuleStub.fetchStudentLibraryLoans =
    fetchStudentLibraryLoans;

ModuleStub.fetchStudentTransport =
    fetchStudentTransport;

ModuleStub.fetchStudentHostel =
    fetchStudentHostel;

ModuleStub.fetchStudentNotifications =
    fetchStudentNotifications;

ModuleStub.fetchStudentSubjects =
    fetchStudentSubjects;

ModuleStub.fetchStudentEnrollmentRecords =
    fetchStudentEnrollmentRecords;

ModuleStub.fetchStudentLiveClassRecords =
    fetchStudentLiveClassRecords;


/* =========================================================
   CONNECTED MODULE DISPATCH
   ========================================================= */

async function fetchConnectedModule(
    moduleName
) {
    switch (
        moduleName
    ) {
        case 'assignments':
            return fetchStudentAssignments();

        case 'attendance':
            return fetchStudentAttendance();

        case 'grades':
            return fetchStudentGrades();

        case 'exam_results':
            return fetchStudentExamResults();

        case 'report_cards':
            return fetchStudentReportCards();

        case 'payments':
            return fetchStudentPayments();

        case 'invoices':
            return fetchStudentInvoices();

        case 'library_loans':
            return fetchStudentLibraryLoans();

        case 'student_transport':
            return fetchStudentTransport();

        case 'hostel_allocations':
            return fetchStudentHostel();

        case 'notifications':
            return fetchStudentNotifications();

        case 'student_subjects':
            return fetchStudentSubjects();

        case 'student_enrollments':
            return fetchStudentEnrollmentRecords();

        case 'live_classes':
            return fetchStudentLiveClassRecords();

        default:
            return loadModuleData(
                moduleName
            );
    }
}


/* =========================================================
   CONNECTED MODULE LOADER
   ========================================================= */

async function loadConnectedModule(
    moduleName
) {
    try {
        /*
         * Make sure the student relationship is established
         * before touching any dependent module.
         */
        if (
            isStudent()
        ) {
            const connection =
                await ensureStudentConnection();

            if (
                !connection.connection?.studentId
            ) {
                throw new Error(
                    'Student account is not connected to a student record.'
                );
            }
        }

        const rows =
            await fetchConnectedModule(
                moduleName
            );

        const safeRows =
            applyRoleScope(
                moduleName,
                rows || []
            );

        emit(
            'connectedModuleLoaded',
            {
                module:
                    moduleName,

                rows:
                    safeRows,

                context:
                    getStudentConnection()
            }
        );

        return safeRows;

    } catch (error) {
        console.error(
            `[ModuleStub] Connected module ${moduleName} failed:`,
            error
        );

        emit(
            'connectedModuleError',
            {
                module:
                    moduleName,

                error
            }
        );

        throw error;
    }
}


/* =========================================================
   CONNECTED MODULE RENDERER
   ========================================================= */

async function loadAndRenderConnectedModule(
    moduleName
) {
    const container =
        getModuleContainer(
            moduleName
        );

    if (container) {
        container.innerHTML =
            renderLoadingState();
    }

    try {
        const rows =
            await loadConnectedModule(
                moduleName
            );

        if (container) {
            container.innerHTML =
                renderModule(
                    moduleName,
                    rows
                );
        }

        return rows;

    } catch (error) {
        if (container) {
            container.innerHTML =
                renderErrorState(
                    error?.message ||
                    'Unable to load this module.'
                );
        }

        return [];
    }
}


/* =========================================================
   CONNECTED MODULE PUBLIC API
   ========================================================= */

ModuleStub.fetchConnectedModule =
    fetchConnectedModule;

ModuleStub.loadConnectedModule =
    loadConnectedModule;

ModuleStub.loadAndRenderConnectedModule =
    loadAndRenderConnectedModule;

ModuleStub.getStudentConnection =
    getStudentConnection;

ModuleStub.validateStudentConnection =
    validateStudentConnection;

ModuleStub.ensureStudentConnection =
    ensureStudentConnection;

ModuleStub.resolveStudentId =
    resolveStudentId;

ModuleStub.resolveProfileId =
    resolveProfileId;

ModuleStub.resolveEnrollmentId =
    resolveEnrollmentId;

ModuleStub.resolveClassId =
    resolveClassId;

ModuleStub.resolveSessionId =
    resolveSessionId;

ModuleStub.resolveSubjectIds =
    resolveSubjectIds;

ModuleStub.resolveSubjects =
    resolveSubjects;

ModuleStub.getModuleConnection =
    getModuleConnection;

ModuleStub.buildModuleContext =
    buildModuleContext;

ModuleStub.validateModuleContext =
    validateModuleContext;

ModuleStub.ensureModuleContext =
    ensureModuleContext;


/* =========================================================
   MODULE LINKING HELPERS
   ========================================================= */

/*
 * Returns the exact values that should be used when creating
 * or updating records for the current student.
 */
function getStudentForeignKeys() {
    const connection =
        getStudentConnection();

    return {
        student_id:
            connection.studentId,

        profile_id:
            connection.profileId,

        enrollment_id:
            connection.enrollmentId,

        class_id:
            connection.classId,

        session_id:
            connection.sessionId
    };
}


/*
 * Adds the correct student foreign keys to a payload.
 *
 * This is deliberately explicit rather than blindly adding
 * every key, because different tables have different schemas.
 */
function addStudentId(
    payload = {}
) {
    return {
        ...payload,
        student_id:
            resolveStudentId()
    };
}


function addEnrollmentContext(
    payload = {}
) {
    const connection =
        getStudentConnection();

    return {
        ...payload,

        student_id:
            payload.student_id ||
            connection.studentId,

        enrollment_id:
            payload.enrollment_id ||
            connection.enrollmentId,

        class_id:
            payload.class_id ||
            connection.classId,

        session_id:
            payload.session_id ||
            connection.sessionId
    };
}


function addSubjectContext(
    payload = {},
    subjectId = null
) {
    const subject =
        subjectId ||
        payload.subject_id ||
        null;

    return {
        ...payload,

        subject_id:
            subject
    };
}


/* =========================================================
   PAYLOAD VALIDATION
   ========================================================= */

function validateStudentPayload(
    payload = {},
    options = {}
) {
    const {
        requireStudent = true,
        requireEnrollment = false,
        requireClass = false,
        requireSession = false,
        requireSubject = false
    } = options;

    const errors = [];

    if (
        requireStudent &&
        !payload.student_id
    ) {
        errors.push(
            'student_id is required'
        );
    }

    if (
        requireEnrollment &&
        !payload.enrollment_id
    ) {
        errors.push(
            'enrollment_id is required'
        );
    }

    if (
        requireClass &&
        !payload.class_id
    ) {
        errors.push(
            'class_id is required'
        );
    }

    if (
        requireSession &&
        !payload.session_id
    ) {
        errors.push(
            'session_id is required'
        );
    }

    if (
        requireSubject &&
        !payload.subject_id
    ) {
        errors.push(
            'subject_id is required'
        );
    }

    return {
        valid:
            errors.length === 0,

        errors
    };
}


/* =========================================================
   PAYLOAD BUILDERS
   ========================================================= */

function buildAttendancePayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildGradePayload(
    payload = {}
) {
    return addStudentId(
        addSubjectContext(
            payload
        )
    );
}


function buildExamResultPayload(
    payload = {}
) {
    return addStudentId(
        addSubjectContext(
            payload
        )
    );
}


function buildReportCardPayload(
    payload = {}
) {
    return addEnrollmentContext(
        payload
    );
}


function buildPaymentPayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildInvoicePayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildLibraryLoanPayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildTransportPayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildHostelPayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildStudentSubjectPayload(
    payload = {}
) {
    return addStudentId(
        payload
    );
}


function buildStudentEnrollmentPayload(
    payload = {}
) {
    return addStudentId(
        addEnrollmentContext(
            payload
        )
    );
}


/* =========================================================
   PUBLIC PAYLOAD BUILDERS
   ========================================================= */

ModuleStub.getStudentForeignKeys =
    getStudentForeignKeys;

ModuleStub.addStudentId =
    addStudentId;

ModuleStub.addEnrollmentContext =
    addEnrollmentContext;

ModuleStub.addSubjectContext =
    addSubjectContext;

ModuleStub.validateStudentPayload =
    validateStudentPayload;

ModuleStub.buildAttendancePayload =
    buildAttendancePayload;

ModuleStub.buildGradePayload =
    buildGradePayload;

ModuleStub.buildExamResultPayload =
    buildExamResultPayload;

ModuleStub.buildReportCardPayload =
    buildReportCardPayload;

ModuleStub.buildPaymentPayload =
    buildPaymentPayload;

ModuleStub.buildInvoicePayload =
    buildInvoicePayload;

ModuleStub.buildLibraryLoanPayload =
    buildLibraryLoanPayload;

ModuleStub.buildTransportPayload =
    buildTransportPayload;

ModuleStub.buildHostelPayload =
    buildHostelPayload;

ModuleStub.buildStudentSubjectPayload =
    buildStudentSubjectPayload;

ModuleStub.buildStudentEnrollmentPayload =
    buildStudentEnrollmentPayload;


/* =========================================================
   STUDENT DASHBOARD CARD DATA
   ========================================================= */

async function getStudentDashboardCards() {
    if (
        !isStudent()
    ) {
        return [];
    }

    await ensureStudentConnection();

    const summary =
        await loadStudentDashboardSummary();

    if (!summary) {
        return [];
    }

    const counts =
        await getStudentModuleCounts();

    return [
        {
            key:
                'subjects',

            title:
                'My Subjects',

            value:
                counts.subjects || 0,

            icon:
                'fa-book',

            module:
                'student_subjects'
        },

        {
            key:
                'assignments',

            title:
                'Assignments',

            value:
                counts.assignments || 0,

            icon:
                'fa-tasks',

            module:
                'assignments'
        },

        {
            key:
                'attendance',

            title:
                'Attendance Records',

            value:
                counts.attendance || 0,

            icon:
                'fa-calendar-check',

            module:
                'attendance'
        },

        {
            key:
                'grades',

            title:
                'Grades',

            value:
                counts.grades || 0,

            icon:
                'fa-chart-line',

            module:
                'grades'
        },

        {
            key:
                'exam_results',

            title:
                'Exam Results',

            value:
                counts.exam_results || 0,

            icon:
                'fa-file-alt',

            module:
                'exam_results'
        },

        {
            key:
                'report_cards',

            title:
                'Report Cards',

            value:
                counts.report_cards || 0,

            icon:
                'fa-graduation-cap',

            module:
                'report_cards'
        }
    ];
}


ModuleStub.getStudentDashboardCards =
    getStudentDashboardCards;


/* =========================================================
   DASHBOARD CARD RENDERER
   ========================================================= */

function renderStudentDashboardCards(
    cards = []
) {
    if (!cards.length) {
        return '';
    }

    return `
        <div class="student-dashboard-cards">
            ${cards.map(card => `
                <button
                    type="button"
                    class="dashboard-card"
                    data-module="${escapeHtml(
                        card.module || ''
                    )}"
                    data-dashboard-module="${escapeHtml(
                        card.module || ''
                    )}"
                >
                    <span class="dashboard-card-icon">
                        <i class="fas ${escapeHtml(
                            card.icon || 'fa-circle'
                        )}"></i>
                    </span>

                    <span class="dashboard-card-content">
                        <span class="dashboard-card-title">
                            ${escapeHtml(
                                card.title || ''
                            )}
                        </span>

                        <strong class="dashboard-card-value">
                            ${escapeHtml(
                                card.value ?? 0
                            )}
                        </strong>
                    </span>
                </button>
            `).join('')}
        </div>
    `;
}


ModuleStub.renderStudentDashboardCards =
    renderStudentDashboardCards;


/* =========================================================
   DASHBOARD CARD EVENTS
   ========================================================= */

function bindDashboardCardEvents() {
    if (
        typeof document === 'undefined'
    ) {
        return;
    }

    document.addEventListener(
        'click',
        event => {
            const target =
                event.target.closest(
                    '[data-dashboard-module]'
                );

            if (!target) {
                return;
            }

            const moduleName =
                target.getAttribute(
                    'data-dashboard-module'
                );

            if (!moduleName) {
                return;
            }

            event.preventDefault();

            loadAndRenderConnectedModule(
                moduleName
            );
        }
    );
}


/* =========================================================
   STUDENT DASHBOARD INITIALIZATION
   ========================================================= */

async function initializeStudentDashboard() {
    if (
        !isStudent()
    ) {
        return null;
    }

    await ensureStudentConnection();

    syncStudentGlobals();

    const cards =
        await getStudentDashboardCards();

    emit(
        'studentDashboardReady',
        {
            cards,
            summary:
                await loadStudentDashboardSummary(),
            context:
                getStudentConnection()
        }
    );

    return cards;
}


ModuleStub.initializeStudentDashboard =
    initializeStudentDashboard;


/* =========================================================
   DASHBOARD AUTO-START
   ========================================================= */

function autoStartStudentDashboard() {
    if (
        typeof document === 'undefined'
    ) {
        return;
    }

    const run =
        () => {
            initializeStudentDashboard()
                .catch(error => {
                    console.error(
                        '[ModuleStub] Student dashboard initialization failed:',
                        error
                    );
                });
        };

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            run,
            {
                once: true
            }
        );
    } else {
        run();
    }
}


bindDashboardCardEvents();

autoStartStudentDashboard();


/* =========================================================
   FINAL GLOBAL SYNC
   ========================================================= */

if (
    typeof window !== 'undefined'
) {
    window.ModuleStub =
        ModuleStub;

    /*
     * Do not assign a fake student ID.
     *
     * These values remain null until the authenticated user's
     * profiles row is successfully connected to students.id.
     */
    window.currentStudentId =
        resolveStudentId();

    window.currentStudentClassId =
        resolveClassId();

    window.currentStudentSessionId =
        resolveSessionId();

    window.currentStudentEnrollmentId =
        resolveEnrollmentId();

    window.currentStudentSubjectIds =
        resolveSubjectIds();
}
/* =========================================================
   PART 4 — FINAL STUDENT MODULE INTEGRATION
   ========================================================= */


/* =========================================================
   SAFE SUPABASE CLIENT RESOLUTION
   ========================================================= */

function getSupabaseClient() {
    if (
        typeof window !== 'undefined'
    ) {
        if (
            window.supabaseClient
        ) {
            return window.supabaseClient;
        }

        if (
            window.supabase
        ) {
            return window.supabase;
        }
    }

    if (
        typeof supabaseClient !== 'undefined'
    ) {
        return supabaseClient;
    }

    throw new Error(
        'Supabase client is not available.'
    );
}


/*
 * Keep compatibility with the existing module.
 */
function getClient() {
    return getSupabaseClient();
}


/* =========================================================
   AUTHENTICATED USER
   ========================================================= */

async function getAuthenticatedUser() {
    const client =
        getClient();

    const {
        data,
        error
    } = await client.auth.getUser();

    if (error) {
        throw error;
    }

    return (
        data?.user ||
        null
    );
}


/* =========================================================
   PROFILE LOOKUP
   ========================================================= */

async function fetchAuthenticatedProfile() {
    const user =
        await getAuthenticatedUser();

    if (!user?.id) {
        return null;
    }

    const client =
        getClient();

    const {
        data,
        error
    } = await client
        .from('profiles')
        .select('*')
        .eq(
            'id',
            user.id
        )
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


/* =========================================================
   STUDENT LOOKUP
   ========================================================= */

async function fetchStudentByProfile(
    profile
) {
    if (!profile) {
        return null;
    }

    /*
     * The important relationship established by the SQL
     * schema is:

         profiles.id
              ↓
         students.profile_id
              ↓
         students.id

     * The student's own UUID is students.id.
     */

    const client =
        getClient();

    /*
     * First try the direct profile_id relationship.
     */
    const {
        data,
        error
    } = await client
        .from('students')
        .select('*')
        .eq(
            'profile_id',
            profile.id
        )
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (data) {
        return data;
    }

    /*
     * Some older deployments may have student_id stored on
     * profiles. Support that without changing the schema.
     */
    if (
        profile.student_id
    ) {
        const fallback =
            await client
                .from('students')
                .select('*')
                .eq(
                    'id',
                    profile.student_id
                )
                .maybeSingle();

        if (fallback.error) {
            throw fallback.error;
        }

        if (fallback.data) {
            return fallback.data;
        }
    }

    return null;
}


/* =========================================================
   STUDENT ENROLLMENTS
   ========================================================= */

async function fetchStudentEnrollments(
    studentId
) {
    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const {
        data,
        error
    } = await client
        .from('student_enrollments')
        .select(`
            *,
            classes (
                id,
                class_name,
                class_code
            ),
            academic_sessions (
                id,
                session_name,
                start_date,
                end_date,
                is_current
            )
        `)
        .eq(
            'student_id',
            studentId
        )
        .order(
            'enrolled_at',
            {
                ascending: false
            }
        );

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   CURRENT ENROLLMENT
   ========================================================= */

function selectCurrentEnrollment(
    enrollments
) {
    if (
        !Array.isArray(
            enrollments
        ) ||
        !enrollments.length
    ) {
        return null;
    }

    /*
     * Prefer an enrollment whose academic session is marked
     * current.
     */
    const currentSession =
        enrollments.find(
            enrollment =>
                enrollment
                    ?.academic_sessions
                    ?.is_current === true
        );

    if (currentSession) {
        return currentSession;
    }

    /*
     * Otherwise use an explicitly active enrollment.
     */
    const active =
        enrollments.find(
            enrollment =>
                enrollment?.status ===
                    'active' ||
                enrollment?.is_active ===
                    true
        );

    if (active) {
        return active;
    }

    /*
     * Finally use the most recent enrollment.
     */
    return enrollments[0];
}


/* =========================================================
   STUDENT SUBJECTS
   ========================================================= */

async function fetchSubjectsForStudent(
    studentId
) {
    if (!studentId) {
        return [];
    }

    const client =
        getClient();

    const {
        data,
        error
    } = await client
        .from('student_subjects')
        .select(`
            *,
            subjects (
                id,
                subject_name,
                subject_code
            )
        `)
        .eq(
            'student_id',
            studentId
        );

    if (error) {
        /*
         * A student may not yet have student_subjects rows.
         * That is not a reason to break the entire dashboard.
         */
        if (
            error.code ===
            'PGRST116'
        ) {
            return [];
        }

        throw error;
    }

    return data || [];
}


/* =========================================================
   COMPLETE STUDENT CONTEXT RESOLUTION
   ========================================================= */

async function resolveStudentContext() {
    /*
     * Prevent multiple simultaneous calls from creating
     * inconsistent state.
     */
    if (
        state.contextPromise
    ) {
        return state.contextPromise;
    }

    state.contextPromise =
        (async () => {
            const profile =
                await fetchAuthenticatedProfile();

            state.profile =
                profile;

            if (!profile) {
                state.student =
                    null;

                state.studentId =
                    null;

                state.enrollments =
                    [];

                state.subjects =
                    [];

                return null;
            }

            const student =
                await fetchStudentByProfile(
                    profile
                );

            state.student =
                student;

            state.studentId =
                student?.id ||
                null;

            if (!student) {
                state.enrollments =
                    [];

                state.subjects =
                    [];

                syncStudentGlobals();

                emit(
                    'studentNotLinked',
                    {
                        profile
                    }
                );

                return {
                    profile,
                    student:
                        null,

                    enrollments:
                        [],

                    subjects:
                        []
                };
            }

            const enrollments =
                await fetchStudentEnrollments(
                    student.id
                );

            const subjects =
                await fetchSubjectsForStudent(
                    student.id
                );

            state.enrollments =
                enrollments;

            state.enrollment =
                selectCurrentEnrollment(
                    enrollments
                );

            state.subjects =
                subjects;

            syncStudentGlobals();

            emit(
                'studentContextResolved',
                {
                    profile,
                    student,
                    enrollments,
                    enrollment:
                        state.enrollment,
                    subjects
                }
            );

            return {
                profile,
                student,
                enrollments,
                enrollment:
                    state.enrollment,
                subjects
            };
        })();

    try {
        return await state.contextPromise;
    } finally {
        state.contextPromise =
            null;
    }
}


/* =========================================================
   STUDENT ID HELPERS
   ========================================================= */

function getStudentId() {
    return (
        state.student?.id ||
        state.studentId ||
        null
    );
}


function getCurrentEnrollment() {
    if (
        state.enrollment
    ) {
        return state.enrollment;
    }

    return selectCurrentEnrollment(
        state.enrollments || []
    );
}


function getCurrentClassId() {
    return (
        getCurrentEnrollment()
            ?.class_id ||
        state.student?.class_id ||
        null
    );
}


function getCurrentSessionId() {
    return (
        getCurrentEnrollment()
            ?.session_id ||
        getCurrentEnrollment()
            ?.academic_sessions
            ?.id ||
        null
    );
}


function getStudentClassIds() {
    const ids =
        (state.enrollments || [])
            .map(
                enrollment =>
                    enrollment?.class_id
            )
            .filter(Boolean);

    const currentClass =
        getCurrentClassId();

    if (
        currentClass
    ) {
        ids.push(
            currentClass
        );
    }

    return [
        ...new Set(ids)
    ];
}


function getStudentSubjectIds() {
    return [
        ...new Set(
            (state.subjects || [])
                .map(
                    row =>
                        row?.subject_id ||
                        row?.subjects?.id ||
                        null
                )
                .filter(Boolean)
        )
    ];
}


/* =========================================================
   ACADEMIC CONTEXT
   ========================================================= */

function getAcademicContext() {
    const enrollment =
        getCurrentEnrollment();

    return {
        enrollmentId:
            enrollment?.id ||
            null,

        studentId:
            getStudentId(),

        classId:
            enrollment?.class_id ||
            null,

        sessionId:
            enrollment?.session_id ||
            enrollment
                ?.academic_sessions
                ?.id ||
            null,

        className:
            enrollment
                ?.classes
                ?.class_name ||
            null,

        sessionName:
            enrollment
                ?.academic_sessions
                ?.session_name ||
            null
    };
}


/* =========================================================
   STUDENT ROLE CHECK
   ========================================================= */

function isStudent() {
    return (
        state.profile?.role ===
        'student'
    );
}


/* =========================================================
   DASHBOARD SUMMARY
   ========================================================= */

async function loadStudentDashboardSummary() {
    if (
        !isStudent()
    ) {
        return null;
    }

    const studentId =
        getStudentId();

    const enrollment =
        getCurrentEnrollment();

    if (!studentId) {
        return null;
    }

    return {
        studentId,

        studentNo:
            state.student
                ?.student_no ||
            null,

        enrollmentId:
            enrollment?.id ||
            null,

        classId:
            enrollment?.class_id ||
            null,

        sessionId:
            enrollment?.session_id ||
            null,

        className:
            enrollment
                ?.classes
                ?.class_name ||
            null,

        sessionName:
            enrollment
                ?.academic_sessions
                ?.session_name ||
            null,

        subjectCount:
            getStudentSubjectIds()
                .length
    };
}


/* =========================================================
   MODULE COUNTS
   ========================================================= */

async function getStudentModuleCounts() {
    const studentId =
        getStudentId();

    if (!studentId) {
        return {
            subjects: 0,
            assignments: 0,
            attendance: 0,
            grades: 0,
            exam_results: 0,
            report_cards: 0
        };
    }

    const client =
        getClient();

    const result = {
        subjects:
            getStudentSubjectIds()
                .length,

        assignments: 0,

        attendance: 0,

        grades: 0,

        exam_results: 0,

        report_cards: 0
    };

    /*
     * Use count queries independently so that one empty module
     * does not prevent all the others from loading.
     */

    try {
        const response =
            await client
                .from('assignments')
                .select(
                    'id',
                    {
                        count:
                            'exact',
                        head:
                            true
                    }
                )
                .in(
                    'class_id',
                    getStudentClassIds()
                )
                .in(
                    'subject_id',
                    getStudentSubjectIds()
                );

        result.assignments =
            response.count || 0;
    } catch (error) {
        console.warn(
            '[ModuleStub] Assignment count failed:',
            error
        );
    }


    try {
        const response =
            await client
                .from('attendance')
                .select(
                    'id',
                    {
                        count:
                            'exact',
                        head:
                            true
                    }
                )
                .eq(
                    'student_id',
                    studentId
                );

        result.attendance =
            response.count || 0;
    } catch (error) {
        console.warn(
            '[ModuleStub] Attendance count failed:',
            error
        );
    }


    try {
        const response =
            await client
                .from('grades')
                .select(
                    'id',
                    {
                        count:
                            'exact',
                        head:
                            true
                    }
                )
                .eq(
                    'student_id',
                    studentId
                );

        result.grades =
            response.count || 0;
    } catch (error) {
        console.warn(
            '[ModuleStub] Grade count failed:',
            error
        );
    }


    try {
        const response =
            await client
                .from('exam_results')
                .select(
                    'id',
                    {
                        count:
                            'exact',
                        head:
                            true
                    }
                )
                .eq(
                    'student_id',
                    studentId
                );

        result.exam_results =
            response.count || 0;
    } catch (error) {
        console.warn(
            '[ModuleStub] Exam result count failed:',
            error
        );
    }


    try {
        const response =
            await client
                .from('report_cards')
                .select(
                    'id',
                    {
                        count:
                            'exact',
                        head:
                            true
                    }
                )
                .eq(
                    'student_id',
                    studentId
                );

        result.report_cards =
            response.count || 0;
    } catch (error) {
        console.warn(
            '[ModuleStub] Report card count failed:',
            error
        );
    }

    return result;
}


/* =========================================================
   ASSIGNMENT FILTER
   ========================================================= */

function filterAssignmentsForStudent(
    rows
) {
    const classIds =
        getStudentClassIds();

    const subjectIds =
        getStudentSubjectIds();

    return (
        rows || []
    ).filter(
        row => {
            const classMatches =
                !row?.class_id ||
                classIds.includes(
                    row.class_id
                );

            const subjectMatches =
                !row?.subject_id ||
                subjectIds.includes(
                    row.subject_id
                );

            return (
                classMatches &&
                subjectMatches
            );
        }
    );
}


/* =========================================================
   ROLE SCOPE
   ========================================================= */

function applyRoleScope(
    moduleName,
    rows
) {
    if (
        !isStudent()
    ) {
        return rows;
    }

    const studentId =
        getStudentId();

    const classIds =
        getStudentClassIds();

    const subjectIds =
        getStudentSubjectIds();

    /*
     * Student-specific modules.
     */
    const studentScopedModules = [
        'attendance',
        'grades',
        'exam_results',
        'report_cards',
        'payments',
        'invoices',
        'library_loans',
        'student_transport',
        'hostel_allocations',
        'student_subjects',
        'student_enrollments'
    ];

    if (
        studentScopedModules.includes(
            moduleName
        )
    ) {
        return (
            rows || []
        ).filter(
            row =>
                !row?.student_id ||
                row.student_id ===
                    studentId
        );
    }

    /*
     * Class/subject scoped modules.
     */
    if (
        moduleName ===
        'assignments'
    ) {
        return (
            rows || []
        ).filter(
            row => {
                const classMatches =
                    !row?.class_id ||
                    classIds.includes(
                        row.class_id
                    );

                const subjectMatches =
                    !row?.subject_id ||
                    subjectIds.includes(
                        row.subject_id
                    );

                return (
                    classMatches &&
                    subjectMatches
                );
            }
        );
    }

    return rows || [];
}


/* =========================================================
   MODULE CONTAINER
   ========================================================= */

function getModuleContainer(
    moduleName
) {
    if (
        typeof document ===
        'undefined'
    ) {
        return null;
    }

    const selectors = [
        `[data-module-container="${moduleName}"]`,
        `#${moduleName}`,
        `#${moduleName}-module`,
        `.${moduleName}-module`,
        `[data-module="${moduleName}"]`
    ];

    for (
        const selector of
        selectors
    ) {
        try {
            const element =
                document.querySelector(
                    selector
                );

            if (element) {
                return element;
            }
        } catch (_) {
            /*
             * Ignore invalid selectors and continue.
             */
        }
    }

    return null;
}


/* =========================================================
   LOADING / ERROR UI
   ========================================================= */

function renderLoadingState() {
    return `
        <div class="module-loading">
            <div class="module-loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
            </div>

            <span>
                Loading...
            </span>
        </div>
    `;
}


function renderErrorState(
    message
) {
    return `
        <div class="module-error">
            <div class="module-error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>

            <div class="module-error-message">
                ${escapeHtml(
                    message ||
                    'Unable to load this module.'
                )}
            </div>

            <button
                type="button"
                class="module-retry-button"
                onclick="window.location.reload()"
            >
                Try Again
            </button>
        </div>
    `;
}


/* =========================================================
   GENERIC MODULE RENDERER
   ========================================================= */

function renderModule(
    moduleName,
    rows
) {
    /*
     * Existing application renderers are preserved when
     * available.
     */
    const rendererName =
        `render${toPascalCase(
            moduleName
        )}`;

    if (
        typeof window !==
            'undefined' &&
        typeof window[
            rendererName
        ] === 'function'
    ) {
        return window[
            rendererName
        ](
            rows
        );
    }

    if (
        typeof globalThis !==
            'undefined' &&
        typeof globalThis[
            rendererName
        ] === 'function'
    ) {
        return globalThis[
            rendererName
        ](
            rows
        );
    }

    /*
     * Do not destroy an existing page when this module has no
     * renderer. Return a simple safe representation instead.
     */
    if (
        !rows?.length
    ) {
        return `
            <div class="module-empty">
                No records available.
            </div>
        `;
    }

    return `
        <div class="module-record-count">
            ${rows.length} record${
                rows.length === 1
                    ? ''
                    : 's'
            }
        </div>
    `;
}


/* =========================================================
   EXISTING DATA LOADER COMPATIBILITY
   ========================================================= */

async function loadModuleData(
    moduleName
) {
    /*
     * If the old implementation already provides a loader,
     * use it for modules not explicitly overridden above.
     */
    if (
        typeof window !==
            'undefined' &&
        typeof window.loadModuleDataOriginal ===
            'function'
    ) {
        return window.loadModuleDataOriginal(
            moduleName
        );
    }

    if (
        typeof globalThis !==
            'undefined' &&
        typeof globalThis.loadModuleDataOriginal ===
            'function'
    ) {
        return globalThis.loadModuleDataOriginal(
            moduleName
        );
    }

    return [];
}


/* =========================================================
   EVENT SYSTEM
   ========================================================= */

function emit(
    eventName,
    detail = {}
) {
    if (
        typeof window ===
        'undefined'
    ) {
        return;
    }

    try {
        window.dispatchEvent(
            new CustomEvent(
                eventName,
                {
                    detail
                }
            )
        );
    } catch (error) {
        console.warn(
            `[ModuleStub] Could not emit ${eventName}:`,
            error
        );
    }
}


/* =========================================================
   UTILITY HELPERS
   ========================================================= */

function escapeHtml(
    value
) {
    if (
        value === null ||
        value === undefined
    ) {
        return '';
    }

    return String(value)
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );
}


function toPascalCase(
    value
) {
    return String(value || '')
        .replace(
            /(^|[_-])(\w)/g,
            (
                _,
                separator,
                character
            ) =>
                character.toUpperCase()
        );
}


/* =========================================================
   STATE INITIALIZATION
   ========================================================= */

if (
    typeof state !==
    'object'
) {
    /*
     * This branch should normally never be needed because
     * Part 1 creates the module state.
     */
    console.warn(
        '[ModuleStub] State object was not initialized.'
    );
}


/* =========================================================
   PUBLIC API FINALIZATION
   ========================================================= */

ModuleStub.getAuthenticatedUser =
    getAuthenticatedUser;

ModuleStub.fetchAuthenticatedProfile =
    fetchAuthenticatedProfile;

ModuleStub.fetchStudentByProfile =
    fetchStudentByProfile;

ModuleStub.fetchStudentEnrollments =
    fetchStudentEnrollments;

ModuleStub.selectCurrentEnrollment =
    selectCurrentEnrollment;

ModuleStub.fetchSubjectsForStudent =
    fetchSubjectsForStudent;

ModuleStub.resolveStudentContext =
    resolveStudentContext;

ModuleStub.getStudentId =
    getStudentId;

ModuleStub.getCurrentEnrollment =
    getCurrentEnrollment;

ModuleStub.getCurrentClassId =
    getCurrentClassId;

ModuleStub.getCurrentSessionId =
    getCurrentSessionId;

ModuleStub.getStudentClassIds =
    getStudentClassIds;

ModuleStub.getStudentSubjectIds =
    getStudentSubjectIds;

ModuleStub.getAcademicContext =
    getAcademicContext;

ModuleStub.isStudent =
    isStudent;

ModuleStub.loadStudentDashboardSummary =
    loadStudentDashboardSummary;

ModuleStub.getStudentModuleCounts =
    getStudentModuleCounts;

ModuleStub.applyRoleScope =
    applyRoleScope;


/* =========================================================
   GLOBAL API
   ========================================================= */

if (
    typeof window !==
    'undefined'
) {
    window.ModuleStub =
        ModuleStub;

    window.getStudentId =
        getStudentId;

    window.getCurrentEnrollment =
        getCurrentEnrollment;

    window.getCurrentClassId =
        getCurrentClassId;

    window.getCurrentSessionId =
        getCurrentSessionId;

    window.getStudentClassIds =
        getStudentClassIds;

    window.getStudentSubjectIds =
        getStudentSubjectIds;

    window.getStudentConnection =
        getStudentConnection;

    window.getAcademicContext =
        getAcademicContext;

    window.ensureStudentConnection =
        ensureStudentConnection;

    window.loadConnectedModule =
        loadConnectedModule;

    window.loadAndRenderConnectedModule =
        loadAndRenderConnectedModule;
}


/* =========================================================
   FINAL STARTUP
   ========================================================= */

(async function finalStudentModuleStartup() {
    try {
        const user =
            await getAuthenticatedUser();

        if (!user) {
            return;
        }

        const profile =
            await fetchAuthenticatedProfile();

        if (!profile) {
            return;
        }

        /*
         * Only initialize the student connection for the
         * student role. Admin, teacher, parent and executive
         * dashboards are not altered by this code.
         */
        if (
            profile.role !==
            'student'
        ) {
            return;
        }

        const context =
            await resolveStudentContext();

        if (
            !context?.student?.id
        ) {
            console.warn(
                '[ModuleStub] Student profile exists but no students record is connected.'
            );

            return;
        }

        syncStudentGlobals();

        emit(
            'studentModuleReady',
            {
                studentId:
                    getStudentId(),

                enrollmentId:
                    getCurrentEnrollment()
                        ?.id ||
                    null,

                classId:
                    getCurrentClassId(),

                sessionId:
                    getCurrentSessionId(),

                subjectIds:
                    getStudentSubjectIds(),

                academicContext:
                    getAcademicContext()
            }
        );

    } catch (error) {
        console.error(
            '[ModuleStub] Final startup failed:',
            error
        );
    }
})();


/* =========================================================
   END OF STUDENT MODULE
   ========================================================= */
   