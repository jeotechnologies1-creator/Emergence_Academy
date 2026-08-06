const FinanceModule = window.OfficeModuleEngine.create({
  moduleKey: "finance",
  title: "Finance",
  tableName: "payments",
  orderBy: "created_at",
  columns: [
    { key: "student_id", label: "Student" },
    { key: "amount", label: "Amount" },
    { key: "payment_method", label: "Method" },
    { key: "payment_status", label: "Status" },
    { key: "created_at", label: "Date" }
  ],
  formFields: ["student_id", "amount", "payment_method", "payment_reference", "payment_status"],
  requiredFields: ["student_id", "amount", "payment_method", "payment_status"],
  fieldTypes: {
    amount: "number"
  },
  fieldRules: {
    amount: { min: 0.01 }
  },
  fieldOptions: {
    payment_method: ["cash", "bank_transfer", "card", "pos", "mobile_money"],
    payment_status: ["pending", "paid", "failed", "refunded"]
  },
  permissions: {
    create: ["ceo", "admin", "executive", "finance"],
    edit: ["ceo", "admin", "executive", "finance"],
    delete: ["ceo", "admin", "executive"]
  },
  softDelete: true,
  softDeleteField: "payment_status",
  softDeleteValue: "refunded",
  softRestoreValue: "pending",
  lookups: {
    student_id: {
      table: "students",
      preferProfileName: true,
      labelResolver: (row, context = {}) => {
        const studentNo = String(row?.student_no || row?.admission_number || "").trim();
        const suffix = studentNo ? ` (${studentNo})` : "";
        return `${context.profileName || "Student"}${suffix}`.trim();
      }
    }
  }
});

window.FinanceModule = FinanceModule;
