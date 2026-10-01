class AIModule {
  static HISTORY_PREFIX = "emergence_ai_assistant_history";
  static MAX_HISTORY = 12;
  static MAX_CHATS = 50;
  static showingHistory = false;

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

  static activeChatKey(profile) {
    return `${this.storageKey(profile)}:active`;
  }

  static newChatId() {
    return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  static chats(profile) {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey(profile)) || "[]");
      if (!Array.isArray(saved)) return [];

      // Upgrade the previous single-conversation format without losing it.
      if (saved.length && saved.every((item) => ["user", "assistant"].includes(item?.role))) {
        const messages = saved.filter((item) => typeof item.content === "string").slice(-this.MAX_HISTORY);
        const chat = {
          id: this.newChatId(),
          title: messages.find((item) => item.role === "user")?.content.slice(0, 60) || "Previous chat",
          messages,
          updatedAt: Date.now(),
        };
        this.saveChats(profile, [chat]);
        localStorage.setItem(this.activeChatKey(profile), chat.id);
        return [chat];
      }

      return saved.filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages))
        .map((chat) => ({
          id: chat.id,
          title: typeof chat.title === "string" ? chat.title : "Previous chat",
          messages: chat.messages.filter((item) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string").slice(-this.MAX_HISTORY),
          updatedAt: Number(chat.updatedAt) || Date.now(),
        })).slice(-this.MAX_CHATS);
    } catch {
      return [];
    }
  }

  static saveChats(profile, chats) {
    localStorage.setItem(this.storageKey(profile), JSON.stringify(chats.slice(-this.MAX_CHATS)));
  }

  static activeChat(profile) {
    const chats = this.chats(profile);
    const activeId = localStorage.getItem(this.activeChatKey(profile));
    const active = chats.find((chat) => chat.id === activeId) || chats[chats.length - 1];
    if (active) {
      localStorage.setItem(this.activeChatKey(profile), active.id);
      return active;
    }
    const chat = { id: this.newChatId(), title: "New chat", messages: [], updatedAt: Date.now() };
    this.saveChats(profile, [chat]);
    localStorage.setItem(this.activeChatKey(profile), chat.id);
    return chat;
  }

  static history(profile) {
    return this.activeChat(profile).messages;
  }

  static saveHistory(profile, messages, chatId = this.activeChat(profile).id) {
    const chats = this.chats(profile);
    const chat = chats.find((item) => item.id === chatId) || {
      id: chatId, title: "New chat", messages: [], updatedAt: Date.now(),
    };
    chat.messages = messages.slice(-this.MAX_HISTORY);
    chat.title = chat.messages.find((item) => item.role === "user")?.content.slice(0, 60) || "New chat";
    chat.updatedAt = Date.now();
    this.saveChats(profile, [...chats.filter((item) => item.id !== chatId), chat]);
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
          <button id="aiNewChat" type="button" class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><i class="ph ph-plus" aria-hidden="true"></i><span>New chat</span></button>
          <button id="aiChatHistory" type="button" class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" aria-label="View previous chats"><i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i><span>Chat history</span></button>
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
    if (this.showingHistory) {
      this.renderChatHistory(profile, container);
      return;
    }
    const messages = this.history(profile);
    const empty = '<p class="py-12 text-center text-sm text-slate-500">Start a conversation with Emergence AI.</p>';
    container.innerHTML = messages.length ? messages.map((message) => this.message(message)).join("") : empty;
    if (pending) container.insertAdjacentHTML("beforeend", '<div id="aiPending" class="text-sm text-slate-500">Emergence AI is thinking...</div>');
    container.scrollTop = container.scrollHeight;
  }

  static renderChatHistory(profile, container) {
    const previousChats = this.chats(profile).filter((chat) => chat.messages.length)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const list = previousChats.length
      ? previousChats.map((chat) => {
        const preview = chat.messages[chat.messages.length - 1]?.content || "";
        const timestamp = new Date(chat.updatedAt).toLocaleString();
        return `<button type="button" data-ai-open-chat="${this.safe(chat.id)}" class="w-full rounded-lg border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50"><span class="block truncate text-sm font-semibold text-slate-800">${this.safe(chat.title)}</span><span class="mt-1 block truncate text-sm text-slate-600">${this.safe(preview)}</span><span class="mt-2 block text-xs text-slate-500">${this.safe(timestamp)}</span></button>`;
      }).join("")
      : '<p class="py-12 text-center text-sm text-slate-500">Your previous chats will appear here.</p>';
    container.innerHTML = `<div class="space-y-3"><h3 class="text-sm font-semibold text-slate-700">Previous chats</h3>${list}</div>`;
    container.scrollTop = 0;
  }

  static showError(message = "") {
    const error = document.getElementById("aiError");
    if (!error) return;
    error.textContent = message;
    error.classList.toggle("hidden", !message);
  }

  static requestErrorMessage(error) {
    const message = String(error?.message || "");
    if (/failed to send a request to the edge function/i.test(message)) {
      return "AI Assistant is not available yet. An administrator must deploy the ai-chat service and configure its Ollama connection.";
    }
    return message || "Unable to reach the AI Assistant.";
  }

  static async render(container) {
    const profile = await Auth.profile(true);
    if (!profile?.id) throw new Error("Your profile is required to use the AI Assistant.");
    this.showingHistory = false;
    this.activeChat(profile);
    container.innerHTML = this.template(profile);
    this.renderMessages(profile);
    this.bindEvents(profile);
  }

  static bindEvents(profile) {
    const form = document.getElementById("aiChatForm");
    const promptInput = document.getElementById("aiPrompt");
    const send = document.getElementById("aiSend");
    const newChat = document.getElementById("aiNewChat");
    const historyButton = document.getElementById("aiChatHistory");
    const messageContainer = document.getElementById("aiMessages");

    promptInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      form?.requestSubmit();
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (send.disabled) return;
      const prompt = String(promptInput?.value || "").trim();
      if (!prompt) return;

      this.showError();
      const chatId = this.activeChat(profile).id;
      const previousMessages = this.history(profile);
      const messages = [...previousMessages, { role: "user", content: prompt }].slice(-this.MAX_HISTORY);
      this.saveHistory(profile, messages, chatId);
      promptInput.value = "";
      send.disabled = true;
      this.renderMessages(profile, true);

      try {
        const { data, error } = await API.db.functions.invoke("ai-chat", { body: { messages } });
        if (error) {
          const message = typeof API.functionErrorMessage === "function"
            ? await API.functionErrorMessage(error, "Unable to reach the AI Assistant.")
            : error.message;
          throw new Error(message || "Unable to reach the AI Assistant.");
        }
        if (data?.error) throw new Error(data.error);
        const reply = String(data?.reply || "").trim();
        if (!reply) throw new Error("The AI Assistant did not return a response. Please try again.");
        this.saveHistory(profile, [...messages, { role: "assistant", content: reply }], chatId);
      } catch (error) {
        this.saveHistory(profile, previousMessages, chatId);
        this.showError(this.requestErrorMessage(error));
      } finally {
        send.disabled = false;
        this.renderMessages(profile);
        promptInput.focus();
      }
    });

    newChat?.addEventListener("click", () => {
      const chats = this.chats(profile);
      const chat = { id: this.newChatId(), title: "New chat", messages: [], updatedAt: Date.now() };
      this.saveChats(profile, [...chats, chat]);
      localStorage.setItem(this.activeChatKey(profile), chat.id);
      this.showingHistory = false;
      this.showError();
      this.renderMessages(profile);
      promptInput?.focus();
    });

    historyButton?.addEventListener("click", () => {
      this.showingHistory = !this.showingHistory;
      historyButton.querySelector("span").textContent = this.showingHistory ? "Back to chat" : "Chat history";
      historyButton.setAttribute("aria-label", this.showingHistory ? "Return to current chat" : "View previous chats");
      this.renderMessages(profile);
    });

    messageContainer?.addEventListener("click", (event) => {
      const chatButton = event.target.closest?.("[data-ai-open-chat]");
      if (!chatButton) return;
      localStorage.setItem(this.activeChatKey(profile), chatButton.dataset.aiOpenChat);
      this.showingHistory = false;
      historyButton.querySelector("span").textContent = "Chat history";
      historyButton.setAttribute("aria-label", "View previous chats");
      this.renderMessages(profile);
    });
  }
}

window.AIModule = AIModule;
