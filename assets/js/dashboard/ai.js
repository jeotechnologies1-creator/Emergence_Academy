class AIModule {
  static HISTORY_PREFIX = "emergence_ai_assistant_history";
  static MAX_HISTORY = 12;

  static safe(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  static storageKey(profile) {
    return `${this.HISTORY_PREFIX}:${profile?.id || "current"}`;
  }

  static history(profile) {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey(profile)) || "[]");
      return Array.isArray(saved)
        ? saved.filter((message) => ["user", "assistant"].includes(message?.role) && typeof message?.content === "string").slice(-this.MAX_HISTORY)
        : [];
    } catch {
      return [];
    }
  }

  static saveHistory(profile, messages) {
    localStorage.setItem(this.storageKey(profile), JSON.stringify(messages.slice(-this.MAX_HISTORY)));
  }

  static message(message) {
    const role = message.role === "assistant" ? "assistant" : "user";
    const label = role === "assistant" ? "Emergence AI" : "You";
    const classes = role === "assistant"
      ? "border-blue-100 bg-blue-50 text-slate-800"
      : "border-slate-200 bg-white text-slate-800";
    return `<article class="max-w-3xl ${role === "user" ? "ml-auto" : ""} rounded-lg border ${classes} px-4 py-3"><div class="mb-1 text-xs font-semibold text-slate-500">${label}</div><p class="whitespace-pre-wrap break-words text-sm leading-6">${this.safe(message.content)}</p></article>`;
  }

  static template(profile) {
    const firstName = this.safe(profile?.first_name || "there");
    const role = this.safe(String(profile?.role || "student").toLowerCase());
    return `
<div class="space-y-5">
  <section class="bg-white rounded-lg shadow p-6">
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><i class="ph ph-robot text-xl" aria-hidden="true"></i></div>
      <div><h2 class="text-2xl font-bold text-slate-800">AI Assistant</h2><p class="mt-1 text-sm text-slate-600">Hello ${firstName}. Ask a question about your learning or teaching work.</p></div>
    </div>
  </section>

  <section class="bg-white rounded-lg shadow">
    <div id="aiMessages" class="min-h-80 space-y-3 overflow-y-auto p-5" aria-live="polite"></div>
    <form id="aiChatForm" class="border-t border-slate-200 p-4">
      <label for="aiPrompt" class="sr-only">Message AI Assistant</label>
      <textarea id="aiPrompt" rows="3" maxlength="3000" required class="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Type your question here"></textarea>
      <div class="mt-3 flex items-center justify-between gap-3">
        <span class="text-xs text-slate-500">Signed in as ${role}</span>
        <div class="flex items-center gap-2">
          <button id="aiClear" type="button" title="Clear conversation" aria-label="Clear conversation" class="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><i class="ph ph-trash" aria-hidden="true"></i></button>
          <button id="aiSend" type="submit" class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><i class="ph ph-paper-plane-right" aria-hidden="true"></i><span>Send</span></button>
        </div>
      </div>
      <p id="aiError" class="mt-3 hidden rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>
    </form>
  </section>
</div>`;
  }

  static renderMessages(profile, pending = false) {
    const container = document.getElementById("aiMessages");
    if (!container) return;
    const messages = this.history(profile);
    const empty = '<p class="py-12 text-center text-sm text-slate-500">Start a conversation with Emergence AI.</p>';
    container.innerHTML = messages.length ? messages.map((message) => this.message(message)).join("") : empty;
    if (pending) container.insertAdjacentHTML("beforeend", '<div id="aiPending" class="text-sm text-slate-500">Emergence AI is thinking...</div>');
    container.scrollTop = container.scrollHeight;
  }

  static showError(message = "") {
    const error = document.getElementById("aiError");
    if (!error) return;
    error.textContent = message;
    error.classList.toggle("hidden", !message);
  }

  static async render(container) {
    const profile = await Auth.profile(true);
    if (!profile?.id) throw new Error("Your profile is required to use the AI Assistant.");
    container.innerHTML = this.template(profile);
    this.renderMessages(profile);
    this.bindEvents(profile);
  }

  static bindEvents(profile) {
    const form = document.getElementById("aiChatForm");
    const promptInput = document.getElementById("aiPrompt");
    const send = document.getElementById("aiSend");
    const clear = document.getElementById("aiClear");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (send.disabled) return;
      const prompt = String(promptInput?.value || "").trim();
      if (!prompt) return;

      this.showError();
      const messages = [...this.history(profile), { role: "user", content: prompt }].slice(-this.MAX_HISTORY);
      this.saveHistory(profile, messages);
      promptInput.value = "";
      send.disabled = true;
      this.renderMessages(profile, true);

      try {
        const { data, error } = await API.db.functions.invoke("ai-chat", { body: { messages } });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Unable to reach the AI Assistant.");
        const reply = String(data?.reply || "").trim();
        if (!reply) throw new Error("The AI Assistant did not return a response. Please try again.");
        this.saveHistory(profile, [...messages, { role: "assistant", content: reply }]);
      } catch (error) {
        this.saveHistory(profile, this.history(profile).slice(0, -1));
        this.showError(error.message || "Unable to reach the AI Assistant.");
      } finally {
        send.disabled = false;
        this.renderMessages(profile);
        promptInput.focus();
      }
    });

    clear?.addEventListener("click", () => {
      localStorage.removeItem(this.storageKey(profile));
      this.showError();
      this.renderMessages(profile);
      promptInput?.focus();
    });
  }
}

window.AIModule = AIModule;
