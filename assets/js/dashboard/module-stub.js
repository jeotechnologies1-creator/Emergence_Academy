class OfficeModuleEngine {

  static state = {};

  static create(config) {
    return class {
      static config = config;

      static async render(container) {
        return OfficeModuleEngine.render(this, container);
      }
    };
  }

  static getState(moduleClass) {
    const key = moduleClass.config.moduleKey;
    if (!this.state[key]) {
      this.state[key] = {
        rows: [],
        page: 1,
        pageSize: 10,
        search: "",
        status: "all",
        sortKey: moduleClass.config.defaultSortKey || "",
        sortDir: "desc",
        columns: moduleClass.config.columns || [],
        lookups: {},
        profile: null,
        modal: {
          open: false,
          mode: "create",
          rowId: null
        },
        container: null
      };
    }
    return this.state[key];
  }

  static async resolveProfile() {
    try {
      if (window.Auth && typeof window.Auth.profile === "function") {
        return await window.Auth.profile();
      }
    } catch (error) {
      console.error("Unable to resolve current profile for module scope:", error);
    }
    return null;
  }

  static showMessage(text, kind = "success") {
    const fallback = typeof text === "string" ? text : "Action completed.";

    if (kind === "success" && window.Utils?.success) {
      Utils.success(fallback);
      return;
    }

    if (kind === "error" && window.Utils?.error) {
      Utils.error(fallback);
      return;
    }

    const targetId = kind === "success" ? "success-message" : "error-message";
    const target = document.getElementById(targetId);

    if (!target) {
      if (kind === "error") {
        console.error(fallback);
      } else {
        console.log(fallback);
      }
      return;
    }

    target.textContent = fallback;
    target.classList.remove("hidden");
    setTimeout(() => {
      target.classList.add("hidden");
    }, 3000);
  }

  static safe(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  static normalizeRowValue(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") {
      if (value.first_name || value.last_name) {
        return `${value.first_name || ""} ${value.last_name || ""}`.trim() || "-";
      }
      if (value.name) return value.name;
      if (value.email) return value.email;
      if (value.class_name) return value.class_name;
      if (value.subject_name) return value.subject_name;
      return JSON.stringify(value);
    }
    return String(value);
  }

  static tableFromForeignKey(key) {
    const mappings = {
      student_id: "students",
      teacher_id: "teachers",
      class_id: "classes",
      subject_id: "subjects",
      parent_id: "parents",
      profile_id: "profiles",
      user_id: "profiles",
      created_by: "profiles"
    };

    if (mappings[key]) {
      return mappings[key];
    }

    if (key.endsWith("_id")) {
      return `${key.replace(/_id$/, "")}s`;
    }

    return null;
  }

  static getLookupLabel(table, row) {
    if (!row || typeof row !== "object") {
      return "-";
    }

    const tableLabelResolvers = {
      students: () => row.student_no || row.admission_number || row.id,
      teachers: () => row.employee_id || row.staff_number || row.id,
      classes: () => row.class_name || row.class_code || row.id,
      subjects: () => row.subject_name || row.subject_code || row.id,
      parents: () => row.occupation || row.id,
      profiles: () => {
        const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
        return fullName || row.email || row.id;
      }
    };

    const resolver = tableLabelResolvers[table];
    if (resolver) {
      return this.normalizeRowValue(resolver());
    }

    return this.normalizeRowValue(
      row.name || row.title || row.code || row.id
    );
  }

  static profileDisplayName(profileRow) {
    if (!profileRow || typeof profileRow !== "object") {
      return "";
    }

    const fullName = `${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim();
    return fullName || String(profileRow.email || "").trim() || "";
  }

  static async loadLookups(moduleClass, state) {
    state.lookups = {};

    const explicitLookups = moduleClass.config.lookups || {};
    const columns = moduleClass.config.columns || [];
    const inferredKeys = columns
      .map((column) => column.key)
      .filter((key) => key.endsWith("_id") || ["user_id", "profile_id", "created_by"].includes(key));

    const keys = Array.from(new Set([
      ...Object.keys(explicitLookups),
      ...inferredKeys
    ]));

    for (const key of keys) {
      const table = explicitLookups[key]?.table || this.tableFromForeignKey(key);
      if (!table) {
        continue;
      }

      try {
        const records = await API.records.getAll(table, {
          orderBy: "created_at",
          ascending: false,
          select: "*"
        });

        const lookupConfig = explicitLookups[key] || {};
        const labelKey = lookupConfig.labelKey || "";
        const labelResolver = typeof lookupConfig.labelResolver === "function"
          ? lookupConfig.labelResolver
          : null;

        let profileMap = null;

        if (lookupConfig.preferProfileName) {
          const profiles = await API.records.getAll("profiles", {
            orderBy: "created_at",
            ascending: false,
            select: "*"
          });

          profileMap = {};
          profiles.forEach((profileRow) => {
            if (!profileRow || typeof profileRow.id === "undefined" || profileRow.id === null) {
              return;
            }
            profileMap[String(profileRow.id)] = this.profileDisplayName(profileRow);
          });
        }

        const map = {};
        records.forEach((item) => {
          const id = item?.id;
          if (id === null || typeof id === "undefined") {
            return;
          }

          let label = "";

          if (
            profileMap &&
            item &&
            typeof item.profile_id !== "undefined" &&
            item.profile_id !== null
          ) {
            label = String(profileMap[String(item.profile_id)] || "").trim();
          }

          if (!label && labelResolver) {
            const profileName = profileMap && item && item.profile_id
              ? String(profileMap[String(item.profile_id)] || "").trim()
              : "";
            label = this.normalizeRowValue(labelResolver(item, { profileName }));
          }

          if (!label && labelKey) {
            label = this.normalizeRowValue(item[labelKey]);
          }

          if (!label) {
            label = this.getLookupLabel(table, item);
          }

          map[String(id)] = label;
        });

        state.lookups[key] = {
          table,
          map
        };
      } catch (error) {
        console.error(`Lookup load failed for ${key} (${table}):`, error);
      }
    }
  }

  static getDisplayValue(row, key, state) {
    const value = row?.[key];
    const lookupMap = state?.lookups?.[key]?.map;
    if (lookupMap && value !== null && typeof value !== "undefined") {
      const resolved = lookupMap[String(value)];
      if (resolved) {
        return resolved;
      }
    }
    return this.normalizeRowValue(value);
  }

  static fieldLabel(field) {
    return String(field || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (chr) => chr.toUpperCase());
  }

  static clearModalErrors(form) {
    if (!form) return;

    const global = form.querySelector("[data-modal-error]");
    if (global) {
      global.textContent = "";
      global.classList.add("hidden");
    }

    form.querySelectorAll("[data-field-error]").forEach((el) => {
      el.textContent = "";
      el.classList.add("hidden");
    });

    form.querySelectorAll("input, select, textarea").forEach((input) => {
      input.classList.remove("border-red-500", "ring-1", "ring-red-300");
    });
  }

  static showModalError(form, message) {
    if (!form) {
      this.showMessage(message, "error");
      return;
    }

    const global = form.querySelector("[data-modal-error]");
    if (!global) {
      this.showMessage(message, "error");
      return;
    }

    global.textContent = String(message || "Please correct the highlighted fields.");
    global.classList.remove("hidden");
  }

  static showFieldError(form, field, message) {
    if (!form || !field) {
      return;
    }

    const input = form.querySelector(`[name="${field}"]`);
    const error = form.querySelector(`[data-field-error="${field}"]`);

    if (input) {
      input.classList.add("border-red-500", "ring-1", "ring-red-300");
      try {
        input.focus();
      } catch (errorFocus) {
        console.error("Unable to focus invalid field:", errorFocus);
      }
    }

    if (error) {
      error.textContent = String(message || "Invalid value.");
      error.classList.remove("hidden");
    }
  }

  static async auditAction(moduleClass, state, action, payload = {}, recordId = null) {
    try {
      const moduleKey = String(moduleClass?.config?.moduleKey || "module");
      const role = String(state?.profile?.role || "unknown");
      const userId = String(state?.profile?.id || "");

      const normalized = {};
      Object.entries(payload || {}).slice(0, 10).forEach(([key, value]) => {
        if (["password", "token", "secret"].includes(String(key).toLowerCase())) {
          return;
        }
        normalized[key] = String(value ?? "").slice(0, 120);
      });

      const details = JSON.stringify({
        module: moduleKey,
        action,
        role,
        record_id: recordId,
        fields: normalized
      });

      if (window.Auth && typeof window.Auth.log === "function") {
        await window.Auth.log(`MODULE_${String(action).toUpperCase()}`, details);
        return;
      }

      await API.records.create("activity_logs", {
        user_id: userId || null,
        action: `MODULE_${String(action).toUpperCase()}`,
        details,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Audit log write failed:", error);
    }
  }

  static validatePayload(moduleClass, payload, mode = "create") {
    const required = (mode === "edit" ? moduleClass.config.editRequiredFields : moduleClass.config.requiredFields)
      || moduleClass.config.requiredFields
      || [];
    const fieldTypes = moduleClass.config.fieldTypes || {};
    const fieldOptions = moduleClass.config.fieldOptions || {};
    const fieldRules = moduleClass.config.fieldRules || {};

    for (const field of required) {
      const value = String(payload[field] ?? "").trim();
      if (!value) {
        return {
          field,
          message: `"${this.fieldLabel(field)}" is required.`
        };
      }
    }

    for (const [field, type] of Object.entries(fieldTypes)) {
      const raw = String(payload[field] ?? "").trim();
      if (!raw) {
        continue;
      }

      if (type === "number") {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          return {
            field,
            message: `"${this.fieldLabel(field)}" must be a valid number.`
          };
        }
      }

      if (type === "date") {
        const parsed = Date.parse(raw);
        if (Number.isNaN(parsed)) {
          return {
            field,
            message: `"${this.fieldLabel(field)}" must be a valid date.`
          };
        }
      }

      if (type === "email") {
        const ok = /^\S+@\S+\.\S+$/.test(raw);
        if (!ok) {
          return {
            field,
            message: `"${this.fieldLabel(field)}" must be a valid email address.`
          };
        }
      }
    }

    for (const [field, options] of Object.entries(fieldOptions)) {
      if (!Array.isArray(options) || !options.length) {
        continue;
      }

      const value = String(payload[field] ?? "").trim();
      if (!value) {
        continue;
      }

      if (!options.map((opt) => String(opt)).includes(value)) {
        return {
          field,
          message: `"${this.fieldLabel(field)}" must be one of: ${options.join(", ")}.`
        };
      }
    }

    for (const [field, rules] of Object.entries(fieldRules)) {
      const raw = String(payload[field] ?? "").trim();
      if (!raw) {
        continue;
      }

      if (typeof rules.min === "number") {
        const numeric = Number(raw);
        if (!Number.isNaN(numeric) && numeric < rules.min) {
          return {
            field,
            message: `"${this.fieldLabel(field)}" must be at least ${rules.min}.`
          };
        }
      }

      if (typeof rules.max === "number") {
        const numeric = Number(raw);
        if (!Number.isNaN(numeric) && numeric > rules.max) {
          return {
            field,
            message: `"${this.fieldLabel(field)}" must be at most ${rules.max}.`
          };
        }
      }

      if (rules.notPast) {
        const valueDate = new Date(raw);
        if (!Number.isNaN(valueDate.getTime())) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          valueDate.setHours(0, 0, 0, 0);
          if (valueDate < today) {
            return {
              field,
              message: `"${this.fieldLabel(field)}" cannot be in the past.`
            };
          }
        }
      }

      if (rules.notFuture) {
        const valueDate = new Date(raw);
        if (!Number.isNaN(valueDate.getTime())) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          valueDate.setHours(0, 0, 0, 0);
          if (valueDate > today) {
            return {
              field,
              message: `"${this.fieldLabel(field)}" cannot be in the future.`
            };
          }
        }
      }
    }

    return null;
  }

  static parsePayload(moduleClass, payload) {
    const fieldTypes = moduleClass.config.fieldTypes || {};
    const output = { ...payload };

    Object.entries(fieldTypes).forEach(([field, type]) => {
      const raw = String(output[field] ?? "").trim();
      if (!raw) {
        return;
      }
      if (type === "number") {
        output[field] = Number(raw);
      }
    });

    return output;
  }

  static getInputType(moduleClass, field) {
    const typeMap = moduleClass.config.fieldTypes || {};
    const declared = typeMap[field];
    if (declared === "number") return "number";
    if (declared === "date") return "date";
    if (declared === "email") return "email";
    return "text";
  }

  static generatedFieldValue(moduleClass, field) {
    const generator = moduleClass.config.fieldGenerators?.[field];
    return typeof generator === "function" ? String(generator() || "") : "";
  }

  static buildColumns(rows, moduleClass) {
    const configured = moduleClass.config.columns || [];
    if (configured.length) return configured;

    const row = rows.find(Boolean) || {};
    return Object.keys(row)
      .filter((key) => !["id", "created_at", "updated_at"].includes(key))
      .slice(0, 6)
      .map((key) => ({ key, label: key.replace(/_/g, " ") }));
  }

  static async load(moduleClass) {
    const state = this.getState(moduleClass);
    const { tableName, orderBy = "created_at" } = moduleClass.config;

    state.profile = await this.resolveProfile();

    state.rows = await API.records.getAll(tableName, {
      orderBy,
      ascending: false,
      select: "*"
    });

    await this.loadLookups(moduleClass, state);

    state.columns = this.buildColumns(state.rows, moduleClass);
  }

  static roleScopeCandidates(role) {
    if (role === "teacher") {
      return ["teacher_id", "profile_id", "created_by", "user_id"];
    }
    if (role === "student") {
      return ["student_id", "profile_id", "user_id"];
    }
    if (role === "parent") {
      return ["parent_id", "profile_id", "user_id"];
    }
    return [];
  }

  static applyRoleScope(rows, state, moduleClass) {
    const role = String(state.profile?.role || "").toLowerCase();
    const userId = String(state.profile?.id || "");

    if (!role || !userId) {
      return rows;
    }

    if (["ceo", "admin", "executive", "finance", "hr", "admission", "exam", "library"].includes(role)) {
      return rows;
    }

    if (typeof moduleClass.config.scopeRows === "function") {
      return moduleClass.config.scopeRows(rows, state.profile);
    }

    const keys = this.roleScopeCandidates(role);
    if (!keys.length) {
      return rows;
    }

    return rows.filter((row) => {
      const keysPresent = keys.filter((key) => typeof row[key] !== "undefined" && row[key] !== null && row[key] !== "");
      if (!keysPresent.length) {
        return true;
      }
      return keysPresent.some((key) => String(row[key]) === userId);
    });
  }

  static currentRole(state) {
    return String(state?.profile?.role || "").toLowerCase();
  }

  static defaultRolePermissions(moduleClass) {
    const moduleKey = String(moduleClass.config.moduleKey || "");

    const byModule = {
      teachers: ["ceo", "admin", "executive", "hr"],
      parents: ["ceo", "admin", "executive", "admission"],
      attendance: ["ceo", "admin", "executive", "teacher", "exam"],
      assignments: ["ceo", "admin", "executive", "teacher", "exam"],
      grades: ["ceo", "admin", "executive", "teacher", "exam"],
      finance: ["ceo", "admin", "executive", "finance"],
      notifications: ["ceo", "admin", "executive", "hr", "admission", "exam", "library", "finance"],
      reports: []
    };

    const allowed = byModule[moduleKey] || ["ceo", "admin", "executive"];

    return {
      create: allowed,
      edit: allowed,
      delete: ["ceo", "admin", "executive"]
    };
  }

  static deleteConfig(moduleClass) {
    const softDelete = Boolean(moduleClass.config.softDelete);
    const softDeleteField = String(moduleClass.config.softDeleteField || "status").trim();
    const softDeleteValue = String(moduleClass.config.softDeleteValue || "archived").trim();
    const softRestoreValue = String(moduleClass.config.softRestoreValue || "active").trim();

    return {
      softDelete,
      softDeleteField,
      softDeleteValue,
      softRestoreValue
    };
  }

  static isActionAllowed(moduleClass, state, action) {
    if (moduleClass.config.readOnly) {
      return false;
    }

    const role = this.currentRole(state);

    if (!role) {
      return false;
    }

    const permissions = moduleClass.config.permissions || this.defaultRolePermissions(moduleClass);
    const allowedRoles = permissions[action] || [];

    if (allowedRoles.includes("*")) {
      return true;
    }

    return allowedRoles.includes(role);
  }

  static getRows(moduleClass) {
    const state = this.getState(moduleClass);
    const search = state.search.trim().toLowerCase();
    const statusFilter = String(state.status || "all").toLowerCase();

    let rows = this.applyRoleScope([...state.rows], state, moduleClass);

    if (search) {
      rows = rows.filter((row) => {
        return state.columns.some((column) => {
          const value = this.getDisplayValue(row, column.key, state).toLowerCase();
          return value.includes(search);
        });
      });
    }

    if (statusFilter !== "all") {
      rows = rows.filter((row) => String(row.status || "").toLowerCase() === statusFilter);
    }

    const key = state.sortKey;
    if (key) {
      rows.sort((a, b) => {
        const aValue = this.getDisplayValue(a, key, state).toLowerCase();
        const bValue = this.getDisplayValue(b, key, state).toLowerCase();

        if (aValue < bValue) return state.sortDir === "asc" ? -1 : 1;
        if (aValue > bValue) return state.sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }

  static pagedRows(moduleClass) {
    const state = this.getState(moduleClass);
    const rows = this.getRows(moduleClass);
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;

    return {
      rows: rows.slice(start, start + state.pageSize),
      total: rows.length,
      totalPages
    };
  }

  static statusOptions(moduleClass) {
    const state = this.getState(moduleClass);
    const set = new Set(["all"]);

    state.rows.forEach((row) => {
      if (row && typeof row.status !== "undefined" && row.status !== null && String(row.status).trim()) {
        set.add(String(row.status).toLowerCase());
      }
    });

    return Array.from(set);
  }

  static template(moduleClass) {
    const state = this.getState(moduleClass);
    const pageData = this.pagedRows(moduleClass);
    const statusOptions = this.statusOptions(moduleClass);
    const canWrite = !moduleClass.config.readOnly;
    const canCreate = this.isActionAllowed(moduleClass, state, "create");

    return `
<div class="space-y-6">
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div>
      <h2 class="text-3xl font-bold text-slate-800">${this.safe(moduleClass.config.title)}</h2>
      <p class="text-sm text-slate-500 mt-1">Live records with search, sorting, pagination, and exports.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      ${canWrite && canCreate ? `<button data-action="create" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Add Record</button>` : ""}
      <button data-action="refresh" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Refresh</button>
      <button data-action="csv" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Export CSV</button>
      <button data-action="excel" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Export Excel</button>
      <button data-action="print" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Print</button>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow p-4 md:p-5">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
      <input data-input="search" data-module="${this.safe(moduleClass.config.moduleKey)}" value="${this.safe(state.search)}" placeholder="Search records..." class="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2.5" />
      <select data-input="sort" data-module="${this.safe(moduleClass.config.moduleKey)}" class="rounded-lg border border-slate-300 px-3 py-2.5">
        ${state.columns.map((col) => `<option value="${this.safe(col.key)}" ${state.sortKey === col.key ? "selected" : ""}>Sort: ${this.safe(col.label || col.key)}</option>`).join("")}
      </select>
      <select data-input="status" data-module="${this.safe(moduleClass.config.moduleKey)}" class="rounded-lg border border-slate-300 px-3 py-2.5">
        ${statusOptions.map((option) => `<option value="${this.safe(option)}" ${state.status === option ? "selected" : ""}>${option === "all" ? "All Status" : this.safe(option)}</option>`).join("")}
      </select>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-slate-600">
            ${state.columns.map((col) => `<th class="px-3 py-2.5 font-semibold">${this.safe(col.label || col.key)}</th>`).join("")}
            <th class="px-3 py-2.5 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.rows.length ? pageData.rows.map((row) => this.rowTemplate(row, state.columns, moduleClass)).join("") : `<tr><td colspan="${state.columns.length + 1}" class="px-3 py-8 text-center text-slate-500">No records found.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between gap-3 text-sm">
      <div class="text-slate-500">Showing ${pageData.rows.length} of ${pageData.total} record(s).</div>
      <div class="flex items-center gap-2">
        <button data-action="prev" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50" ${state.page <= 1 ? "disabled" : ""}>Prev</button>
        <span class="text-slate-600">Page ${state.page} / ${pageData.totalPages}</span>
        <button data-action="next" data-module="${this.safe(moduleClass.config.moduleKey)}" class="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50" ${state.page >= pageData.totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  </div>
</div>
${this.modalTemplate(moduleClass)}
`;
  }

  static rowTemplate(row, columns, moduleClass) {
    const state = this.getState(moduleClass);
    const deletion = this.deleteConfig(moduleClass);
    const canEdit = this.isActionAllowed(moduleClass, state, "edit");
    const canDelete = this.isActionAllowed(moduleClass, state, "delete");
    const rowStatus = String(row?.[deletion.softDeleteField] || "").toLowerCase();
    const isArchived = deletion.softDelete && rowStatus === String(deletion.softDeleteValue || "").toLowerCase();
    const canRestore = deletion.softDelete && this.isActionAllowed(moduleClass, state, "edit");
    const canWrite = canEdit || canDelete || canRestore;
    const cells = columns.map((column) => {
      const rawValue = this.getDisplayValue(row, column.key, state);
      const value = rawValue.length > 80 ? `${rawValue.slice(0, 77)}...` : rawValue;
      return `<td class="px-3 py-2.5 border-b border-slate-100">${this.safe(value)}</td>`;
    }).join("");

    const rowId = this.safe(row.id || "");

    return `
<tr class="hover:bg-slate-50">
  ${cells}
  <td class="px-3 py-2.5 border-b border-slate-100 text-right">
    ${isArchived
      ? (canRestore
        ? `<button data-action="restore" data-id="${rowId}" data-module="${this.safe(moduleClass.config.moduleKey)}" class="text-emerald-600 hover:text-emerald-700">Restore</button>`
        : `<span class="text-slate-400">Archived</span>`)
      : `${canEdit ? `<button data-action="edit" data-id="${rowId}" data-module="${this.safe(moduleClass.config.moduleKey)}" class="text-blue-600 hover:text-blue-700 mr-3">Edit</button>` : ""}${canDelete ? `<button data-action="delete" data-id="${rowId}" data-module="${this.safe(moduleClass.config.moduleKey)}" class="text-red-600 hover:text-red-700">${deletion.softDelete ? "Archive" : "Delete"}</button>` : ""}`}
    ${canWrite ? "" : `<span class="text-slate-400">Read only</span>`}
  </td>
</tr>
`;
  }

  static async render(moduleClass, container) {
    const state = this.getState(moduleClass);
    state.container = container;

    container.innerHTML = `
<div class="bg-white rounded-xl shadow p-8 text-center text-slate-500">
  Loading ${this.safe(moduleClass.config.title)}...
</div>
`;

    await this.load(moduleClass);
    container.innerHTML = this.template(moduleClass);
    this.bindEvents(moduleClass);
  }

  static bindEvents(moduleClass) {
    const state = this.getState(moduleClass);
    const container = state.container;
    if (!container) return;

    const searchInput = container.querySelector('[data-input="search"]');
    const sortInput = container.querySelector('[data-input="sort"]');
    const statusInput = container.querySelector('[data-input="status"]');

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value || "";
        state.page = 1;
        container.innerHTML = this.template(moduleClass);
        this.bindEvents(moduleClass);
      });
    }

    if (sortInput) {
      sortInput.addEventListener("change", () => {
        if (state.sortKey === sortInput.value) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = sortInput.value;
          state.sortDir = "asc";
        }
        container.innerHTML = this.template(moduleClass);
        this.bindEvents(moduleClass);
      });
    }

    if (statusInput) {
      statusInput.addEventListener("change", () => {
        state.status = statusInput.value;
        state.page = 1;
        container.innerHTML = this.template(moduleClass);
        this.bindEvents(moduleClass);
      });
    }

    container.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-action");
        const id = button.getAttribute("data-id");
        await this.handleAction(moduleClass, action, id);
      });
    });

    this.bindModalEvents(moduleClass);
  }

  static async handleAction(moduleClass, action, id) {
    const state = this.getState(moduleClass);

    if (action === "prev") {
      state.page = Math.max(1, state.page - 1);
      state.container.innerHTML = this.template(moduleClass);
      this.bindEvents(moduleClass);
      return;
    }

    if (action === "next") {
      const total = this.getRows(moduleClass).length;
      const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
      state.page = Math.min(totalPages, state.page + 1);
      state.container.innerHTML = this.template(moduleClass);
      this.bindEvents(moduleClass);
      return;
    }

    if (action === "refresh") {
      await this.render(moduleClass, state.container);
      this.showMessage("Module refreshed.", "success");
      return;
    }

    if (action === "csv") {
      this.exportRows(moduleClass, "csv");
      return;
    }

    if (action === "excel") {
      this.exportRows(moduleClass, "excel");
      return;
    }

    if (action === "print") {
      this.printRows(moduleClass);
      return;
    }

    if (moduleClass.config.readOnly) {
      this.showMessage("This module is read-only for safety.", "error");
      return;
    }

    if (["create", "edit", "delete"].includes(action) && !this.isActionAllowed(moduleClass, state, action)) {
      this.showMessage("You do not have permission to perform this action.", "error");
      return;
    }

    if (action === "restore" && !this.isActionAllowed(moduleClass, state, "edit")) {
      this.showMessage("You do not have permission to restore this record.", "error");
      return;
    }

    if (action === "create") {
      this.openModal(moduleClass, "create");
      return;
    }

    if (action === "edit") {
      const row = state.rows.find((item) => String(item.id) === String(id));
      if (!row) {
        this.showMessage("Record not found.", "error");
        return;
      }
      this.openModal(moduleClass, "edit", id);
      return;
    }

    if (action === "delete") {
      const deletion = this.deleteConfig(moduleClass);
      const promptMessage = deletion.softDelete
        ? "Archive this record? It will remain in the database and can be restored later."
        : "Delete this record permanently?";

      const confirmed = window.confirm(promptMessage);
      if (!confirmed) return;

      const existing = state.rows.find((item) => String(item.id) === String(id)) || null;

      let result;

      if (deletion.softDelete) {
        result = await API.records.update(
          moduleClass.config.tableName,
          id,
          {
            [deletion.softDeleteField]: deletion.softDeleteValue
          }
        );
      } else {
        result = await API.records.remove(moduleClass.config.tableName, id);
      }

      if (!result.success) {
        this.showMessage(result.message || "Unable to remove record.", "error");
        return;
      }

      await this.auditAction(
        moduleClass,
        state,
        deletion.softDelete ? "archive" : "delete",
        existing || {},
        id
      );

      const okMessage = deletion.softDelete
        ? "Record archived successfully."
        : (result.message || "Record deleted.");

      this.showMessage(okMessage, "success");
      await this.render(moduleClass, state.container);
      return;
    }

    if (action === "restore") {
      const deletion = this.deleteConfig(moduleClass);
      const existing = state.rows.find((item) => String(item.id) === String(id)) || null;

      const result = await API.records.update(
        moduleClass.config.tableName,
        id,
        {
          [deletion.softDeleteField]: deletion.softRestoreValue
        }
      );

      if (!result.success) {
        this.showMessage(result.message || "Unable to restore record.", "error");
        return;
      }

      await this.auditAction(moduleClass, state, "restore", existing || {}, id);

      this.showMessage("Record restored successfully.", "success");
      await this.render(moduleClass, state.container);
      return;
    }
  }

  static openModal(moduleClass, mode = "create", rowId = null) {
    const state = this.getState(moduleClass);
    state.modal = {
      open: true,
      mode,
      rowId
    };
    state.container.innerHTML = this.template(moduleClass);
    this.bindEvents(moduleClass);
  }

  static closeModal(moduleClass) {
    const state = this.getState(moduleClass);
    state.modal = {
      open: false,
      mode: "create",
      rowId: null
    };
    state.container.innerHTML = this.template(moduleClass);
    this.bindEvents(moduleClass);
  }

  static modalTemplate(moduleClass) {
    const state = this.getState(moduleClass);
    if (!state.modal?.open) {
      return "";
    }

    const fields = (state.modal.mode === "edit" ? moduleClass.config.editFormFields : moduleClass.config.formFields)
      || (moduleClass.config.columns || []).map((col) => col.key);
    const row = state.modal.mode === "edit"
      ? state.rows.find((item) => String(item.id) === String(state.modal.rowId)) || null
      : null;

    const title = state.modal.mode === "edit"
      ? `Edit ${moduleClass.config.title}`
      : `Add ${moduleClass.config.title.slice(0, -1) || moduleClass.config.title}`;

    const inputs = fields
      .filter((field) => !["id", "created_at", "updated_at"].includes(field))
      .map((field) => {
        const label = field.replace(/_/g, " ").replace(/\b\w/g, (chr) => chr.toUpperCase());
        const value = row ? this.normalizeRowValue(row[field]) : this.generatedFieldValue(moduleClass, field);
        const safeValue = this.safe(value === "-" ? "" : value);

        const options = moduleClass.config.fieldOptions?.[field] || null;
        const lookupMap = state.lookups?.[field]?.map || null;
        const required = (moduleClass.config.requiredFields || []).includes(field);

        if (options && Array.isArray(options) && options.length) {
          return `
<label class="block">
  <span class="text-sm text-slate-700">${this.safe(label)}${required ? " *" : ""}</span>
  <select name="${this.safe(field)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
    <option value="">Select ${this.safe(label)}</option>
    ${options.map((option) => `<option value="${this.safe(option)}" ${String(option) === String(value) ? "selected" : ""}>${this.safe(option)}</option>`).join("")}
  </select>
  <span data-field-error="${this.safe(field)}" class="hidden mt-1 block text-xs text-red-600"></span>
</label>
`;
        }

        if (lookupMap && typeof lookupMap === "object") {
          const current = row ? String(row[field] ?? "") : "";
          return `
<label class="block">
  <span class="text-sm text-slate-700">${this.safe(label)}${required ? " *" : ""}</span>
  <select name="${this.safe(field)}" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
    <option value="">Select ${this.safe(label)}</option>
    ${Object.entries(lookupMap).map(([id, text]) => `<option value="${this.safe(id)}" ${id === current ? "selected" : ""}>${this.safe(text)}</option>`).join("")}
  </select>
  <span data-field-error="${this.safe(field)}" class="hidden mt-1 block text-xs text-red-600"></span>
</label>
`;
        }

        const inputType = this.getInputType(moduleClass, field);
        const canGenerate = !row && typeof moduleClass.config.fieldGenerators?.[field] === "function";
        const generateLabel = moduleClass.config.fieldGeneratorLabels?.[field] || "Generate";
        return `
<label class="block">
  <span class="text-sm text-slate-700">${this.safe(label)}${required ? " *" : ""}</span>
  <div class="mt-1 flex gap-2">
    <input type="${inputType}" name="${this.safe(field)}" value="${safeValue}" class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
    ${canGenerate ? `<button type="button" data-generate-field="${this.safe(field)}" class="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">${this.safe(generateLabel)}</button>` : ""}
  </div>
  <span data-field-error="${this.safe(field)}" class="hidden mt-1 block text-xs text-red-600"></span>
</label>
`;
      }).join("");

    return `
<div class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center px-4" data-modal-overlay="${this.safe(moduleClass.config.moduleKey)}">
  <div class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-bold text-slate-800">${this.safe(title)}</h3>
      <button type="button" data-modal-close="${this.safe(moduleClass.config.moduleKey)}" class="text-slate-500 hover:text-slate-700">Close</button>
    </div>
    <form data-modal-form="${this.safe(moduleClass.config.moduleKey)}" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div data-modal-error class="hidden md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
      ${inputs}
      <div class="md:col-span-2 flex items-center justify-end gap-3 mt-2">
        <button type="button" data-modal-close="${this.safe(moduleClass.config.moduleKey)}" class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
      </div>
    </form>
  </div>
</div>
`;
  }

  static bindModalEvents(moduleClass) {
    const state = this.getState(moduleClass);
    const container = state.container;
    if (!container) return;

    container.querySelectorAll("[data-modal-close]").forEach((button) => {
      button.addEventListener("click", () => {
        this.closeModal(moduleClass);
      });
    });

    const overlay = container.querySelector(`[data-modal-overlay="${moduleClass.config.moduleKey}"]`);
    if (overlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          this.closeModal(moduleClass);
        }
      });
    }

    const form = container.querySelector(`[data-modal-form="${moduleClass.config.moduleKey}"]`);
    container.querySelectorAll("[data-generate-field]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = button.getAttribute("data-generate-field");
        const input = field ? form?.querySelector(`[name="${field}"]`) : null;
        if (input && field) input.value = this.generatedFieldValue(moduleClass, field);
      });
    });

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        this.clearModalErrors(form);

        const formData = new FormData(form);
        const payload = {};

        for (const [key, value] of formData.entries()) {
          payload[key] = String(value || "").trim();
        }

        const hasAnyValue = Object.values(payload).some((value) => String(value).trim() !== "");
        if (!hasAnyValue) {
          this.showModalError(form, "Please provide at least one value.");
          return;
        }

        const validationError = this.validatePayload(moduleClass, payload, state.modal.mode);
        if (validationError) {
          this.showModalError(form, validationError.message);
          this.showFieldError(form, validationError.field, validationError.message);
          return;
        }

        const parsedPayload = this.parsePayload(moduleClass, payload);

        let result;

        if (state.modal.mode === "edit" && state.modal.rowId) {
          result = await API.records.update(moduleClass.config.tableName, state.modal.rowId, parsedPayload);
        } else if (typeof moduleClass.config.createRecord === "function") {
          result = await moduleClass.config.createRecord(parsedPayload);
        } else {
          result = await API.records.create(moduleClass.config.tableName, parsedPayload);
        }

        if (!result?.success) {
          this.showModalError(form, result?.message || "Unable to save record.");
          return;
        }

        const action = state.modal.mode === "edit" ? "update" : "create";
        const recordId = state.modal.mode === "edit"
          ? state.modal.rowId
          : (result?.data?.id || null);

        await this.auditAction(moduleClass, state, action, parsedPayload, recordId);

        this.showMessage(result.message || "Record saved successfully.", "success");
        this.closeModal(moduleClass);
        await this.render(moduleClass, state.container);
      });
    }
  }

  static promptForPayload(moduleClass, existingRow = null) {
    const fields = moduleClass.config.formFields ||
      (moduleClass.config.columns || []).map((col) => col.key);

    if (!fields.length) {
      alert("No editable fields configured for this module.");
      return null;
    }

    const payload = {};

    for (const field of fields) {
      if (["id", "created_at", "updated_at"].includes(field)) {
        continue;
      }

      const label = field.replace(/_/g, " ").replace(/\b\w/g, (chr) => chr.toUpperCase());
      const currentValue = existingRow ? this.normalizeRowValue(existingRow[field]) : "";
      const answer = window.prompt(`${label}:`, currentValue);

      if (answer === null) {
        return null;
      }

      payload[field] = answer.trim();
    }

    return payload;
  }

  static exportRows(moduleClass, type = "csv") {
    const state = this.getState(moduleClass);
    const rows = this.getRows(moduleClass);
    const columns = state.columns;

    const header = columns.map((col) => `"${String(col.label || col.key).replace(/"/g, '""')}"`).join(",");
    const body = rows.map((row) => {
      return columns.map((col) => {
        const value = this.getDisplayValue(row, col.key, state);
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(",");
    }).join("\n");

    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const ext = type === "excel" ? "xls" : "csv";

    link.href = url;
    link.download = `${moduleClass.config.moduleKey}-${stamp}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    this.showMessage(`${moduleClass.config.title} exported (${type.toUpperCase()}).`, "success");
  }

  static printRows(moduleClass) {
    const state = this.getState(moduleClass);
    const rows = this.getRows(moduleClass);
    const columns = state.columns;

    const tableRows = rows.map((row) => {
      const cells = columns.map((col) => `<td>${this.safe(this.getDisplayValue(row, col.key, state))}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.safe(moduleClass.config.title)} Print</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    h1 { margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>${this.safe(moduleClass.config.title)}</h1>
  <table>
    <thead>
      <tr>${columns.map((col) => `<th>${this.safe(col.label || col.key)}</th>`).join("")}</tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>
`;

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      this.showMessage("Unable to open print window.", "error");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }
}

window.OfficeModuleEngine = OfficeModuleEngine;

if (!window.TeachersModule) {
  window.TeachersModule = window.OfficeModuleEngine.create({ moduleKey: "teachers", title: "Teachers", tableName: "teachers", columns: [] });
}

if (!window.ParentsModule) {
  window.ParentsModule = window.OfficeModuleEngine.create({ moduleKey: "parents", title: "Parents", tableName: "parents", columns: [] });
}

if (!window.AttendanceModule) {
  window.AttendanceModule = window.OfficeModuleEngine.create({ moduleKey: "attendance", title: "Attendance", tableName: "attendance", columns: [] });
}

if (!window.AssignmentModule) {
  window.AssignmentModule = window.OfficeModuleEngine.create({ moduleKey: "assignments", title: "Assignments", tableName: "assignments", columns: [] });
}

if (!window.GradesModule) {
  window.GradesModule = window.OfficeModuleEngine.create({ moduleKey: "grades", title: "Grades", tableName: "grades", columns: [] });
}

if (!window.FinanceModule) {
  window.FinanceModule = window.OfficeModuleEngine.create({ moduleKey: "finance", title: "Finance", tableName: "payments", columns: [] });
}

if (!window.ReportsModule) {
  window.ReportsModule = window.OfficeModuleEngine.create({ moduleKey: "reports", title: "Reports", tableName: "activity_logs", readOnly: true, columns: [] });
}

if (!window.NotificationModule) {
  window.NotificationModule = window.OfficeModuleEngine.create({ moduleKey: "notifications", title: "Notifications", tableName: "notifications", columns: [] });
}

if (!window.AIModule) {
  window.AIModule = class {
    static async render(container) {
      container.innerHTML = '<div class="bg-white rounded-xl shadow p-6 text-slate-600">AI Assistant is ready.</div>';
    }
  };
}
