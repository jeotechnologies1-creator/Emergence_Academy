const FinanceOfficeModule = window.OfficeModuleEngine.create({
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
  fieldTypes: { amount: "number" },
  fieldRules: { amount: { min: 0.01 } },
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
    student_id: { table: "students", preferProfileName: true }
  }
});

class ParentPaymentsModule {
  static state = { container: null, profile: null, students: [], payments: [], plans: [] };
  static RECEIPT_BUCKET = "payment-receipts";
  static safe(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
  static studentLabel(student) {
    const name = `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() || "Student";
    const studentId = String(student.student_no || student.admission_number || "").trim();
    return studentId ? `${name} (${studentId})` : name;
  }
  static money(value) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(value || 0)); }
  static async load() {
    this.state.profile = await Auth.profile(true);
    const { data: parent, error: parentError } = await API.db.from("parents").select("id").eq("profile_id", this.state.profile.id).maybeSingle();
    if (parentError) throw parentError;
    if (!parent?.id) throw new Error("Your parent account has not been linked to a child yet. Please contact the school administrator.");
    const { data: links, error: linksError } = await API.db.from("parent_students").select("student_id").eq("parent_id", parent.id);
    if (linksError) throw linksError;
    const linkedStudentIds = [...new Set((links || []).map((link) => String(link.student_id)).filter(Boolean))];
    const [studentsResult, paymentsResult, plansResult] = await Promise.all([
      linkedStudentIds.length ? API.db.from("students").select("id,student_no,admission_number,profiles:profile_id(first_name,last_name)").in("id", linkedStudentIds).order("student_no") : Promise.resolve({ data: [], error: null }),
      API.db.from("payments").select("id,student_id,amount,payment_method,payment_reference,payment_status,receipt_path,created_at").order("created_at", { ascending: false }),
      API.db.from("student_payment_plans").select("student_id,title,amount_due,due_date,is_active").eq("is_active", true)
    ]);
    if (studentsResult.error) throw studentsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (plansResult.error) throw plansResult.error;
    this.state.students = studentsResult.data || [];
    this.state.payments = paymentsResult.data || [];
    this.state.plans = plansResult.data || [];
  }
  static submittedTotal(studentId) { return this.state.payments.filter((payment) => String(payment.student_id) === String(studentId) && ["pending", "paid"].includes(String(payment.payment_status || "").toLowerCase())).reduce((total, payment) => total + Number(payment.amount || 0), 0); }
  static template() {
    const students = this.state.students;
    const names = Object.fromEntries(students.map((student) => [student.id, this.studentLabel(student)]));
    const plans = this.state.plans.map((plan) => {
      const submitted = this.submittedTotal(plan.student_id), balance = Math.max(0, Number(plan.amount_due || 0) - submitted);
      return `<article class="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p class="font-semibold text-emerald-950">${this.safe(names[plan.student_id] || "Student")}</p><p class="mt-1 text-sm text-emerald-800">${this.safe(plan.title)}</p><dl class="mt-3 grid grid-cols-3 gap-3 text-sm"><div><dt class="text-emerald-700">Required</dt><dd class="font-semibold">${this.safe(this.money(plan.amount_due))}</dd></div><div><dt class="text-emerald-700">Submitted</dt><dd class="font-semibold">${this.safe(this.money(submitted))}</dd></div><div><dt class="text-emerald-700">Balance</dt><dd class="font-semibold">${this.safe(this.money(balance))}</dd></div></dl><p class="mt-3 text-sm text-emerald-800">Payment deadline: <strong>${this.safe(new Date(`${plan.due_date}T00:00:00`).toLocaleDateString())}</strong></p></article>`;
    }).join("") || '<p class="text-slate-500">Finance has not set a payment amount or deadline for your linked children yet.</p>';
    return `<div class="space-y-6"><div class="rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-600 p-6 text-white shadow"><h2 class="text-3xl font-bold">Make a Payment</h2><p class="mt-2 text-emerald-100">Choose your enrolled child, payment method, and upload the bank, OPay, or PalmPay receipt for review.</p></div><section class="grid gap-4 md:grid-cols-2">${plans}</section>
      <section class="rounded-xl bg-white p-5 shadow"><form id="parent-payment-form" class="grid grid-cols-1 gap-4 md:grid-cols-2"><label class="md:col-span-2"><span class="text-sm font-medium text-slate-700">Linked child *</span><select required name="student_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Choose a linked child</option>${students.map((student) => `<option value="${this.safe(student.id)}">${this.safe(this.studentLabel(student))}</option>`).join("")}</select><span class="mt-1 block text-xs text-slate-500">${students.length ? `${students.length} linked child${students.length === 1 ? "" : "ren"} available for payment.` : "No children are linked to this parent account."}</span></label><label><span class="text-sm font-medium text-slate-700">Amount (₦) *</span><input required name="amount" type="number" min="0.01" step="0.01" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="0.00"></label><label><span class="text-sm font-medium text-slate-700">Payment method *</span><select required name="payment_method" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Choose a method</option><option value="bank_transfer">Bank transfer</option><option value="opay">OPay</option><option value="palmpay">PalmPay</option></select></label><label class="md:col-span-2"><span class="text-sm font-medium text-slate-700">Reference / purpose</span><input name="payment_reference" maxlength="120" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Transfer reference or fee description"></label><label class="md:col-span-2"><span class="text-sm font-medium text-slate-700">Receipt (PDF or image) *</span><input required name="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" class="mt-1 block w-full text-sm"><span class="mt-1 block text-xs text-slate-500">Accepted: PDF, JPG, PNG, or WebP. Maximum file size: 5 MB.</span></label><div id="parent-payment-error" class="hidden md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div><div class="md:col-span-2 flex justify-end border-t border-slate-100 pt-4"><button id="parent-payment-submit" type="submit" disabled aria-disabled="true" class="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Complete required fields</button></div></form></section>
      <section class="rounded-xl bg-white p-5 shadow"><h3 class="text-lg font-bold text-slate-800">Your payment submissions</h3><div class="mt-4 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b text-left text-slate-600"><th class="p-2">Student</th><th class="p-2">Amount</th><th class="p-2">Method</th><th class="p-2">Status</th><th class="p-2">Date</th><th class="p-2">Receipt</th></tr></thead><tbody>${this.state.payments.length ? this.state.payments.map((payment) => `<tr class="border-b border-slate-100"><td class="p-2">${this.safe(names[payment.student_id] || "Student")}</td><td class="p-2">${this.safe(this.money(payment.amount))}</td><td class="p-2">${this.safe(String(payment.payment_method || "").replace(/_/g, " "))}</td><td class="p-2 capitalize">${this.safe(payment.payment_status || "pending")}</td><td class="p-2">${this.safe(payment.created_at ? new Date(payment.created_at).toLocaleDateString() : "—")}</td><td class="p-2">${payment.receipt_path ? `<button data-receipt-path="${this.safe(payment.receipt_path)}" class="text-blue-600 hover:text-blue-700">View</button>` : "—"}</td></tr>`).join("") : `<tr><td colspan="6" class="p-6 text-center text-slate-500">No payment submissions yet.</td></tr>`}</tbody></table></div></section></div>`;
  }
  static showError(message) { const box = this.state.container?.querySelector("#parent-payment-error"); if (box) { box.textContent = message; box.classList.remove("hidden"); } }
  static async render(container) { this.state.container = container; container.innerHTML = '<div class="rounded-xl bg-white p-8 text-slate-500 shadow">Loading payment options…</div>'; try { await this.load(); container.innerHTML = this.template(); this.bind(); } catch (error) { console.error(error); container.innerHTML = `<div class="rounded-xl bg-white p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load payment options.")}</div>`; } }
  static async submit(form) {
    const data = new FormData(form); const file = data.get("receipt"); const studentId = String(data.get("student_id") || ""); const amount = Number(data.get("amount")); const method = String(data.get("payment_method") || "");
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!this.state.students.some((student) => String(student.id) === studentId)) throw new Error("Choose one of your enrolled students.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid payment amount.");
    if (!["bank_transfer", "opay", "palmpay"].includes(method)) throw new Error("Choose Bank transfer, OPay, or PalmPay.");
    if (!(file instanceof File) || !file.size) throw new Error("Attach a payment receipt.");
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Receipt must be a PDF, JPG, PNG, or WebP no larger than 5 MB.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${this.state.profile.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await API.db.storage.from(this.RECEIPT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: paymentError } = await API.db.from("payments").insert({ student_id: studentId, amount, payment_method: method, payment_reference: String(data.get("payment_reference") || "").trim() || null, payment_status: "pending", receipt_path: path, submitted_by: this.state.profile.id, submitted_at: new Date().toISOString() });
    if (paymentError) { await API.db.storage.from(this.RECEIPT_BUCKET).remove([path]); throw paymentError; }
  }
  static updateSubmitState(form) {
    const button = form?.querySelector("#parent-payment-submit");
    if (!button) return;
    const ready = form.checkValidity();
    button.disabled = !ready;
    button.setAttribute("aria-disabled", String(!ready));
    button.textContent = ready ? "Make Payment" : "Complete required fields";
  }
  static bind() {
    const form = this.state.container.querySelector("#parent-payment-form");
    form?.querySelectorAll("input, select").forEach((field) => {
      field.addEventListener("input", () => this.updateSubmitState(form));
      field.addEventListener("change", () => this.updateSubmitState(form));
    });
    this.updateSubmitState(form);
    form?.addEventListener("submit", async (event) => { event.preventDefault(); if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); return; } const button = event.currentTarget.querySelector("#parent-payment-submit"); button.disabled = true; button.setAttribute("aria-disabled", "true"); try { await this.submit(event.currentTarget); window.Utils?.success?.("Payment submitted. It will remain pending until finance verifies the receipt."); await this.render(this.state.container); } catch (error) { this.showError(error.message || "Unable to submit payment."); this.updateSubmitState(event.currentTarget); } });
    this.state.container.querySelectorAll("[data-receipt-path]").forEach((button) => button.addEventListener("click", async () => { const { data, error } = await API.db.storage.from(this.RECEIPT_BUCKET).createSignedUrl(button.dataset.receiptPath, 60); if (error || !data?.signedUrl) return this.showError(error?.message || "Unable to open receipt."); window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }));
  }
}

class FinanceAdminModule {
  static state = { container: null, profile: null, students: [], plans: [], payments: [] };
  static safe(value) { return ParentPaymentsModule.safe(value); }
  static money(value) { return ParentPaymentsModule.money(value); }
  static studentLabel(student) { return ParentPaymentsModule.studentLabel(student); }
  static submittedTotal(studentId) { return this.state.payments.filter((payment) => String(payment.student_id) === String(studentId) && ["pending", "paid"].includes(String(payment.payment_status || "").toLowerCase())).reduce((total, payment) => total + Number(payment.amount || 0), 0); }
  static async load() {
    this.state.profile = await Auth.profile(true);
    const [studentsResult, plansResult, paymentsResult] = await Promise.all([
      API.db.from("students").select("id,student_no,admission_number,profiles:profile_id(first_name,last_name)").order("student_no"),
      API.db.from("student_payment_plans").select("id,student_id,title,amount_due,due_date,is_active").order("due_date"),
      API.db.from("payments").select("id,student_id,amount,payment_method,payment_reference,payment_status,receipt_path,created_at").order("created_at", { ascending: false })
    ]);
    if (studentsResult.error || plansResult.error || paymentsResult.error) throw studentsResult.error || plansResult.error || paymentsResult.error;
    this.state.students = studentsResult.data || []; this.state.plans = plansResult.data || []; this.state.payments = paymentsResult.data || [];
  }
  static template() {
    const names = Object.fromEntries(this.state.students.map((student) => [student.id, this.studentLabel(student)]));
    const plans = this.state.plans.map((plan) => { const submitted = this.submittedTotal(plan.student_id), balance = Math.max(0, Number(plan.amount_due) - submitted); return `<tr class="border-b border-slate-100"><td class="p-2">${this.safe(names[plan.student_id] || "Student")}</td><td class="p-2">${this.safe(plan.title)}</td><td class="p-2">${this.safe(this.money(plan.amount_due))}</td><td class="p-2">${this.safe(this.money(submitted))}</td><td class="p-2 font-medium">${this.safe(this.money(balance))}</td><td class="p-2">${this.safe(new Date(`${plan.due_date}T00:00:00`).toLocaleDateString())}</td></tr>`; }).join("") || '<tr><td colspan="6" class="p-6 text-center text-slate-500">No payment plans have been set.</td></tr>';
    const payments = this.state.payments.map((payment) => `<tr class="border-b border-slate-100"><td class="p-2">${this.safe(names[payment.student_id] || "Student")}</td><td class="p-2">${this.safe(this.money(payment.amount))}</td><td class="p-2 capitalize">${this.safe(String(payment.payment_method || "").replace(/_/g, " "))}</td><td class="p-2 capitalize">${this.safe(payment.payment_status || "pending")}</td><td class="p-2">${this.safe(payment.created_at ? new Date(payment.created_at).toLocaleDateString() : "—")}</td><td class="p-2">${String(payment.payment_status).toLowerCase() === "pending" ? `<button data-payment-status="paid" data-payment-id="${this.safe(payment.id)}" class="mr-2 text-emerald-700 hover:underline">Confirm</button><button data-payment-status="failed" data-payment-id="${this.safe(payment.id)}" class="text-red-700 hover:underline">Reject</button>` : "—"}</td></tr>`).join("") || '<tr><td colspan="6" class="p-6 text-center text-slate-500">No parent payment submissions yet.</td></tr>';
    return `<div class="space-y-6"><div class="rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-600 p-6 text-white shadow"><h2 class="text-3xl font-bold">Finance</h2><p class="mt-2 text-emerald-100">Set each student’s payment amount and deadline, then reconcile parent submissions.</p></div><section class="rounded-xl bg-white p-5 shadow"><h3 class="text-lg font-bold text-slate-800">Set or update a student payment plan</h3><form id="payment-plan-form" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><label class="md:col-span-2"><span class="text-sm font-medium">Student *</span><select required name="student_id" class="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="">Select student</option>${this.state.students.map((student) => `<option value="${this.safe(student.id)}">${this.safe(this.studentLabel(student))}</option>`).join("")}</select></label><label><span class="text-sm font-medium">Payment title *</span><input required name="title" value="School fees" maxlength="100" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label><label><span class="text-sm font-medium">Required amount (₦) *</span><input required name="amount_due" type="number" min="0.01" step="0.01" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label><label><span class="text-sm font-medium">Payment deadline *</span><input required name="due_date" type="date" class="mt-1 w-full rounded-lg border px-3 py-2.5"></label><div class="flex items-end"><button class="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700">Save payment plan</button></div><div id="payment-plan-error" class="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"></div></form></section><section class="rounded-xl bg-white p-5 shadow"><h3 class="text-lg font-bold text-slate-800">Student payment plans</h3><div class="mt-4 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b text-left text-slate-600"><th class="p-2">Student</th><th class="p-2">Plan</th><th class="p-2">Required</th><th class="p-2">Submitted</th><th class="p-2">Balance</th><th class="p-2">Deadline</th></tr></thead><tbody>${plans}</tbody></table></div></section><section class="rounded-xl bg-white p-5 shadow"><h3 class="text-lg font-bold text-slate-800">Parent payment submissions</h3><div class="mt-4 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b text-left text-slate-600"><th class="p-2">Student</th><th class="p-2">Amount</th><th class="p-2">Method</th><th class="p-2">Status</th><th class="p-2">Date</th><th class="p-2">Action</th></tr></thead><tbody>${payments}</tbody></table></div></section></div>`;
  }
  static showError(message) { const box = this.state.container?.querySelector("#payment-plan-error"); if (box) { box.textContent = message; box.classList.remove("hidden"); } }
  static bind() {
    const submissionSection = [...this.state.container.querySelectorAll("section")].find((section) => section.querySelector("h3")?.textContent === "Parent payment submissions");
    const submissionTable = submissionSection?.querySelector("table");
    if (submissionTable) {
      submissionTable.querySelector("thead tr")?.insertAdjacentHTML("beforeend", '<th class="p-2">Receipt</th>');
      const rows = [...submissionTable.querySelectorAll("tbody tr")];
      if (this.state.payments.length) {
        rows.forEach((row, index) => {
          const payment = this.state.payments[index];
          const cell = document.createElement("td");
          cell.className = "p-2";
          cell.innerHTML = payment?.receipt_path ? `<button data-finance-receipt-path="${this.safe(payment.receipt_path)}" class="text-blue-700 hover:underline">View receipt</button>` : "—";
          row.appendChild(cell);
        });
      } else {
        submissionTable.querySelector("tbody td[colspan]")?.setAttribute("colspan", "7");
      }
    }
    const planForm = this.state.container.querySelector("#payment-plan-form");
    const planButton = planForm?.querySelector("button");
    if (planButton) {
      planButton.type = "submit";
      planButton.id = "payment-plan-submit";
      planButton.className = "inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2";
      planButton.parentElement?.classList.add("md:col-span-2", "justify-end", "border-t", "border-slate-100", "pt-4");
    }
    planForm?.addEventListener("submit", async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const amountDue = Number(data.get("amount_due"));
      try {
        if (!Number.isFinite(amountDue) || amountDue <= 0) throw new Error("Enter a valid required amount.");
        const { error } = await API.db.from("student_payment_plans").upsert({ student_id: String(data.get("student_id") || ""), title: String(data.get("title") || "").trim(), amount_due: amountDue, due_date: String(data.get("due_date") || ""), is_active: true, created_by: this.state.profile.id, updated_at: new Date().toISOString() }, { onConflict: "student_id" });
        if (error) throw error; window.Utils?.success?.("Payment plan saved."); await this.render(this.state.container);
      } catch (error) { this.showError(error.message || "Unable to save payment plan."); }
    });
    this.state.container.querySelectorAll("[data-payment-status]").forEach((button) => button.addEventListener("click", async () => {
      try { const { error } = await API.db.from("payments").update({ payment_status: button.dataset.paymentStatus }).eq("id", button.dataset.paymentId); if (error) throw error; window.Utils?.success?.("Payment status updated."); await this.render(this.state.container); } catch (error) { this.showError(error.message || "Unable to update payment."); }
    }));
    this.state.container.querySelectorAll("[data-finance-receipt-path]").forEach((button) => button.addEventListener("click", async () => {
      const { data, error } = await API.db.storage.from(ParentPaymentsModule.RECEIPT_BUCKET).createSignedUrl(button.dataset.financeReceiptPath, 60);
      if (error || !data?.signedUrl) return this.showError(error?.message || "Unable to open receipt.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }));
  }
  static async render(container) { this.state.container = container; container.innerHTML = '<div class="rounded-xl bg-white p-8 text-slate-500 shadow">Loading finance records…</div>'; try { await this.load(); container.innerHTML = this.template(); this.bind(); } catch (error) { console.error(error); container.innerHTML = `<div class="rounded-xl bg-white p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load finance records.")}</div>`; } }
}

class FinanceModule {
  static async render(container) {
    const profile = await Auth.profile(true);
    return String(profile?.role || "").toLowerCase() === "parent"
      ? ParentPaymentsModule.render(container)
      : FinanceAdminModule.render(container);
  }
}

window.FinanceModule = FinanceModule;
