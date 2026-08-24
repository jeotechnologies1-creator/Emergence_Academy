class OfficeModuleEngine {

  static state = {};

  static create(config) {
    // Dashboard modules historically declared `formFields` and
    // `editFormFields`, while the renderer reads `fields`. Normalize both
    // conventions here so configured forms are actually rendered.
    const normalizedConfig = {
      ...config,
      fields: config.fields || config.formFields || [],
      editFields: config.editFields || config.editFormFields || config.fields || config.formFields || []
    };

    return class {
      static config = normalizedConfig;

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
      students: () =>
        row.student_no ||
        row.admission_number ||
        row.id,

      teachers: () =>
        row.employee_id ||
        row.staff_number ||
        row.id,

      classes: () =>
        row.class_name ||
        row.class_code ||
        row.id,

      subjects: () =>
        row.subject_name ||
        row.subject_code ||
        row.id,

      parents: () =>
        row.occupation ||
        row.id,

      profiles: () => {
        const fullName =
          `${row.first_name || ""} ${row.last_name || ""}`.trim();

        return fullName ||
          row.email ||
          row.id;
      }
    };

    const resolver =
      tableLabelResolvers[table];

    if (resolver) {
      return this.normalizeRowValue(
        resolver()
      );
    }

    return this.normalizeRowValue(
      row.name ||
      row.title ||
      row.code ||
      row.id
    );
  }

  static profileDisplayName(profileRow) {
    if (
      !profileRow ||
      typeof profileRow !== "object"
    ) {
      return "";
    }

    const fullName =
      `${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim();

    return (
      fullName ||
      String(profileRow.email || "").trim() ||
      ""
    );
  }

  static async loadLookups(moduleClass, state) {
    state.lookups = {};

    const explicitLookups =
      moduleClass.config.lookups || {};

    const columns =
      moduleClass.config.columns || [];

    const inferredKeys =
      columns
        .map(
          (column) =>
            column.key
        )
        .filter(
          (key) =>
            key.endsWith("_id") ||
            [
              "user_id",
              "profile_id",
              "created_by"
            ].includes(key)
        );

    const keys =
      Array.from(
        new Set([
          ...Object.keys(
            explicitLookups
          ),
          ...inferredKeys
        ])
      );

    for (const key of keys) {
      const table =
        explicitLookups[key]?.table ||
        this.tableFromForeignKey(key);

      if (!table) {
        continue;
      }

      try {
        const records =
          await API.records.getAll(
            table,
            {
              orderBy: "created_at",
              ascending: false,
              select: "*"
            }
          );

        const lookupConfig =
          explicitLookups[key] || {};

        const labelKey =
          lookupConfig.labelKey || "";

        const labelResolver =
          typeof lookupConfig.labelResolver === "function"
            ? lookupConfig.labelResolver
            : null;

        let profileMap = null;

        if (
          lookupConfig.preferProfileName
        ) {
          const profiles =
            await API.records.getAll(
              "profiles",
              {
                orderBy: "created_at",
                ascending: false,
                select: "*"
              }
            );

          profileMap = {};

          profiles.forEach(
            (profileRow) => {
              if (
                !profileRow ||
                typeof profileRow.id ===
                  "undefined" ||
                profileRow.id === null
              ) {
                return;
              }

              profileMap[
                String(profileRow.id)
              ] =
                this.profileDisplayName(
                  profileRow
                );
            }
          );
        }

        const map = {};

        const recordFilter =
          typeof lookupConfig.filter === "function"
            ? lookupConfig.filter
            : null;

        records
          .filter(
            (item) =>
              !recordFilter ||
              recordFilter(item)
          )
          .forEach(
            (item) => {
              const id =
                item?.id;

              if (
                id === null ||
                typeof id === "undefined"
              ) {
                return;
              }

              let label = "";

              if (
                profileMap &&
                item &&
                typeof item.profile_id !==
                  "undefined" &&
                item.profile_id !== null
              ) {
                label =
                  String(
                    profileMap[
                      String(
                        item.profile_id
                      )
                    ] || ""
                  ).trim();
              }

              /*
               * Teacher lookups should always retain
               * the generated employee ID.
               */
              if (
                label &&
                table === "teachers"
              ) {
                const employeeId =
                  String(
                    item.employee_id ||
                    item.teacher_no ||
                    ""
                  ).trim();

                if (employeeId) {
                  label =
                    `${label} (${employeeId})`;
                }
              }

              /*
               * Student choices should identify the
               * enrolled learner unambiguously.
               */
              if (
                label &&
                table === "students"
              ) {
                const studentNumber =
                  String(
                    item.student_no ||
                    item.admission_number ||
                    ""
                  ).trim();

                if (studentNumber) {
                  label =
                    `${label} (${studentNumber})`;
                }
              }

              if (
                !label &&
                labelResolver
              ) {
                const profileName =
                  profileMap &&
                  item &&
                  item.profile_id
                    ? String(
                        profileMap[
                          String(
                            item.profile_id
                          )
                        ] || ""
                      ).trim()
                    : "";

                label =
                  this.normalizeRowValue(
                    labelResolver(
                      item,
                      {
                        profileName
                      }
                    )
                  );
              }

              if (
                !label &&
                labelKey
              ) {
                label =
                  this.normalizeRowValue(
                    item[labelKey]
                  );
              }

              if (!label) {
                label =
                  this.getLookupLabel(
                    table,
                    item
                  );
              }

              map[
                String(id)
              ] = label;
            }
          );

        state.lookups[key] = {
          table,
          map
        };

      } catch (error) {
        console.error(
          `Lookup load failed for ${key} (${table}):`,
          error
        );
      }
    }
  }

  static getDisplayValue(
    row,
    key,
    state
  ) {
    const value =
      row?.[key];

    const lookupMap =
      state
        ?.lookups
        ?. [key]
        ?.map;

    if (
      lookupMap &&
      value !== null &&
      typeof value !==
        "undefined"
    ) {
      const resolved =
        lookupMap[
          String(value)
        ];

      if (resolved) {
        return resolved;
      }
    }

    return this.normalizeRowValue(
      value
    );
  }

  static fieldLabel(field) {
    return String(field || "")
      .replace(
        /_/g,
        " "
      )
      .replace(
        /\b\w/g,
        (chr) =>
          chr.toUpperCase()
      );
  }

  static clearModalErrors(form) {
    if (!form) return;

    const global =
      form.querySelector(
        "[data-modal-error]"
      );

    if (global) {
      global.textContent = "";
      global.classList.add(
        "hidden"
      );
    }

    form
      .querySelectorAll(
        "[data-field-error]"
      )
      .forEach(
        (el) => {
          el.textContent = "";
          el.classList.add(
            "hidden"
          );
        }
      );

    form
      .querySelectorAll(
        "input, select, textarea"
      )
      .forEach(
        (input) => {
          input.classList.remove(
            "border-red-500",
            "ring-1",
            "ring-red-300"
          );
        }
      );
  }

  static showModalError(
    form,
    message
  ) {
    if (!form) {
      this.showMessage(
        message,
        "error"
      );
      return;
    }

    const global =
      form.querySelector(
        "[data-modal-error]"
      );

    if (!global) {
      this.showMessage(
        message,
        "error"
      );
      return;
    }

    global.textContent =
      String(
        message ||
        "Please correct the highlighted fields."
      );

    global.classList.remove(
      "hidden"
    );
  }

  static showFieldError(
    form,
    field,
    message
  ) {
    if (
      !form ||
      !field
    ) {
      return;
    }

    const input =
      form.querySelector(
        `[name="${field}"]`
      );

    const error =
      form.querySelector(
        `[data-field-error="${field}"]`
      );

    if (input) {
      input.classList.add(
        "border-red-500",
        "ring-1",
        "ring-red-300"
      );

      try {
        input.focus();
      } catch (
        errorFocus
      ) {
        console.error(
          "Unable to focus invalid field:",
          errorFocus
        );
      }
    }

    if (error) {
      error.textContent =
        String(
          message ||
          "Invalid value."
        );

      error.classList.remove(
        "hidden"
      );
    }
  }

  static async auditAction(
    moduleClass,
    state,
    action,
    payload = {},
    recordId = null
  ) {
    try {
      const moduleKey =
        String(
          moduleClass
            ?.config
            ?.moduleKey ||
          "module"
        );

      const role =
        String(
          state
            ?.profile
            ?.role ||
          "unknown"
        );

      const userId =
        String(
          state
            ?.profile
            ?.id ||
          ""
        );

      const normalized = {};

      Object.entries(
        payload || {}
      )
        .slice(0, 10)
        .forEach(
          ([key, value]) => {
            if (
              [
                "password",
                "token",
                "secret"
              ].includes(
                String(
                  key
                ).toLowerCase()
              )
            ) {
              return;
            }

            normalized[key] =
              String(
                value ?? ""
              ).slice(
                0,
                120
              );
          }
        );

      const details =
        JSON.stringify({
          module:
            moduleKey,

          action,

          role,

          record_id:
            recordId,

          fields:
            normalized
        });

      if (
        window.Auth &&
        typeof window.Auth.log ===
          "function"
      ) {
        await window.Auth.log(
          `MODULE_${String(
            action
          ).toUpperCase()}`,
          details
        );

        return;
      }

      await API.records.create(
        "activity_logs",
        {
          user_id:
            userId ||
            null,

          action:
            `MODULE_${String(
              action
            ).toUpperCase()}`,

          description:
            details,

          created_at:
            new Date().toISOString()
        }
      );

    } catch (error) {
      console.error(
        "Audit log write failed:",
        error
      );
    }
  }

  static validatePayload(
    moduleClass,
    payload,
    mode = "create"
  ) {
    const required =
      (
        mode === "edit"
          ? moduleClass
              .config
              .editRequiredFields
          : moduleClass
              .config
              .requiredFields
      ) ||
      moduleClass
        .config
        .requiredFields ||
      [];

    const fieldTypes =
      moduleClass
        .config
        .fieldTypes ||
      {};

    const fieldOptions =
      moduleClass
        .config
        .fieldOptions ||
      {};

    const fieldRules =
      moduleClass
        .config
        .fieldRules ||
      {};

    for (
      const field of required
    ) {
      const value =
        String(
          payload[field] ??
          ""
        ).trim();

      if (!value) {
        return {
          field,
          message:
            `"${this.fieldLabel(
              field
            )}" is required.`
        };
      }
    }

    for (
      const [
        field,
        type
      ] of Object.entries(
        fieldTypes
      )
    ) {
      const raw =
        String(
          payload[field] ??
          ""
        ).trim();

      if (!raw) {
        continue;
      }

      if (
        type ===
        "number"
      ) {
        const parsed =
          Number(raw);

        if (
          !Number.isFinite(
            parsed
          )
        ) {
          return {
            field,
            message:
              `"${this.fieldLabel(
                field
              )}" must be a valid number.`
          };
        }
      }

      if (
        type ===
        "date"
      ) {
        const parsed =
          Date.parse(
            raw
          );

        if (
          Number.isNaN(
            parsed
          )
        ) {
          return {
            field,
            message:
              `"${this.fieldLabel(
                field
              )}" must be a valid date.`
          };
        }
      }

      if (
        type ===
        "email"
      ) {
        const ok =
          /^\S+@\S+\.\S+$/.test(
            raw
          );

        if (!ok) {
          return {
            field,
            message:
              `"${this.fieldLabel(
                field
              )}" must be a valid email address.`
          };
        }
      }
    }

    for (
      const [
        field,
        options
      ] of Object.entries(
        fieldOptions
      )
    ) {
      if (
        !Array.isArray(
          options
        ) ||
        !options.length
      ) {
        continue;
      }

      const value =
        String(
          payload[field] ??
          ""
        ).trim();

      if (!value) {
        continue;
      }

      if (
        !options
          .map(
            (opt) =>
              String(opt)
          )
          .includes(
            value
          )
      ) {
        return {
          field,
          message:
            `"${this.fieldLabel(
              field
            )}" must be one of: ${options.join(
              ", "
            )}.`
        };
      }
    }

    for (
      const [
        field,
        rules
      ] of Object.entries(
        fieldRules
      )
    ) {
      const raw =
        String(
          payload[field] ??
          ""
        ).trim();

      if (!raw) {
        continue;
      }

      if (
        typeof rules.min ===
        "number"
      ) {
        const numeric =
          Number(raw);

        if (
          !Number.isNaN(
            numeric
          ) &&
          numeric <
            rules.min
        ) {
          return {
            field,
            message:
              `"${this.fieldLabel(
                field
              )}" must be at least ${rules.min}.`
          };
        }
      }

      if (
        typeof rules.max ===
        "number"
      ) {
        const numeric =
          Number(raw);

        if (
          !Number.isNaN(
            numeric
          ) &&
          numeric >
            rules.max
        ) {
          return {
            field,
            message:
              `"${this.fieldLabel(
                field
              )}" must be at most ${rules.max}.`
          };
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
    if (declared === "password") return "password";

    return "text";
  }

  static generatedFieldValue(moduleClass, field) {
    const generator =
      moduleClass.config.fieldGenerators?.[field];

    return typeof generator === "function"
      ? String(generator() || "")
      : "";
  }

  static buildColumns(rows, moduleClass) {
    const configured =
      moduleClass.config.columns || [];

    if (configured.length) {
      return configured;
    }

    const row =
      rows.find(Boolean) || {};

    return Object.keys(row)
      .filter(
        (key) =>
          ![
            "id",
            "created_at",
            "updated_at"
          ].includes(key)
      )
      .slice(0, 6)
      .map((key) => ({
        key,
        label: key.replace(
          /_/g,
          " "
        )
      }));
  }

  static async load(moduleClass) {
    const state =
      this.getState(moduleClass);

    const {
      tableName,
      orderBy = "created_at"
    } = moduleClass.config;

    state.profile =
      await this.resolveProfile();

    state.rows =
      await API.records.getAll(
        tableName,
        {
          orderBy,
          ascending: false,
          select: "*"
        }
      );

    // The row transformer (parents join linked children, for example) and
    // form lookup loading are independent network work. Running them together
    // prevents one slow request from making a module feel different to the
    // rest of the dashboard.
    const rawRows = state.rows;
    const transformedRows = typeof moduleClass.config.transformRows === "function"
      ? moduleClass.config.transformRows(rawRows)
      : Promise.resolve(rawRows);
    const [, transformed] = await Promise.all([
      this.loadLookups(moduleClass, state),
      transformedRows
    ]);
    state.rows = transformed;

    state.columns =
      this.buildColumns(
        state.rows,
        moduleClass
      );
  }

  static roleScopeCandidates(role) {
    if (role === "teacher") {
      return [
        "teacher_id",
        "profile_id",
        "created_by",
        "user_id"
      ];
    }

    if (role === "student") {
      return [
        "student_id",
        "profile_id",
        "user_id"
      ];
    }

    if (role === "parent") {
      return [
        "parent_id",
        "profile_id",
        "user_id"
      ];
    }

    return [];
  }

  static applyRoleScope(
    rows,
    state,
    moduleClass
  ) {
    const role =
      String(
        state.profile?.role || ""
      ).toLowerCase();

    const userId =
      String(
        state.profile?.id || ""
      );

    if (
      !role ||
      !userId
    ) {
      return rows;
    }

    /*
     * These roles have unrestricted office-module
     * visibility according to the existing application
     * permissions.
     *
     * IMPORTANT:
     * Admin must remain here. Removing admin from this
     * list causes the admin dashboard modules to disappear
     * or become incorrectly scoped.
     */
    if (
      [
        "ceo",
        "admin",
        "executive",
        "finance",
        "hr",
        "admission",
        "exam",
        "library"
      ].includes(role)
    ) {
      return rows;
    }

    if (
      typeof moduleClass
        .config
        .scopeRows ===
      "function"
    ) {
      return moduleClass.config.scopeRows(
        rows,
        state.profile
      );
    }

    const keys =
      this.roleScopeCandidates(
        role
      );

    if (!keys.length) {
      return rows;
    }

    return rows.filter(
      (row) => {
        const keysPresent =
          keys.filter(
            (key) =>
              typeof row[key] !==
                "undefined" &&
              row[key] !== null &&
              row[key] !== ""
          );

        /*
         * If the table doesn't have any of the expected
         * scope fields, don't accidentally hide the records.
         */
        if (
          !keysPresent.length
        ) {
          return true;
        }

        return keysPresent.some(
          (key) =>
            String(
              row[key]
            ) === userId
        );
      }
    );
  }

  static currentRole(state) {
    return String(
      state?.profile?.role ||
      ""
    ).toLowerCase();
  }

  static defaultRolePermissions(
    moduleClass
  ) {
    const moduleKey =
      String(
        moduleClass.config.moduleKey ||
        ""
      );

    /*
     * Keep the existing application permissions.
     *
     * Admin MUST have access to:
     * - Teachers
     * - Parents
     * - Attendance
     */
    const byModule = {
      teachers: [
        "ceo",
        "admin",
        "executive",
        "hr"
      ],

      parents: [
        "ceo",
        "admin",
        "executive",
        "admission"
      ],

      attendance: [
        "ceo",
        "admin",
        "executive",
        "teacher",
        "exam"
      ],

      assignments: [
        "ceo",
        "admin",
        "executive",
        "teacher",
        "exam"
      ],

      grades: [
        "ceo",
        "admin",
        "executive",
        "teacher",
        "exam"
      ],

      finance: [
        "ceo",
        "admin",
        "executive",
        "finance"
      ],

      notifications: [
        "ceo",
        "admin",
        "executive",
        "hr",
        "admission",
        "exam",
        "library",
        "finance"
      ],

      reports: []
    };

    const allowed =
      byModule[moduleKey] ||
      [
        "ceo",
        "admin",
        "executive"
      ];

    return {
      create:
        allowed,

      edit:
        allowed,

      delete: [
        "ceo",
        "admin",
        "executive"
      ]
    };
  }

  static deleteConfig(
    moduleClass
  ) {
    const softDelete =
      Boolean(
        moduleClass.config
          .softDelete
      );

    const softDeleteField =
      String(
        moduleClass.config
          .softDeleteField ||
        "status"
      ).trim();

    const softDeleteValue =
      String(
        moduleClass.config
          .softDeleteValue ||
        "archived"
      ).trim();

    const softRestoreValue =
      String(
        moduleClass.config
          .softRestoreValue ||
        "active"
      ).trim();

    return {
      softDelete,
      softDeleteField,
      softDeleteValue,
      softRestoreValue
    };
  }

  static isActionAllowed(
    moduleClass,
    state,
    action
  ) {
    if (
      moduleClass.config.readOnly
    ) {
      return false;
    }

    const role =
      this.currentRole(
        state
      );

    if (!role) {
      return false;
    }

    const permissions =
      moduleClass.config
        .permissions ||
      this.defaultRolePermissions(
        moduleClass
      );

    const allowedRoles =
      permissions[action] ||
      [];

    if (
      allowedRoles.includes("*")
    ) {
      return true;
    }

    return allowedRoles.includes(
      role
    );
  }

  static getRows(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const search =
      state.search
        .trim()
        .toLowerCase();

    const statusFilter =
      String(
        state.status ||
        "all"
      ).toLowerCase();

    let rows =
      this.applyRoleScope(
        [
          ...state.rows
        ],
        state,
        moduleClass
      );

    if (search) {
      rows =
        rows.filter(
          (row) => {
            return state.columns.some(
              (column) => {
                const value =
                  this.getDisplayValue(
                    row,
                    column.key,
                    state
                  ).toLowerCase();

                return value.includes(
                  search
                );
              }
            );
          }
        );
    }

    if (
      statusFilter !==
      "all"
    ) {
      rows =
        rows.filter(
          (row) =>
            String(
              row.status || ""
            ).toLowerCase() ===
            statusFilter
        );
    }

    const key =
      state.sortKey;

    if (key) {
      rows.sort(
        (a, b) => {
          const aValue =
            this.getDisplayValue(
              a,
              key,
              state
            ).toLowerCase();

          const bValue =
            this.getDisplayValue(
              b,
              key,
              state
            ).toLowerCase();

          if (
            aValue <
            bValue
          ) {
            return state.sortDir ===
              "asc"
              ? -1
              : 1;
          }

          if (
            aValue >
            bValue
          ) {
            return state.sortDir ===
              "asc"
              ? 1
              : -1;
          }

          return 0;
        }
      );
    }

    return rows;
  }

  static pagedRows(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const rows =
      this.getRows(
        moduleClass
      );

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          rows.length /
          state.pageSize
        )
      );

    state.page =
      Math.min(
        state.page,
        totalPages
      );

    const start =
      (state.page - 1) *
      state.pageSize;

    return {
      rows:
        rows.slice(
          start,
          start +
            state.pageSize
        ),

      total:
        rows.length,

      totalPages
    };
  }

  static statusOptions(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const set =
      new Set([
        "all"
      ]);

    state.rows.forEach(
      (row) => {
        if (
          row &&
          typeof row.status !==
            "undefined" &&
          row.status !==
            null &&
          String(
            row.status
          ).trim()
        ) {
          set.add(
            String(
              row.status
            ).toLowerCase()
          );
        }
      }
    );

    return Array.from(
      set
    );
  }

  static template(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const pageData =
      this.pagedRows(
        moduleClass
      );

    const statusOptions =
      this.statusOptions(
        moduleClass
      );

    const canWrite =
      !moduleClass.config
        .readOnly;

    const canCreate =
      this.isActionAllowed(
        moduleClass,
        state,
        "create"
      );

    return `
<div class="space-y-6">

  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

    <div>

      <h2 class="text-3xl font-bold text-slate-800">
        ${this.safe(
          moduleClass.config.title
        )}
      </h2>

      <p class="text-sm text-slate-500 mt-1">
        Live records with search, sorting, pagination, and exports.
      </p>

    </div>

    <div class="flex flex-wrap items-center gap-2">

      ${
        canWrite &&
        canCreate
          ? `
<button
  data-action="create"
  data-module="${this.safe(
    moduleClass.config.moduleKey
  )}"
  class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
>
  Add
</button>
`
          : ""
      }

      <button
        data-action="export-csv"
        data-module="${this.safe(
          moduleClass.config.moduleKey
        )}"
        class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
      >
        CSV
      </button>

      <button
        data-action="export-excel"
        data-module="${this.safe(
          moduleClass.config.moduleKey
        )}"
        class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
      >
        Excel
      </button>

      <button
        data-action="print"
        data-module="${this.safe(
          moduleClass.config.moduleKey
        )}"
        class="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
      >
        Print
      </button>

    </div>

  </div>

  <div class="bg-white rounded-xl shadow p-4">

    <div class="flex flex-col md:flex-row gap-3">

      <input
        type="search"
        data-search="${this.safe(
          moduleClass.config.moduleKey
        )}"
        value="${this.safe(
          state.search
        )}"
        placeholder="Search records..."
        class="flex-1 rounded-lg border border-slate-300 px-3 py-2.5"
      />

      <select
        data-status="${this.safe(
          moduleClass.config.moduleKey
        )}"
        class="rounded-lg border border-slate-300 px-3 py-2.5"
      >

        ${statusOptions
          .map(
            (status) => `
<option
  value="${this.safe(
    status
  )}"
  ${
    String(
      status
    ) ===
    String(
      state.status
    )
      ? "selected"
      : ""
  }
>
  ${this.safe(
    status === "all"
      ? "All Statuses"
      : status
  )}
</option>
`
          )
          .join("")}

      </select>

    </div>

  </div>

  <div class="bg-white rounded-xl shadow overflow-hidden">

    <div class="overflow-x-auto">

      <table class="min-w-full">

        <thead class="bg-slate-50">

          <tr>

            ${state.columns
              .map(
                (column) => `
<th
  data-sort-key="${this.safe(
    column.key
  )}"
  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer"
>
  ${this.safe(
    column.label ||
      column.key
  )}
</th>
`
              )
              .join("")}

            ${
              canWrite
                ? `
<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
  Actions
</th>
`
                : ""
            }

          </tr>

        </thead>

        <tbody>

          ${
            pageData.rows
              .length
              ? pageData.rows
                  .map(
                    (row) => `
<tr class="border-t border-slate-100 hover:bg-slate-50">

  ${state.columns
    .map(
      (column) => `
<td class="px-4 py-3 text-sm text-slate-700">
  ${this.safe(
    this.getDisplayValue(
      row,
      column.key,
      state
    )
  )}
</td>
`
    )
    .join("")}

  ${
    canWrite
      ? `
<td class="px-4 py-3 text-right whitespace-nowrap">

  ${
    this.isActionAllowed(
      moduleClass,
      state,
      "edit"
    )
      ? `
<button
  data-action="edit"
  data-id="${this.safe(
    row.id
  )}"
  class="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-sm"
>
  Edit
</button>
`
      : ""
  }

  ${
    this.isActionAllowed(
      moduleClass,
      state,
      "delete"
    )
      ? `
<button
  data-action="delete"
  data-id="${this.safe(
    row.id
  )}"
  class="ml-1 px-2.5 py-1.5 rounded border border-red-200 bg-white hover:bg-red-50 text-red-600 text-sm"
>
  Delete
</button>
`
      : ""
  }

</td>
`
      : ""
  }

</tr>
`
                  )
                  .join("")
              : `
<tr>

  <td
    colspan="${
      state.columns.length +
      (canWrite ? 1 : 0)
    }"
    class="px-4 py-12 text-center text-slate-500"
  >
    No records found.
  </td>

</tr>
`
          }

        </tbody>

      </table>

    </div>

    <div class="border-t border-slate-100 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">

      <div class="text-sm text-slate-500">
        Showing ${pageData.rows.length}
        of ${pageData.total}
      </div>

      <div class="flex items-center gap-2">

        <button
          data-action="previous-page"
          class="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          ${state.page <= 1 ? "disabled" : ""}
        >
          Previous
        </button>

        <span class="text-sm text-slate-600">
          Page ${state.page}
          of ${pageData.totalPages}
        </span>

        <button
          data-action="next-page"
          class="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          ${
            state.page >=
            pageData.totalPages
              ? "disabled"
              : ""
          }
        >
          Next
        </button>

      </div>

    </div>

  </div>

  ${this.modalTemplate(
    moduleClass
  )}

</div>
`;
  }
    static rowTemplate(
    row,
    columns,
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const deletion =
      this.deleteConfig(
        moduleClass
      );

    const canEdit =
      this.isActionAllowed(
        moduleClass,
        state,
        "edit"
      );

    const canDelete =
      this.isActionAllowed(
        moduleClass,
        state,
        "delete"
      );

    const rowStatus =
      String(
        row?.[
          deletion.softDeleteField
        ] || ""
      ).toLowerCase();

    const isArchived =
      deletion.softDelete &&
      rowStatus ===
        String(
          deletion.softDeleteValue ||
            ""
        ).toLowerCase();

    const canRestore =
      deletion.softDelete &&
      this.isActionAllowed(
        moduleClass,
        state,
        "edit"
      );

    const canWrite =
      canEdit ||
      canDelete ||
      canRestore;

    const cells =
      columns
        .map(
          (column) => {
            const rawValue =
              this.getDisplayValue(
                row,
                column.key,
                state
              );

            const value =
              rawValue.length >
              80
                ? `${rawValue.slice(
                    0,
                    77
                  )}...`
                : rawValue;

            return `
<td class="px-3 py-2.5 border-b border-slate-100">
  ${this.safe(value)}
</td>
`;
          }
        )
        .join("");

    const rowId =
      this.safe(
        row.id || ""
      );

    return `
<tr class="hover:bg-slate-50">

  ${cells}

  <td class="px-3 py-2.5 border-b border-slate-100 text-right whitespace-nowrap">

    ${
      isArchived
        ? canRestore
          ? `
<button
  data-action="restore"
  data-id="${rowId}"
  data-module="${this.safe(
    moduleClass.config.moduleKey
  )}"
  class="text-emerald-600 hover:text-emerald-700"
>
  Restore
</button>
`
          : `
<span class="text-slate-400">
  Archived
</span>
`
        : `
${
  canEdit
    ? `
<button
  data-action="edit"
  data-id="${rowId}"
  data-module="${this.safe(
    moduleClass.config.moduleKey
  )}"
  class="text-blue-600 hover:text-blue-700 mr-3"
>
  Edit
</button>
`
    : ""
}

${
  canDelete
    ? `
<button
  data-action="delete"
  data-id="${rowId}"
  data-module="${this.safe(
    moduleClass.config.moduleKey
  )}"
  class="text-red-600 hover:text-red-700"
>
  ${
    deletion.softDelete
      ? "Archive"
      : "Delete"
  }
</button>
`
    : ""
}
`
    }

    ${
      canWrite
        ? ""
        : `
<span class="text-slate-400">
  Read only
</span>
`
    }

  </td>

</tr>
`;
  }


  static async render(
    moduleClass,
    container
  ) {
    const state =
      this.getState(
        moduleClass
      );

    state.container =
      container;

    container.innerHTML = `
<div class="bg-white rounded-xl shadow p-8 text-center text-slate-500">

  Loading
  ${this.safe(
    moduleClass.config.title
  )}...

</div>
`;

    try {
      await this.load(
        moduleClass
      );

      container.innerHTML =
        this.template(
          moduleClass
        );

      this.bindEvents(
        moduleClass
      );

    } catch (error) {
      console.error(
        `Unable to render ${moduleClass.config.moduleKey}:`,
        error
      );

      container.innerHTML = `
<div class="bg-white rounded-xl shadow p-8">

  <div class="text-center text-red-600">

    <div class="text-lg font-semibold">
      Unable to load ${this.safe(
        moduleClass.config.title
      )}
    </div>

    <div class="mt-2 text-sm text-slate-500">
      ${this.safe(
        error?.message ||
          "An unexpected error occurred."
      )}
    </div>

    <button
      data-action="refresh"
      data-module="${this.safe(
        moduleClass.config.moduleKey
      )}"
      class="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
    >
      Retry
    </button>

  </div>

</div>
`;

      this.bindEvents(
        moduleClass
      );
    }
  }


  static bindEvents(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const container =
      state.container;

    if (!container) {
      return;
    }


    /* ================================================
       SEARCH
    ================================================ */

    const searchInput =
      container.querySelector(
        '[data-search]'
      );

    if (searchInput) {
      searchInput.addEventListener(
        "input",
        () => {
          state.search =
            searchInput.value ||
            "";

          state.page = 1;

          container.innerHTML =
            this.template(
              moduleClass
            );

          this.bindEvents(
            moduleClass
          );
        }
      );
    }


    /* ================================================
       STATUS FILTER
    ================================================ */

    const statusInput =
      container.querySelector(
        '[data-status]'
      );

    if (statusInput) {
      statusInput.addEventListener(
        "change",
        () => {
          state.status =
            statusInput.value ||
            "all";

          state.page = 1;

          container.innerHTML =
            this.template(
              moduleClass
            );

          this.bindEvents(
            moduleClass
          );
        }
      );
    }


    /* ================================================
       SORTING
    ================================================ */

    container
      .querySelectorAll(
        "[data-sort-key]"
      )
      .forEach(
        (header) => {
          header.addEventListener(
            "click",
            () => {
              const key =
                header.getAttribute(
                  "data-sort-key"
                );

              if (
                state.sortKey ===
                key
              ) {
                state.sortDir =
                  state.sortDir ===
                  "asc"
                    ? "desc"
                    : "asc";
              } else {
                state.sortKey =
                  key;

                state.sortDir =
                  "asc";
              }

              container.innerHTML =
                this.template(
                  moduleClass
                );

              this.bindEvents(
                moduleClass
              );
            }
          );
        }
      );


    /* ================================================
       CREATE / EDIT / DELETE / RESTORE
    ================================================ */

    container
      .querySelectorAll(
        "[data-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            async () => {
              const action =
                button.getAttribute(
                  "data-action"
                );

              const id =
                button.getAttribute(
                  "data-id"
                );


              if (
                action ===
                "create"
              ) {
                this.openModal(
                  moduleClass,
                  "create",
                  null
                );

                return;
              }


              if (
                action ===
                "edit"
              ) {
                this.openModal(
                  moduleClass,
                  "edit",
                  id
                );

                return;
              }


              if (
                action ===
                "delete"
              ) {
                await this.deleteRow(
                  moduleClass,
                  id
                );

                return;
              }


              if (
                action ===
                "restore"
              ) {
                await this.restoreRow(
                  moduleClass,
                  id
                );

                return;
              }


              if (
                action ===
                "refresh"
              ) {
                await this.render(
                  moduleClass,
                  container
                );

                return;
              }


              if (
                action ===
                "csv"
              ) {
                this.exportRows(
                  moduleClass,
                  "csv"
                );

                return;
              }


              if (
                action ===
                "excel"
              ) {
                this.exportRows(
                  moduleClass,
                  "excel"
                );

                return;
              }


              if (
                action ===
                "print"
              ) {
                this.printRows(
                  moduleClass
                );

                return;
              }


              if (
                action ===
                "previous-page"
              ) {
                if (
                  state.page >
                  1
                ) {
                  state.page -=
                    1;

                  container.innerHTML =
                    this.template(
                      moduleClass
                    );

                  this.bindEvents(
                    moduleClass
                  );
                }

                return;
              }


              if (
                action ===
                "next-page"
              ) {
                const pageData =
                  this.pagedRows(
                    moduleClass
                  );

                if (
                  state.page <
                  pageData.totalPages
                ) {
                  state.page +=
                    1;

                  container.innerHTML =
                    this.template(
                      moduleClass
                    );

                  this.bindEvents(
                    moduleClass
                  );
                }

                return;
              }
            }
          );
        }
      );


    /* ================================================
       MODAL CLOSE
    ================================================ */

    container
      .querySelectorAll(
        "[data-modal-close]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              this.closeModal(
                moduleClass
              );
            }
          );
        }
      );


    /* ================================================
       MODAL FORM
    ================================================ */

    const form =
      container.querySelector(
        "[data-module-form]"
      );

    if (
      form
    ) {
      form.querySelectorAll("[data-password-toggle]").forEach(
        (button) => {
          button.addEventListener("click", () => {
            const input = button.parentElement?.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;
            const hidden = input.type === "password";
            input.type = hidden ? "text" : "password";
            button.textContent = hidden ? "Hide" : "Show";
            button.setAttribute("aria-label", `${hidden ? "Hide" : "Show"} password`);
          });
        }
      );

      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          this.clearModalErrors(
            form
          );

          const formData =
            new FormData(
              form
            );

          const payload =
            {};

          formData.forEach(
            (
              value,
              key
            ) => {
              payload[key] =
                String(
                  value ?? ""
                ).trim();
            }
          );

          const multiValueFields =
            moduleClass.config.multiValueFields ||
            [];

          // Keep all selections from enrollment forms. FormData.forEach()
          // otherwise leaves only the final selected value for a field.
          multiValueFields.forEach(
            (field) => {
              payload[field] = formData
                .getAll(field)
                .map((value) => String(value ?? "").trim())
                .filter(Boolean);
            }
          );


          const hasAnyValue =
            Object.values(
              payload
            ).some(
              (value) =>
                String(
                  value
                ).trim() !==
                ""
            );

          if (
            !hasAnyValue
          ) {
            this.showModalError(
              form,
              "Please provide at least one value."
            );

            return;
          }


          const validationError =
            this.validatePayload(
              moduleClass,
              payload,
              state.modal.mode
            );

          if (
            validationError
          ) {
            this.showModalError(
              form,
              validationError.message
            );

            this.showFieldError(
              form,
              validationError.field,
              validationError.message
            );

            return;
          }


          const parsedPayload =
            this.parsePayload(
              moduleClass,
              payload
            );


          let result;


          if (
            state.modal.mode ===
              "edit" &&
            state.modal.rowId
          ) {
            result = typeof moduleClass.config.updateRecord === "function"
              ? await moduleClass.config.updateRecord(parsedPayload, state.modal.rowId)
              : await API.records.update(
                  moduleClass.config.tableName,
                  state.modal.rowId,
                  parsedPayload
                );

          } else if (
            typeof moduleClass
              .config
              .createRecord ===
            "function"
          ) {
            result =
              await moduleClass
                .config
                .createRecord(
                  parsedPayload
                );

          } else {
            result =
              await API.records.create(
                moduleClass
                  .config
                  .tableName,

                parsedPayload
              );
          }


          if (
            !result?.success
          ) {
            this.showModalError(
              form,
              result?.message ||
                "Unable to save record."
            );

            return;
          }


          const action =
            state.modal.mode ===
            "edit"
              ? "update"
              : "create";


          const recordId =
            state.modal.mode ===
              "edit"
              ? state.modal
                  .rowId
              : (
                  result?.data
                    ?.id ||
                  null
                );


          await this.auditAction(
            moduleClass,
            state,
            action,
            parsedPayload,
            recordId
          );


          this.showMessage(
            result.message ||
              "Record saved successfully.",
            "success"
          );


          this.closeModal(
            moduleClass
          );


          await this.render(
            moduleClass,
            state.container
          );
        }
      );
    }
  }


  static openModal(
    moduleClass,
    mode = "create",
    rowId = null,
    initialValues = null
  ) {
    const state =
      this.getState(
        moduleClass
      );

    state.modal = {
      open: true,
      mode,
      rowId,
      initialValues
    };

    state.container.innerHTML =
      this.template(
        moduleClass
      );

    this.bindEvents(
      moduleClass
    );
  }


  static closeModal(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    state.modal = {
      open: false,
      mode: "create",
      rowId: null
    };

    state.container.innerHTML =
      this.template(
        moduleClass
      );

    this.bindEvents(
      moduleClass
    );
  }
    static modalTemplate(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    if (
      !state.modal.open
    ) {
      return "";
    }

    const isEdit =
      state.modal.mode ===
      "edit";

    const row =
      isEdit
        ? state.rows.find(
            (item) =>
              String(
                item.id
              ) ===
              String(
                state.modal.rowId
              )
          ) || {}
        : (state.modal.initialValues || {});

    const fields =
      isEdit
        ? (moduleClass.config.editFields || moduleClass.config.fields || [])
        : (moduleClass.config.fields || []);

    const requiredFields =
      isEdit
        ? (moduleClass.config.editRequiredFields || moduleClass.config.requiredFields || [])
        : (moduleClass.config.requiredFields || []);

    const fieldTypes =
      moduleClass.config.fieldTypes ||
      {};

    const fieldOptions =
      moduleClass.config.fieldOptions ||
      {};

    const multiValueFields =
      moduleClass.config.multiValueFields ||
      [];

    return `
<div
  class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
  data-modal
>
  <div
    class="w-full max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl"
    style="-webkit-overflow-scrolling: touch; scroll-behavior: smooth;"
  >

    <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">

      <div>

        <h3 class="text-xl font-bold text-slate-800">
          ${
            isEdit
              ? "Edit"
              : "Add"
          }
          ${this.safe(
            moduleClass.config.title
          )}
        </h3>

        <p class="mt-1 text-sm text-slate-500">
          ${
            isEdit
              ? "Update the selected record."
              : "Create a new record."
          }
        </p>

      </div>

      <button
        type="button"
        data-modal-close
        class="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label="Close"
      >
        ×
      </button>

    </div>


    <form
      data-module-form
      class="p-6"
      data-module-key="${this.safe(
        moduleClass.config.moduleKey
      )}"
    >

      <div
        data-modal-error
        class="hidden mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      ></div>


      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

        ${
          fields.length
            ? fields
                .map(
                  (field) => {
                    const key =
                      typeof field ===
                      "string"
                        ? field
                        : field.key;

                    const label =
                      typeof field ===
                      "string"
                        ? this.fieldLabel(
                            field
                          )
                        : (
                            field.label ||
                            this.fieldLabel(
                              field.key
                            )
                          );

                    const declaredType =
                      typeof field ===
                      "object"
                        ? field.type
                        : null;

                    const type =
                      declaredType ||
                      this.getInputType(
                        moduleClass,
                        key
                      );

                    const required =
                      requiredFields.includes(
                        key
                      ) ||
                      Boolean(
                        typeof field ===
                          "object" &&
                        field.required
                      );

                    const options =
                      fieldOptions[
                        key
                      ] ||
                      (
                        typeof field ===
                          "object"
                          ? field.options
                          : null
                      ) ||
                      (
                        type === "multi-select" ||
                        Object.prototype.hasOwnProperty.call(
                          moduleClass.config.lookups || {},
                          key
                        )
                          ? Object.entries(
                              // Lookup state carries metadata alongside the
                              // ID-to-label map. Forms must use only that map;
                              // iterating the wrapper renders entries such as
                              // "classes" and "[object Object]" as options.
                              state.lookups[key]?.map || {}
                            ).map(
                              ([value, label]) => ({ value, label })
                            )
                          : []
                      );

                    const isMultiValue =
                      type === "multi-select" ||
                      multiValueFields.includes(key);

                    const generated =
                      this.generatedFieldValue(
                        moduleClass,
                        key
                      );

                    const current =
                      typeof row[
                        key
                      ] !==
                      "undefined"
                        ? row[
                            key
                          ]
                        : generated;

                    const disabled =
                      typeof field ===
                        "object" &&
                      Boolean(
                        field.disabled
                      );

                    const fullWidth =
                      typeof field ===
                        "object" &&
                      Boolean(
                        field.fullWidth
                      );

                    return `
<div
  class="${
    fullWidth
      ? "md:col-span-2"
      : ""
  }"
>

  <label
    class="mb-1.5 block text-sm font-medium text-slate-700"
    for="${this.safe(
      key
    )}"
  >
    ${this.safe(
      label
    )}

    ${
      required
        ? `<span class="text-red-500">*</span>`
        : ""
    }

  </label>


  ${
    options.length
      ? `
<select
  id="${this.safe(
    key
  )}"
  name="${this.safe(
    key
  )}"
  ${
    isMultiValue
      ? 'multiple size="6"'
      : ""
  }
  ${
    required
      ? "required"
      : ""
  }
  ${
    disabled
      ? "disabled"
      : ""
  }
  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
>

  ${
    isMultiValue
      ? ""
      : `<option value="">\n    Select ${this.safe(label)}\n  </option>`
  }

  ${options
    .map(
      (option) => {
        const optionValue =
          typeof option ===
          "object"
            ? option.value
            : option;

        const optionLabel =
          typeof option ===
          "object"
            ? (
                option.label ??
                option.name ??
                option.value
              )
            : option;

        const selected =
          isMultiValue
            ? (Array.isArray(current) ? current : [])
                .map((value) => String(value))
                .includes(String(optionValue ?? ""))
            : String(current ?? "") === String(optionValue ?? "");

        return `
<option
  value="${this.safe(
    optionValue
  )}"
  ${
    selected
      ? "selected"
      : ""
  }
>
  ${this.safe(
    optionLabel
  )}
</option>
`;
      }
    )
    .join("")}

</select>
`
      : type ===
        "textarea"
      ? `
<textarea
  id="${this.safe(
    key
  )}"
  name="${this.safe(
    key
  )}"
  ${
    required
      ? "required"
      : ""
  }
  ${
    disabled
      ? "disabled"
      : ""
  }
  rows="4"
  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
>${this.safe(
    current
  )}</textarea>
`
      : type === "password"
      ? `
<div class="relative">
<input
  id="${this.safe(key)}"
  name="${this.safe(key)}"
  type="password"
  value="${this.safe(current)}"
  ${required ? "required" : ""}
  ${disabled ? "disabled" : ""}
  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-16 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
/>
<button type="button" data-password-toggle class="absolute inset-y-0 right-2 text-sm text-blue-700 hover:text-blue-900" aria-label="Show password">Show</button>
</div>
`
      : `
<input
  id="${this.safe(
    key
  )}"
  name="${this.safe(
    key
  )}"
  type="${this.safe(
    type
  )}"
  value="${this.safe(
    current
  )}"
  ${
    required
      ? "required"
      : ""
  }
  ${
    disabled
      ? "disabled"
      : ""
  }
  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
/>
`
  }

  <p
    data-field-error="${this.safe(
      key
    )}"
    class="hidden mt-1 text-xs text-red-600"
  ></p>

</div>
`;
                  }
                )
                .join("")
            : `
<div class="md:col-span-2 text-sm text-slate-500">
  No editable fields have been configured for this module.
</div>
`
        }

      </div>


      <div class="mt-7 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">

        <button
          type="button"
          data-modal-close
          class="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          class="px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          ${
            isEdit
              ? "Save Changes"
              : "Create Record"
          }
        </button>

      </div>

    </form>

  </div>
</div>
`;
  }


  static async deleteRow(
    moduleClass,
    rowId
  ) {
    const state =
      this.getState(
        moduleClass
      );

    if (
      !this.isActionAllowed(
        moduleClass,
        state,
        "delete"
      )
    ) {
      this.showMessage(
        "You do not have permission to delete this record.",
        "error"
      );

      return;
    }

    const row =
      state.rows.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            rowId
          )
      );

    if (!row) {
      this.showMessage(
        "The selected record could not be found.",
        "error"
      );

      return;
    }


    const deletion =
      this.deleteConfig(
        moduleClass
      );


    const message =
      deletion.softDelete
        ? "Are you sure you want to archive this record?"
        : "Are you sure you want to permanently delete this record?";


    if (
      !window.confirm(
        message
      )
    ) {
      return;
    }


    let result;


    if (
      typeof moduleClass
        .config
        .deleteRecord ===
      "function"
    ) {
      result =
        await moduleClass
          .config
          .deleteRecord(
            row
          );

    } else if (
      deletion.softDelete
    ) {
      const payload = {};

      payload[
        deletion.softDeleteField
      ] =
        deletion.softDeleteValue;

      result =
        await API.records.update(
          moduleClass
            .config
            .tableName,
          rowId,
          payload
        );

    } else {
      result =
        await API.records.delete(
          moduleClass
            .config
            .tableName,
          rowId
        );
    }


    if (
      !result?.success
    ) {
      this.showMessage(
        result?.message ||
          "Unable to delete the record.",
        "error"
      );

      return;
    }


    await this.auditAction(
      moduleClass,
      state,
      deletion.softDelete
        ? "archive"
        : "delete",
      {},
      rowId
    );


    this.showMessage(
      result.message ||
        (
          deletion.softDelete
            ? "Record archived successfully."
            : "Record deleted successfully."
        ),
      "success"
    );


    await this.render(
      moduleClass,
      state.container
    );
  }


  static async restoreRow(
    moduleClass,
    rowId
  ) {
    const state =
      this.getState(
        moduleClass
      );

    if (
      !this.isActionAllowed(
        moduleClass,
        state,
        "edit"
      )
    ) {
      this.showMessage(
        "You do not have permission to restore this record.",
        "error"
      );

      return;
    }


    const deletion =
      this.deleteConfig(
        moduleClass
      );


    if (
      !deletion.softDelete
    ) {
      return;
    }


    const payload = {};

    payload[
      deletion.softDeleteField
    ] =
      deletion.softRestoreValue;


    const result =
      await API.records.update(
        moduleClass
          .config
          .tableName,
        rowId,
        payload
      );


    if (
      !result?.success
    ) {
      this.showMessage(
        result?.message ||
          "Unable to restore the record.",
        "error"
      );

      return;
    }


    await this.auditAction(
      moduleClass,
      state,
      "restore",
      {},
      rowId
    );


    this.showMessage(
      result.message ||
        "Record restored successfully.",
      "success"
    );


    await this.render(
      moduleClass,
      state.container
    );
  }


  static exportRows(
    moduleClass,
    format = "csv"
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const rows =
      this.getRows(
        moduleClass
      );

    const columns =
      state.columns ||
      [];


    if (!rows.length) {
      this.showMessage(
        "There are no records to export.",
        "error"
      );

      return;
    }


    const data =
      rows.map(
        (row) => {
          const output = {};

          columns.forEach(
            (column) => {
              output[
                column.label ||
                  column.key
              ] =
                this.getDisplayValue(
                  row,
                  column.key,
                  state
                );
            }
          );

          return output;
        }
      );


    if (
      format ===
      "excel"
    ) {
      if (
        window.XLSX
      ) {
        const worksheet =
          XLSX.utils.json_to_sheet(
            data
          );

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          String(
            moduleClass
              .config
              .title ||
              "Export"
          ).slice(
            0,
            31
          )
        );

        XLSX.writeFile(
          workbook,
          `${moduleClass.config.moduleKey}.xlsx`
        );

        return;
      }

      /*
       * If SheetJS is not loaded, fall back to CSV.
       * This avoids breaking the dashboard.
       */
      format =
        "csv";
    }


    const headers =
      columns.map(
        (column) =>
          column.label ||
          column.key
      );


    const csvRows = [
      headers,
      ...data.map(
        (row) =>
          headers.map(
            (header) =>
              row[header] ??
              ""
          )
      )
    ];


    const csv =
      csvRows
        .map(
          (row) =>
            row
              .map(
                (value) =>
                  `"${String(
                    value
                  )
                    .replace(
                      /"/g,
                      '""'
                    )}"`
              )
              .join(",")
        )
        .join("\n");


    const blob =
      new Blob(
        [
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      `${moduleClass.config.moduleKey}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }


  static printRows(
    moduleClass
  ) {
    const state =
      this.getState(
        moduleClass
      );

    const rows =
      this.getRows(
        moduleClass
      );

    const columns =
      state.columns ||
      [];


    const tableRows =
      rows
        .map(
          (row) => `
<tr>
  ${columns
    .map(
      (column) => `
<td>
  ${this.safe(
    this.getDisplayValue(
      row,
      column.key,
      state
    )
  )}
</td>
`
    )
    .join("")}
</tr>
`
        )
        .join("");


    const html = `
<!doctype html>

<html>

<head>

  <meta charset="utf-8">

  <title>
    ${this.safe(
      moduleClass.config.title
    )}
  </title>

  <style>

    body {
      font-family:
        Arial,
        sans-serif;
      padding:
        24px;
      color:
        #111827;
    }

    h1 {
      margin-bottom:
        20px;
    }

    table {
      width:
        100%;
      border-collapse:
        collapse;
    }

    th,
    td {
      border:
        1px solid
        #d1d5db;
      padding:
        8px;
      text-align:
        left;
      font-size:
        12px;
    }

    th {
      background:
        #f3f4f6;
    }

  </style>

</head>

<body>

  <h1>
    ${this.safe(
      moduleClass.config.title
    )}
  </h1>

  <table>

    <thead>

      <tr>

        ${columns
          .map(
            (column) => `
<th>
  ${this.safe(
    column.label ||
      column.key
  )}
</th>
`
          )
          .join("")}

      </tr>

    </thead>

    <tbody>
      ${tableRows}
    </tbody>

  </table>

</body>

</html>
`;


    const printWindow =
      window.open(
        "",
        "_blank"
      );


    if (
      !printWindow
    ) {
      this.showMessage(
        "Please allow pop-ups to print this report.",
        "error"
      );

      return;
    }


    printWindow.document.write(
      html
    );

    printWindow.document.close();

    printWindow.focus();

    setTimeout(
      () => {
        printWindow.print();
      },
      250
    );
  }
    static createDefaultModule(
    moduleKey,
    title,
    tableName,
    options = {}
  ) {
    return this.create({
      moduleKey,
      title,
      tableName,

      columns:
        options.columns || [],

      fields:
        options.fields ||
        options.formFields ||
        [],

      formFields:
        options.formFields ||
        options.fields ||
        [],

      requiredFields:
        options.requiredFields ||
        [],

      fieldTypes:
        options.fieldTypes ||
        {},

      fieldOptions:
        options.fieldOptions ||
        {},

      fieldRules:
        options.fieldRules ||
        {},

      multiValueFields:
        options.multiValueFields ||
        [],

      permissions:
        options.permissions ||
        null,

      readOnly:
        Boolean(
          options.readOnly
        ),

      softDelete:
        Boolean(
          options.softDelete
        ),

      softDeleteField:
        options.softDeleteField ||
        "status",

      softDeleteValue:
        options.softDeleteValue ||
        "archived",

      softRestoreValue:
        options.softRestoreValue ||
        "active",

      defaultSortKey:
        options.defaultSortKey ||
        "",

      orderBy:
        options.orderBy ||
        "created_at",

      lookups:
        options.lookups ||
        {},

      createRecord:
        options.createRecord,

      deleteRecord:
        options.deleteRecord,

      scopeRows:
        options.scopeRows
    });
  }
}


/* =========================================================
   GLOBAL MODULE ENGINE
   ========================================================= */

window.OfficeModuleEngine =
  OfficeModuleEngine;


/* =========================================================
   TEACHERS MODULE
   =========================================================
   Keep this registration available globally.
   The dashboard/router uses window.TeachersModule.
========================================================= */

if (
  !window.TeachersModule
) {
  window.TeachersModule =
    OfficeModuleEngine.createDefaultModule(
      "teachers",
      "Teachers",
      "teachers",
      {
        columns: [
          {
            key:
              "employee_id",
            label:
              "Employee ID"
          },
          {
            key:
              "profile_id",
            label:
              "Teacher"
          },
          {
            key:
              "phone",
            label:
              "Phone"
          },
          {
            key:
              "status",
            label:
              "Status"
          }
        ],

        fields: [
          "employee_id",
          "profile_id",
          "phone",
          "status"
        ],

        requiredFields: [
          "employee_id",
          "profile_id"
        ],

        fieldTypes: {
          employee_id:
            "text",
          profile_id:
            "text",
          phone:
            "text",
          status:
            "text"
        },

        lookups: {
          profile_id: {
            table:
              "profiles",
            preferProfileName:
              true
          }
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "hr"
          ],

          edit: [
            "ceo",
            "admin",
            "executive",
            "hr"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   PARENTS MODULE
========================================================= */

if (
  !window.ParentsModule
) {
  window.ParentsModule =
    OfficeModuleEngine.createDefaultModule(
      "parents",
      "Parents",
      "parents",
      {
        columns: [
          {
            key:
              "profile_id",
            label:
              "Parent"
          },
          {
            key:
              "phone",
            label:
              "Phone"
          },
          {
            key:
              "occupation",
            label:
              "Occupation"
          },
          {
            key:
              "status",
            label:
              "Status"
          }
        ],

        fields: [
          "profile_id",
          "phone",
          "occupation",
          "status"
        ],

        requiredFields: [
          "profile_id"
        ],

        fieldTypes: {
          profile_id:
            "text",
          phone:
            "text",
          occupation:
            "text",
          status:
            "text"
        },

        lookups: {
          profile_id: {
            table:
              "profiles",
            preferProfileName:
              true
          }
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "admission"
          ],

          edit: [
            "ceo",
            "admin",
            "executive",
            "admission"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   ATTENDANCE MODULE
========================================================= */

if (
  !window.AttendanceModule
) {
  window.AttendanceModule =
    OfficeModuleEngine.createDefaultModule(
      "attendance",
      "Attendance",
      "attendance",
      {
        columns: [
          {
            key:
              "student_id",
            label:
              "Student"
          },
          {
            key:
              "class_id",
            label:
              "Class"
          },
          {
            key:
              "attendance_date",
            label:
              "Date"
          },
          {
            key:
              "status",
            label:
              "Status"
          }
        ],

        fields: [
          "student_id",
          "class_id",
          "attendance_date",
          "status"
        ],

        requiredFields: [
          "student_id",
          "class_id",
          "attendance_date",
          "status"
        ],

        fieldTypes: {
          student_id:
            "text",
          class_id:
            "text",
          attendance_date:
            "date",
          status:
            "text"
        },

        lookups: {
          student_id: {
            table:
              "students",
            preferProfileName:
              true
          },

          class_id: {
            table:
              "classes",
            labelKey:
              "class_name"
          }
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "teacher",
            "exam"
          ],

          edit: [
            "ceo",
            "admin",
            "executive",
            "teacher",
            "exam"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   ASSIGNMENTS MODULE
========================================================= */

if (
  !window.AssignmentModule
) {
  window.AssignmentModule =
    OfficeModuleEngine.createDefaultModule(
      "assignments",
      "Assignments",
      "assignments",
      {
        columns: [
          {
            key:
              "title",
            label:
              "Title"
          },
          {
            key:
              "subject_id",
            label:
              "Subject"
          },
          {
            key:
              "teacher_id",
            label:
              "Teacher"
          },
          {
            key:
              "due_date",
            label:
              "Due Date"
          },
          {
            key:
              "status",
            label:
              "Status"
          }
        ],

        fields: [
          "title",
          "subject_id",
          "teacher_id",
          "due_date",
          "status"
        ],

        fieldTypes: {
          title:
            "text",
          subject_id:
            "text",
          teacher_id:
            "text",
          due_date:
            "date",
          status:
            "text"
        },

        lookups: {
          subject_id: {
            table:
              "subjects",
            labelKey:
              "subject_name"
          },

          teacher_id: {
            table:
              "teachers",
            preferProfileName:
              true
          }
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "teacher",
            "exam"
          ],

          edit: [
            "ceo",
            "admin",
            "executive",
            "teacher",
            "exam"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   GRADES MODULE
========================================================= */

if (
  !window.GradesModule
) {
  window.GradesModule =
    OfficeModuleEngine.createDefaultModule(
      "grades",
      "Grades",
      "grades",
      {
        columns: [
          {
            key:
              "student_id",
            label:
              "Student"
          },
          {
            key:
              "subject_id",
            label:
              "Subject"
          },
          {
            key:
              "score",
            label:
              "Score"
          },
          {
            key:
              "grade",
            label:
              "Grade"
          }
        ],

        fields: [
          "student_id",
          "subject_id",
          "score",
          "grade"
        ],

        fieldTypes: {
          student_id:
            "text",
          subject_id:
            "text",
          score:
            "number",
          grade:
            "text"
        },

        lookups: {
          student_id: {
            table:
              "students",
            preferProfileName:
              true
          },

          subject_id: {
            table:
              "subjects",
            labelKey:
              "subject_name"
          }
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "teacher",
            "exam"
          ],

          edit: [
            "ceo",
            "admin",
            "executive",
            "teacher",
            "exam"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   FINANCE MODULE
========================================================= */

if (
  !window.FinanceModule
) {
  window.FinanceModule =
    OfficeModuleEngine.createDefaultModule(
      "finance",
      "Finance",
      "payments",
      {
        columns: [
          {
            key:
              "student_id",
            label:
              "Student"
          },
          {
            key:
              "amount",
            label:
              "Amount"
          },
          {
            key:
              "status",
            label:
              "Status"
          },
          {
            key:
              "created_at",
            label:
              "Date"
          }
        ],

        fields: [
          "student_id",
          "amount",
          "status"
        ],

        fieldTypes: {
          student_id:
            "text",
          amount:
            "number",
          status:
            "text"
        },

        lookups: {
          student_id: {
            table:
              "students",
            preferProfileName:
              true
          }
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "finance"
          ],

          edit: [
            "ceo",
            "admin",
            "executive",
            "finance"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   REPORTS MODULE
========================================================= */

if (
  !window.ReportsModule
) {
  window.ReportsModule =
    OfficeModuleEngine.createDefaultModule(
      "reports",
      "Reports",
      "activity_logs",
      {
        readOnly:
          true,

        columns: [
          {
            key:
              "action",
            label:
              "Action"
          },
          {
            key:
              "module",
            label:
              "Module"
          },
          {
            key:
              "description",
            label:
              "Description"
          },
          {
            key:
              "created_at",
            label:
              "Date"
          }
        ],

        permissions: {
          create: [],
          edit: [],
          delete: []
        }
      }
    );
}


/* =========================================================
   NOTIFICATIONS MODULE
========================================================= */

if (
  !window.NotificationModule
) {
  window.NotificationModule =
    OfficeModuleEngine.createDefaultModule(
      "notifications",
      "Notifications",
      "notifications",
      {
        columns: [
          {
            key:
              "title",
            label:
              "Title"
          },
          {
            key:
              "message",
            label:
              "Message"
          },
          {
            key:
              "status",
            label:
              "Status"
          },
          {
            key:
              "created_at",
            label:
              "Date"
          }
        ],

        fields: [
          "title",
          "message",
          "status"
        ],

        fieldTypes: {
          title:
            "text",
          message:
            "textarea",
          status:
            "text"
        },

        permissions: {
          create: [
            "ceo",
            "admin",
            "executive",
            "hr",
            "admission",
            "exam",
            "library",
            "finance"
          ],

          edit: [
            "ceo",
            "admin",
            "executive"
          ],

          delete: [
            "ceo",
            "admin",
            "executive"
          ]
        }
      }
    );
}


/* =========================================================
   AI MODULE
========================================================= */

if (
  !window.AIModule
) {
  window.AIModule =
    class {
      static async render(
        container
      ) {
        container.innerHTML = `
<div class="bg-white rounded-xl shadow p-6">

  <h2 class="text-2xl font-bold text-slate-800">
    AI Assistant
  </h2>

  <p class="mt-2 text-slate-500">
    AI Assistant is ready.
  </p>

</div>
`;
      }
    };
}


/* =========================================================
   SAFETY CHECK
   =========================================================
   These checks make the problem obvious in the browser
   console instead of silently failing.
========================================================= */

console.log(
  "OfficeModuleEngine loaded:",
  Boolean(
    window.OfficeModuleEngine
  )
);

console.log(
  "Dashboard modules registered:",
  {
    teachers:
      Boolean(
        window.TeachersModule
      ),

    parents:
      Boolean(
        window.ParentsModule
      ),

    attendance:
      Boolean(
        window.AttendanceModule
      ),

    assignments:
      Boolean(
        window.AssignmentModule
      ),

    grades:
      Boolean(
        window.GradesModule
      ),

    finance:
      Boolean(
        window.FinanceModule
      ),

    reports:
      Boolean(
        window.ReportsModule
      ),

    notifications:
      Boolean(
        window.NotificationModule
      )
  }
);
