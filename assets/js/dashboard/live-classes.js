/* Agora live classes. Session access is authorized by the Edge Function before joining. */
class LiveClassesModule {
  static state = { container: null, profile: null, teacher: null, subjects: [], classes: [], assignments: [], students: [], sessions: [] };
  static MAX_VISIBLE_VIDEO_PARTICIPANTS = 6;
  static liveNotificationTimer = null;
  static safe(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  static role() { return String(this.state.profile?.role || "").toLowerCase(); }
  static canSchedule() { return this.role() === "teacher"; }
  static async load() {
    const profile = await Auth.profile(true);
    if (!profile?.id) throw new Error("Your profile is required to access live classes.");
    this.state.profile = profile;
    const [result, options] = await Promise.all([
      API.db.rpc("get_live_classes"),
      this.canSchedule() ? API.db.functions.invoke("live-class-options", { body: {} }) : Promise.resolve({ data: null, error: null })
    ]);
    if (result.error) throw result.error;
    if (options.error || options.data?.error) throw new Error(options.data?.error || options.error?.message);
    this.state.teacher = options.data?.teacher || null;
    this.state.subjects = options.data?.subjects || []; this.state.classes = options.data?.classes || [];
    this.state.assignments = options.data?.assignments || []; this.state.students = options.data?.students || [];
    this.state.sessions = (result.data || []).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    this.watchStudentLiveClassNotifications();
  }
  static assignmentSubjects() { const ids = new Set(this.state.assignments.filter((row) => String(row.teacher_id) === String(this.state.teacher?.id)).map((row) => String(row.subject_id))); return this.state.subjects.filter((row) => ids.has(String(row.id))); }
  static assignmentClasses() { const ids = new Set(this.state.assignments.filter((row) => String(row.teacher_id) === String(this.state.teacher?.id)).map((row) => String(row.class_id))); return this.state.classes.filter((row) => ids.has(String(row.id))); }
  static format(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unscheduled" : date.toLocaleString(); }
  static getAgoraConfig() {
    const config = window.CONFIG?.AGORA || {};
    return {
      appId: String(config.APP_ID || window.AGORA_APP_ID || "").trim(),
      channelPrefix: String(config.CHANNEL_PREFIX || "emergence-live-class").trim() || "emergence-live-class"
    };
  }
  static async requestAgoraToken(channelName, uid = 0, liveClassId = null, role = "join") {
    const route = role === "create" ? "agora-create-room" : "agora-join-room";
    const payload = { channel_name: channelName, uid };
    if (liveClassId) payload.live_class_id = liveClassId;
    const { data, error } = await API.db.functions.invoke(route, {
      body: payload
    });
    if (error || data?.error) {
      const message = data?.error || await API.functionErrorMessage(
        error,
        "Unable to generate an Agora token."
      );
      throw new Error(message);
    }
    if (!data?.token) {
      throw new Error("Agora token generation returned no token.");
    }
    return data;
  }
  static async authorizeLiveClassJoin(liveClassId) {
    const { data, error } = await API.db.functions.invoke("join-live-class", {
      body: { live_class_id: liveClassId }
    });
    if (error || data?.error) {
      throw new Error(data?.error || await API.functionErrorMessage(
        error,
        "Unable to join the live class."
      ));
    }
    return data;
  }
  static async ensureAgoraSDK() {
    if (window.AgoraRTC) return;
    const existing = document.querySelector("script[data-agora-sdk='true']");
    if (existing) existing.remove();
    const sources = [
      "https://download.agora.io/sdk/release/AgoraRTC_N-4.24.8.js",
      "https://unpkg.com/agora-rtc-sdk-ng@4.24.8/AgoraRTC_N-production.js",
      "https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.24.8/AgoraRTC_N-production.js"
    ];
    let lastError = null;
    for (const source of sources) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          const timeout = window.setTimeout(() => {
            script.remove();
            reject(new Error(`Timed out loading ${source}`));
          }, 15000);
          script.src = source;
          script.async = true;
          script.crossOrigin = "anonymous";
          script.dataset.agoraSdk = "true";
          script.onload = () => {
            window.clearTimeout(timeout);
            window.AgoraRTC ? resolve() : reject(new Error(`AgoraRTC was not exposed by ${source}`));
          };
          script.onerror = () => {
            window.clearTimeout(timeout);
            script.remove();
            reject(new Error(`Unable to load ${source}`));
          };
          document.head.appendChild(script);
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Unable to load the Agora Web SDK. Check that this network permits download.agora.io or unpkg.com, then retry. ${lastError?.message || ""}`.trim());
  }
  static sanitizeChannelName(value) {
    const cleaned = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return cleaned || "emergence-live-class";
  }
  static agoraUid(session) {
    // Agora numeric UIDs must fit in an unsigned 32-bit integer. Converting
    // the digits in a UUID directly can exceed that limit and invalidate an
    // otherwise correctly issued Edge Function token. Include the profile ID
    // and a per-connection nonce: a deterministic class/user UID conflicts
    // when that user reconnects before Agora has released the old session.
    const sessionId = session?.id || session?.agora_channel_name || Date.now();
    const userId = this.state.profile?.id || "anonymous";
    const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const source = `${sessionId}:${userId}:${nonce}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
  }
  static addChatMessage(modal, message, own = false) {
    const list = modal?.querySelector("[data-agora-chat-messages]");
    if (!list || !message?.text) return;
    const row = document.createElement("article");
    row.className = `agora-chat-message ${own ? "agora-chat-message-own" : ""}`;
    row.innerHTML = `<p class="agora-chat-author">${this.safe(message.author || "Participant")}</p><p class="agora-chat-text">${this.safe(message.text)}</p>`;
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }
  static participantLabel(uid) { return `Participant ${String(uid).slice(-4)}`; }
  static renderVideoGallery(modal) {
    if (!modal || modal.classList.contains("agora-screen-sharing")) return;
    const primary = modal.querySelector("#agora-primary-player");
    const gallery = modal.querySelector("[data-agora-remote-grid]");
    const overflow = modal.querySelector("[data-agora-overflow-count]");
    const remoteVideos = [...(modal.__remoteVideos?.values() || [])];
    if (!primary || !gallery) return;
    const active = remoteVideos.find((participant) => String(participant.uid) === String(modal.__activeSpeakerUid)) || remoteVideos[0];
    const galleryVideos = remoteVideos.filter((participant) => participant !== active);
    gallery.innerHTML = "";
    if (active?.videoTrack) {
      primary.replaceChildren();
      active.videoTrack.play(primary);
      modal.dataset.agoraActiveSpeaker = String(active.uid);
    }
    const galleryLimit = Math.max(0, this.MAX_VISIBLE_VIDEO_PARTICIPANTS - 1 - (modal.__hasLocalVideo ? 1 : 0));
    galleryVideos.slice(0, galleryLimit).forEach((participant) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "agora-remote-tile";
      tile.dataset.agoraRemoteUid = String(participant.uid);
      tile.setAttribute("aria-label", `Make ${this.participantLabel(participant.uid)} the main participant`);
      tile.innerHTML = `<span data-agora-video class="agora-video-tile-media"></span><span class="agora-video-tile-name">${this.safe(this.participantLabel(participant.uid))}</span>`;
      tile.addEventListener("click", () => { modal.__activeSpeakerUid = String(participant.uid); this.renderVideoGallery(modal); });
      gallery.appendChild(tile);
      participant.videoTrack?.play(tile.querySelector("[data-agora-video]"));
    });
    const hiddenCount = Math.max(0, galleryVideos.length - galleryLimit);
    if (overflow) {
      overflow.hidden = hiddenCount === 0;
      overflow.textContent = `+${hiddenCount} more participant${hiddenCount === 1 ? "" : "s"}`;
    }
  }
  static openAgoraRoom(session, canPublish, canEndClass = false) {
    // The server stores the authoritative channel when the class is
    // scheduled and authorizes tokens only for that exact value. Never
    // re-sanitize/truncate a stored value here; that made the browser send a
    // different channel to the Edge Function and receive a 403 response.
    const storedChannel = String(session?.agora_channel_name || "").trim();
    const channel = storedChannel || this.sanitizeChannelName(`${this.getAgoraConfig().channelPrefix}-${session?.id || session?.title || "room"}`);
    const modal = document.createElement("div");
    // A live lesson is its own workspace. It deliberately fills the viewport
    // so the dashboard is not competing with the classroom for attention.
    modal.className = "agora-room-modal fixed inset-0 z-[60] bg-slate-950 text-slate-100";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", `Live class: ${session?.title || "Live class"}`);
    modal.innerHTML = `
      <div class="agora-room-dialog flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-950">
        <div class="flex shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-4 text-white">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">Agora live class</p>
            <h3 class="mt-1 text-xl font-bold">${this.safe(session?.title || "Live class")}</h3>
          </div>
          <div class="agora-meeting-summary" aria-live="polite"><span data-agora-participant-count>1 participant</span><span aria-hidden="true">•</span><span data-agora-elapsed>00:00</span></div>
        </div>
        <div data-agora-classroom class="agora-classroom min-h-0 flex-1 p-4 lg:p-5">
          <div class="agora-video-stage relative min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.2),transparent_42%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)] lg:min-h-0">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(96,165,250,0.18),transparent_60%)]"></div>
            <div data-agora-remote-grid class="agora-remote-grid absolute inset-x-0 bottom-0 z-20"></div>
            <div id="agora-primary-player" class="agora-primary-player absolute inset-0" aria-label="Main live video"></div>
            <div class="agora-stage-meta absolute inset-x-0 top-4 flex justify-between px-4">
              <span class="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-100">Live</span>
              <span class="rounded-full border border-white/10 bg-slate-900/50 px-3 py-1 text-xs font-medium text-slate-200">${this.safe(channel)}</span>
            </div>
            <p data-agora-sharing-label class="agora-sharing-label" aria-live="polite">You are sharing your screen</p>
            <span data-agora-overflow-count class="agora-overflow-count" hidden></span>
            ${canPublish ? '<div data-agora-local-preview class="agora-local-preview"><div id="agora-local-player" class="h-full w-full bg-slate-800"></div><button type="button" data-toggle-camera-fill class="agora-preview-expand" aria-pressed="false">Fill stage</button><button type="button" data-agora-preview-resize class="agora-preview-resize" aria-label="Resize camera preview" title="Drag to resize camera preview"></button></div>' : ""}
          </div>
          <aside data-agora-sidebar class="agora-class-sidebar flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-200" aria-label="Class details and chat">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Session</p>
              <p class="mt-2 text-lg font-semibold text-white">${this.safe(session?.subject_name || "Live class")}</p>
              <p class="mt-1 text-sm text-slate-300">${this.safe(this.format(session?.starts_at))} to ${this.safe(this.format(session?.ends_at))}</p>
            </div>
            <div class="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3">
              <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">Agora status</p>
              <p data-agora-status class="mt-2 text-sm text-slate-100">Connecting...</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm text-slate-300">
              <p class="font-medium text-white">Required setup</p>
              <p class="mt-2">Your secure Agora access token and project details are fetched from the backend when you join.</p>
            </div>
            <section class="agora-chat flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <div class="flex items-center justify-between gap-3"><p class="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Class chat</p><span class="text-xs text-slate-400">Live comments</span></div>
              <div data-agora-chat-messages class="agora-chat-messages mt-3 flex-1" aria-live="polite"><p class="text-sm text-slate-400">Chat with everyone in this class.</p></div>
              <form data-agora-chat-form class="mt-3 flex gap-2"><input required maxlength="500" name="message" autocomplete="off" placeholder="Write a comment…" class="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400"><button type="submit" class="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500">Send</button></form>
            </section>
            <p class="mt-auto text-sm text-slate-300">Use the meeting controls below to manage your class.</p>
          </aside>
          <nav class="agora-meeting-toolbar" aria-label="Live class controls">
            ${canPublish ? '<button type="button" data-agora-toggle-mic class="agora-control-button" aria-label="Mute microphone">Mute</button><button type="button" data-agora-toggle-camera class="agora-control-button" aria-label="Turn camera off">Camera off</button><button type="button" data-agora-share-screen class="agora-control-button agora-control-share">Share screen</button>' : ""}
            <button type="button" data-toggle-agora-sidebar aria-expanded="false" class="agora-control-button" aria-label="Open class chat">Chat</button>
            <button type="button" data-close-agora class="agora-control-button agora-control-leave">Leave</button>
            ${canEndClass ? '<button type="button" data-end-agora class="agora-control-button agora-control-end">End class</button>' : ""}
          </nav>
        </div>
      </div>
    `;
    const closeButton = modal.querySelector("[data-close-agora]");
    closeButton?.addEventListener("click", () => this.closeAgoraRoom(modal));
    const sidebarButton = modal.querySelector("[data-toggle-agora-sidebar]");
    sidebarButton?.addEventListener("click", () => {
      const classroom = modal.querySelector("[data-agora-classroom]");
      const isOpen = classroom?.classList.toggle("agora-sidebar-open");
      sidebarButton.setAttribute("aria-expanded", String(Boolean(isOpen)));
      sidebarButton.textContent = isOpen ? "Hide chat" : "Open chat";
      if (isOpen) modal.querySelector("[name=message]")?.focus();
    });
    const preview = modal.querySelector("[data-agora-local-preview]");
    preview?.querySelector("[data-toggle-camera-fill]")?.addEventListener("click", (event) => {
      const expanded = preview.classList.toggle("agora-local-preview-expanded");
      event.currentTarget.setAttribute("aria-pressed", String(expanded));
      event.currentTarget.textContent = expanded ? "Restore size" : "Fill stage";
    });
    preview?.querySelector("[data-agora-preview-resize]")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startX = event.clientX, startY = event.clientY;
      const rect = preview.getBoundingClientRect();
      const startWidth = rect.width, startHeight = rect.height;
      const stage = modal.querySelector(".agora-video-stage");
      const resize = (moveEvent) => {
        const stageRect = stage?.getBoundingClientRect();
        const width = Math.min(Math.max(180, (stageRect?.width || 0) - 24), Math.max(180, startWidth + startX - moveEvent.clientX));
        const height = Math.min(Math.max(120, (stageRect?.height || 0) - 24), Math.max(120, startHeight + startY - moveEvent.clientY));
        preview.classList.remove("agora-local-preview-expanded");
        preview.querySelector("[data-toggle-camera-fill]")?.setAttribute("aria-pressed", "false");
        if (preview.querySelector("[data-toggle-camera-fill]")) preview.querySelector("[data-toggle-camera-fill]").textContent = "Fill stage";
        preview.style.width = `${width}px`;
        preview.style.height = `${height}px`;
      };
      const stop = () => { document.removeEventListener("pointermove", resize); document.removeEventListener("pointerup", stop); };
      document.addEventListener("pointermove", resize);
      document.addEventListener("pointerup", stop, { once: true });
    });
    modal.querySelector("[data-agora-chat-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.message;
      const text = String(input?.value || "").trim();
      if (!text) return;
      const message = { author: `${this.state.profile?.first_name || ""} ${this.state.profile?.last_name || ""}`.trim() || this.state.profile?.email || "Participant", text };
      this.addChatMessage(modal, message, true);
      input.value = "";
      const chat = modal.__agora;
      if (Number.isInteger(chat?.chatStreamId)) {
        chat.client.sendStreamMessage(chat.chatStreamId, new TextEncoder().encode(JSON.stringify(message))).catch((error) => console.error("Unable to send class chat message:", error));
      }
    });
    modal.querySelector("[data-end-agora]")?.addEventListener("click", async (event) => {
      const endButton = event.currentTarget;
      endButton.disabled = true;
      try {
        const { error } = await API.db.rpc("set_live_class_status", { p_live_class_id: session.id, p_status: "ended" });
        if (error) throw error;
        this.closeAgoraRoom(modal);
        window.Utils?.success?.("Class ended.");
        if (this.state.container) await this.render(this.state.container);
      } catch (error) {
        endButton.disabled = false;
        window.Utils?.error?.(error.message || "Unable to end the class.") || window.alert(error.message || "Unable to end the class.");
      }
    });
    modal.dataset.channel = channel;
    modal.__previousBodyOverflow = document.body.style.overflow;
    modal.__previousFocus = document.activeElement;
    modal.__onKeydown = (event) => {
      if (event.key === "Escape") this.closeAgoraRoom(modal);
    };
    document.body.style.overflow = "hidden";
    document.body.classList.add("agora-room-active");
    document.body.appendChild(modal);
    document.addEventListener("keydown", modal.__onKeydown);
    modal.__participantUids = new Set();
    modal.__remoteVideos = new Map();
    const updateParticipantCount = () => {
      const total = modal.__participantUids.size + 1;
      const label = modal.querySelector("[data-agora-participant-count]");
      if (label) label.textContent = `${total} participant${total === 1 ? "" : "s"}`;
    };
    modal.__updateParticipantCount = updateParticipantCount;
    closeButton?.focus();
    return modal;
  }
  static async connectAgoraRoom(session) {
    await this.ensureAgoraSDK();
    const isTeacherHost = this.canSchedule() && String(session?.teacher_id) === String(this.state.teacher?.id);
    const canPublish = isTeacherHost || this.role() === "student";
    const modal = this.openAgoraRoom(session, canPublish, isTeacherHost);
    const client = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    // Store the client immediately so Close can cancel an in-flight token,
    // join, or media-device request without leaving a connection behind.
    modal.__agora = { client };
    const channel = modal.dataset.channel;
    const uid = this.agoraUid(session);
    const status = modal.querySelector("[data-agora-status]");
    status.textContent = "Fetching secure token...";
    let localAudioTrack;
    let localVideoTrack;
    let screenVideoTrack;
    try {
      const tokenResponse = await this.requestAgoraToken(channel, uid, session?.id || null, isTeacherHost ? "create" : "join");
      if (modal.__closed) return null;
      // The token service is the source of truth for the Agora project. Using
      // a browser-configured ID here can pair a valid token with a different
      // project and makes Agora reject the host connection.
      const appId = String(tokenResponse.app_id || this.getAgoraConfig().appId || "").trim();
      if (!appId) throw new Error("Agora did not return an App ID for this class. Check the server configuration.");
      client.enableAudioVolumeIndicator();
      client.on("user-published", async (user, mediaType) => {
        modal.__participantUids?.add(String(user.uid));
        modal.__updateParticipantCount?.();
        await client.subscribe(user, mediaType);
        if (mediaType === "video" && user.videoTrack) {
          modal.__remoteVideos?.set(String(user.uid), { uid: user.uid, videoTrack: user.videoTrack });
          this.renderVideoGallery(modal);
        }
        if (mediaType === "audio" && user.audioTrack) user.audioTrack.play();
      });
      client.on("volume-indicator", (volumes) => {
        const loudest = (volumes || []).filter((entry) => entry.level > 5 && modal.__remoteVideos?.has(String(entry.uid)))
          .sort((a, b) => b.level - a.level)[0];
        if (loudest && String(modal.__activeSpeakerUid) !== String(loudest.uid)) {
          modal.__activeSpeakerUid = String(loudest.uid);
          this.renderVideoGallery(modal);
        }
      });
      client.on("user-joined", (user) => {
        modal.__participantUids?.add(String(user.uid));
        modal.__updateParticipantCount?.();
      });
      client.on("user-left", (user) => {
        modal.__participantUids?.delete(String(user.uid));
        modal.__updateParticipantCount?.();
        modal.__remoteVideos?.delete(String(user.uid));
        if (String(modal.__activeSpeakerUid) === String(user.uid)) modal.__activeSpeakerUid = null;
        this.renderVideoGallery(modal);
        status.textContent = "Remote participant left the room.";
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType !== "video") return;
        modal.__remoteVideos?.delete(String(user.uid));
        if (String(modal.__activeSpeakerUid) === String(user.uid)) modal.__activeSpeakerUid = null;
        this.renderVideoGallery(modal);
      });
      client.on("stream-message", (_uid, _streamId, payload) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload));
          this.addChatMessage(modal, message);
        } catch (error) {
          console.error("Unable to read class chat message:", error);
        }
      });
      await client.join(appId, channel, tokenResponse.token, Number(uid));
      if (modal.__closed) return null;
      try {
        const chatStreamId = await client.createDataStream({ ordered: true, syncWithAudio: false });
        modal.__agora = { client, chatStreamId };
      } catch (error) {
        console.error("Unable to start Agora class chat:", error);
        this.addChatMessage(modal, { author: "Class chat", text: "Live chat is unavailable for this connection." });
      }

      if (tokenResponse.role === "publisher") {
        [localAudioTrack, localVideoTrack] = await window.AgoraRTC.createMicrophoneAndCameraTracks();
        modal.__agora = { ...modal.__agora, client, localAudioTrack, localVideoTrack };
        if (modal.__closed) {
          this.closeAgoraRoom(modal);
          return null;
        }
        if (!localAudioTrack || !localVideoTrack) {
          throw new Error("Agora could not create your microphone and camera tracks.");
        }
        const micButton = modal.querySelector("[data-agora-toggle-mic]");
        const cameraButton = modal.querySelector("[data-agora-toggle-camera]");
        let micEnabled = true;
        let cameraEnabled = true;
        micButton?.addEventListener("click", () => {
          micEnabled = !micEnabled;
          localAudioTrack.setEnabled(micEnabled);
          micButton.textContent = micEnabled ? "Mute" : "Unmute";
        });
        cameraButton?.addEventListener("click", () => {
          cameraEnabled = !cameraEnabled;
          localVideoTrack.setEnabled(cameraEnabled);
          cameraButton.textContent = cameraEnabled ? "Camera off" : "Camera on";
        });
        const screenButton = modal.querySelector("[data-agora-share-screen]");
        const stopScreenShare = async () => {
          if (!screenVideoTrack) return;
          await client.unpublish(screenVideoTrack);
          screenVideoTrack.close();
          screenVideoTrack = null;
          if (localVideoTrack) {
            await client.publish(localVideoTrack);
            localVideoTrack.play("agora-primary-player");
          }
          modal.classList.remove("agora-screen-sharing");
          this.renderVideoGallery(modal);
          modal.__agora = { ...modal.__agora, screenVideoTrack };
          if (screenButton) screenButton.textContent = "Share screen";
        };
        screenButton?.addEventListener("click", async () => {
          let cameraUnpublished = false;
          try {
            if (screenVideoTrack) {
              await stopScreenShare();
              return;
            }
            screenButton.disabled = true;
            const createdTrack = await window.AgoraRTC.createScreenVideoTrack({ encoderConfig: "1080p_1" }, "disable");
            screenVideoTrack = Array.isArray(createdTrack) ? createdTrack[0] : createdTrack;
            if (!screenVideoTrack) throw new Error("Screen capture was not available.");
            await client.unpublish(localVideoTrack);
            cameraUnpublished = true;
            await client.publish(screenVideoTrack);
            screenVideoTrack.play("agora-primary-player");
            // The camera remains visible only to the presenter while its
            // outgoing track is replaced by the screen stream.
            localVideoTrack.play("agora-local-player");
            modal.classList.add("agora-screen-sharing");
            screenVideoTrack.on("track-ended", () => stopScreenShare().catch((error) => console.error("Unable to stop screen share:", error)));
            modal.__agora = { ...modal.__agora, screenVideoTrack };
            screenButton.textContent = "Stop sharing";
          } catch (error) {
            if (screenVideoTrack) {
              screenVideoTrack.close();
              screenVideoTrack = null;
            }
            if (cameraUnpublished && localVideoTrack) {
              await client.publish(localVideoTrack);
              localVideoTrack.play("agora-primary-player");
            }
            modal.classList.remove("agora-screen-sharing");
            window.Utils?.error?.(error.message || "Unable to share your screen.") || window.alert(error.message || "Unable to share your screen.");
          } finally {
            screenButton.disabled = false;
          }
        });
        // Publish each track explicitly. This keeps the SDK from receiving a
        // malformed track array and makes both tracks unambiguously local to
        // this teacher client.
        await client.publish(localAudioTrack);
        await client.publish(localVideoTrack);
        modal.__hasLocalVideo = true;
        localVideoTrack.play("agora-primary-player");
        this.renderVideoGallery(modal);
      }
      status.textContent = "Connected to Agora";
      const elapsed = modal.querySelector("[data-agora-elapsed]");
      const connectedAt = Date.now();
      const updateElapsed = () => {
        const seconds = Math.floor((Date.now() - connectedAt) / 1000);
        if (elapsed) elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      };
      updateElapsed();
      modal.__elapsedTimer = window.setInterval(updateElapsed, 1000);
      modal.__agora = { ...modal.__agora, client, localAudioTrack, localVideoTrack, screenVideoTrack };
      return modal;
    } catch (error) {
      modal.__agora = { ...modal.__agora, client, localAudioTrack, localVideoTrack, screenVideoTrack };
      if (modal.__closed) return null;
      this.closeAgoraRoom(modal);
      throw error;
    }
  }
  static closeAgoraRoom(modal) {
    if (!modal) return;
    modal.__closed = true;
    const session = modal.__agora;
    if (session?.client) {
      session.client.leave();
    }
    if (session?.localAudioTrack) session.localAudioTrack.close();
    if (session?.localVideoTrack) session.localVideoTrack.close();
    if (session?.screenVideoTrack) session.screenVideoTrack.close();
    if (modal.__onKeydown) document.removeEventListener("keydown", modal.__onKeydown);
    if (modal.__elapsedTimer) window.clearInterval(modal.__elapsedTimer);
    document.body.style.overflow = modal.__previousBodyOverflow || "";
    document.body.classList.remove("agora-room-active");
    modal.remove();
    modal.__previousFocus?.focus?.({ preventScroll: true });
  }
  static async render(container) { this.state.container = container; container.innerHTML = '<div class="bg-white rounded-xl p-8 text-slate-500 shadow">Loading live classes...</div>'; try { await this.load(); this.draw(); } catch (error) { console.error(error); container.innerHTML = `<div class="bg-white rounded-xl p-8 text-red-600 shadow">${this.safe(error.message || "Unable to load live classes.")}</div>`; } }
  static draw() {
    const sessions = this.state.sessions.map((session) => this.card(session)).join("") || '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No live classes are scheduled for you yet.</div>';
    this.state.container.innerHTML = `<div class="space-y-6"><div class="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-6 text-white shadow"><h2 class="text-3xl font-bold">Live Classes</h2><p class="mt-2 text-indigo-100">${this.canSchedule() ? "Create secure Agora live sessions for subjects assigned to you." : "Join Agora live sessions for subjects in which you are enrolled."}</p></div>${this.canSchedule() ? this.form() : ""}<section><h3 class="mb-3 text-xl font-bold text-slate-800">My Live Classes</h3><div class="grid grid-cols-1 gap-4 lg:grid-cols-2">${sessions}</div></section></div>`;
    this.bind();
  }
  static form() {
    const subjects = this.assignmentSubjects(), classes = this.assignmentClasses();
    const disabled = !this.state.teacher || !subjects.length || !classes.length;
    const subjectOptions = subjects.map((subject) => {
      const assignedClassIds = this.state.assignments
        .filter((assignment) => String(assignment.teacher_id) === String(this.state.teacher?.id) && String(assignment.subject_id) === String(subject.id))
        .map((assignment) => String(assignment.class_id));
      return `<option value="${this.safe(subject.id)}" data-class-ids="${this.safe(assignedClassIds.join(","))}" disabled>${this.safe(subject.subject_name)}</option>`;
    }).join("");
    const students = this.state.students.map((student) => {
      const name = `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() || student.profiles?.email || "Student";
      const studentNumber = String(student.student_no || student.admission_number || "").trim();
      const label = studentNumber ? `${name} (${studentNumber})` : name;
      return `<label data-approved-student data-class-id="${this.safe(student.class_id)}" class="hidden items-center gap-2 rounded border p-2 text-sm"><input disabled type="checkbox" name="approved_student_ids" value="${this.safe(student.id)}"><span>${this.safe(label)}</span></label>`;
    }).join("") || '<p class="text-sm text-slate-500">No students are enrolled in your assigned classes.</p>';
    return `<section class="rounded-xl bg-white p-5 shadow"><h3 class="text-xl font-bold text-slate-800">Schedule an Agora live class</h3>${disabled ? '<p class="mt-2 text-sm text-amber-700">You need an administrator assignment for a subject and class before scheduling.</p>' : ""}<form id="live-class-form" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><label><span class="text-sm">Class *</span><select required name="class_id" id="live-class-id" class="mt-1 w-full rounded-lg border p-2.5"><option value="">Select class</option>${classes.map((row) => `<option value="${this.safe(row.id)}">${this.safe(row.class_name)}</option>`).join("")}</select></label><label><span class="text-sm">Subject *</span><select required name="subject_id" id="live-subject-id" disabled class="mt-1 w-full rounded-lg border p-2.5 disabled:bg-slate-100"><option value="">Select a class first</option>${subjectOptions}</select></label><label class="md:col-span-2"><span class="text-sm">Class title *</span><input required name="title" class="mt-1 w-full rounded-lg border p-2.5" placeholder="Introduction to Algebra"></label><label class="md:col-span-2"><span class="text-sm">Description</span><textarea name="description" rows="2" class="mt-1 w-full rounded-lg border p-2.5"></textarea></label><label><span class="text-sm">Start time *</span><input required name="starts_at" type="datetime-local" class="mt-1 w-full rounded-lg border p-2.5"></label><label><span class="text-sm">End time *</span><input required name="ends_at" type="datetime-local" class="mt-1 w-full rounded-lg border p-2.5"></label><fieldset class="md:col-span-2"><div class="flex items-center justify-between gap-3"><legend class="text-sm font-medium">Students for this live class *</legend><label class="text-sm font-medium text-cyan-700"><input disabled data-select-all-students type="checkbox"> Select all in class</label></div><p class="mb-2 text-xs text-slate-500">Select enrolled students who may receive the notification, join this Agora class, and be marked present.</p><div id="approved-students" class="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">${students}</div></fieldset><div id="live-class-error" role="alert" class="hidden md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"></div><div class="md:col-span-2"><button ${disabled ? "disabled" : ""} data-schedule-submit class="rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">Schedule Agora Class</button></div></form></section>`;
  }
  static card(session) {
    const status = String(session.status || "upcoming").toLowerCase(), teacherControls = this.canSchedule() && String(session.teacher_id) === String(this.state.teacher?.id);
    const joinable = status === "live";
    const teacherName = `${session.teacher_first_name || ""} ${session.teacher_last_name || ""}`.trim() || "Assigned teacher";
    const employeeId = String(session.teacher_employee_id || "").trim();
    const teacherLabel = employeeId ? `${teacherName} (${employeeId})` : teacherName;
    const teacherActions = teacherControls && status === "upcoming"
      ? `<button data-live-action="start" data-id="${this.safe(session.id)}" class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Start class</button><button data-live-action="cancel" data-id="${this.safe(session.id)}" class="rounded-lg border px-3 py-2 text-sm">Cancel</button>`
      : teacherControls && status === "live"
        ? `<button data-live-action="end" data-id="${this.safe(session.id)}" class="rounded-lg border px-3 py-2 text-sm">End class</button>`
        : "";
    return `<article class="rounded-xl bg-white p-5 shadow"><div class="flex justify-between gap-3"><div><h4 class="font-bold text-slate-800">${this.safe(session.title)}</h4><p class="mt-1 text-sm text-slate-500">${this.safe(session.subject_name || "Subject")}</p></div><span class="rounded-full px-3 py-1 text-xs font-medium ${status === "live" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}">${this.safe(status === "live" ? "LIVE NOW" : status)}</span></div><p class="mt-3 text-sm text-slate-600"><strong>Teacher:</strong> ${this.safe(teacherLabel)}<br><strong>Time:</strong> ${this.safe(this.format(session.starts_at))} – ${this.safe(this.format(session.ends_at))}</p>${session.description ? `<p class="mt-2 text-sm text-slate-600">${this.safe(session.description)}</p>` : ""}<div class="mt-4 flex flex-wrap gap-2"><button data-live-action="join" data-id="${this.safe(session.id)}" ${joinable ? "" : "disabled"} class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">${joinable ? "Join Class" : status === "ended" ? "Class Ended" : status === "cancelled" ? "Cancelled" : "Not started"}</button>${teacherActions}</div></article>`;
  }
  static bind() {
    const form = this.state.container.querySelector("#live-class-form");
    const classSelect = this.state.container.querySelector("#live-class-id");
    const subjectSelect = this.state.container.querySelector("#live-subject-id");
    const selectAll = this.state.container.querySelector("[data-select-all-students]");
    const startInput = this.state.container.querySelector("[name=starts_at]");
    const endInput = this.state.container.querySelector("[name=ends_at]");
    const localDateTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const earliestStart = localDateTime(new Date(Date.now() + 60000));
    if (startInput) startInput.min = earliestStart;
    if (endInput) endInput.min = earliestStart;
    startInput?.addEventListener("change", () => { if (startInput.value) endInput.min = startInput.value; });
    const updateEligibleStudents = () => {
      const classId = String(classSelect?.value || "");
      const subjectId = String(subjectSelect?.value || "");
      let eligibleCount = 0;
      this.state.container.querySelectorAll("[data-approved-student]").forEach((label) => {
        const allowed = Boolean(classId && subjectId) && String(label.dataset.classId) === classId;
        const input = label.querySelector("input");
        label.classList.toggle("hidden", !allowed);
        input.disabled = !allowed;
        if (!allowed) input.checked = false;
        if (allowed) eligibleCount += 1;
      });
      selectAll.disabled = eligibleCount === 0;
      if (!eligibleCount) selectAll.checked = false;
    };
    classSelect?.addEventListener("change", () => {
      const classId = String(classSelect.value || "");
      subjectSelect.disabled = !classId;
      subjectSelect.querySelectorAll("option[data-class-ids]").forEach((option) => {
        const allowed = String(option.dataset.classIds || "").split(",").includes(classId);
        option.hidden = !allowed;
        option.disabled = !allowed;
        if (!allowed && option.selected) subjectSelect.value = "";
      });
      subjectSelect.querySelector("option[value='']").textContent = classId ? "Select subject" : "Select a class first";
      updateEligibleStudents();
    });
    subjectSelect?.addEventListener("change", updateEligibleStudents);
    selectAll?.addEventListener("change", () => {
      this.state.container.querySelectorAll("[data-approved-student] input:not(:disabled)").forEach((input) => { input.checked = selectAll.checked; });
    });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorBox = this.state.container.querySelector("#live-class-error");
      const submitButton = form.querySelector("[data-schedule-submit]");
      const data = new FormData(event.currentTarget);
      const approvedStudentIds = data.getAll("approved_student_ids");
      try {
        if (!approvedStudentIds.length) throw new Error("Select at least one enrolled student.");
        const startsAt = new Date(String(data.get("starts_at") || ""));
        const endsAt = new Date(String(data.get("ends_at") || ""));
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error("Enter valid start and end times.");
        if (endsAt <= startsAt) throw new Error("End time must be after the start time.");
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        const result = await API.db.functions.invoke("schedule-live-class", { body: { ...Object.fromEntries(data), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), approved_student_ids: approvedStudentIds } });
        if (result.error || result.data?.error) {
          const message = result.data?.error || await API.functionErrorMessage(
            result.error,
            "Unable to schedule the class."
          );
          throw new Error(message);
        }
        window.Utils?.success?.("Class scheduled. Agora room is ready when you start the lesson.");
        await this.render(this.state.container);
      } catch (error) {
        errorBox.textContent = error.message || "Unable to create the class.";
        errorBox.classList.remove("hidden");
      } finally {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
    });
    this.state.container.querySelectorAll("[data-live-action]").forEach((button) => button.addEventListener("click", async () => {
      let statusChanged = false;
      try {
        const action = button.dataset.liveAction;
        const id = button.dataset.id;
        const session = this.state.sessions.find((item) => String(item.id) === String(id));
        if (!session) throw new Error("Live class session was not found.");
        if (action === "join") {
          await this.authorizeLiveClassJoin(id);
          await this.connectAgoraRoom(session);
          return;
        }
        const status = action === "start" ? "live" : action === "end" ? "ended" : "cancelled";
        const { error } = await API.db.rpc("set_live_class_status", { p_live_class_id: id, p_status: status });
        if (error) throw error;
        statusChanged = true;
        if (action === "start") {
          await this.authorizeLiveClassJoin(id);
          await this.connectAgoraRoom(session);
        }
        await this.render(this.state.container);
      } catch (error) {
        // The database status may already be live even if the browser could
        // not open Agora. Refresh so the card never remains "Not started".
        if (statusChanged) await this.render(this.state.container).catch(() => {});
        window.Utils?.error?.(error.message || "Unable to update the class.") || window.alert(error.message);
      }
    }));
  }
  static notificationKey(id) { return `emergence_live_class_popup_${id}`; }
  static async joinFromNotification(liveClassId) {
    await this.load();
    const session = this.state.sessions.find((item) => String(item.id) === String(liveClassId));
    if (!session) throw new Error("This live class is no longer available.");
    await this.authorizeLiveClassJoin(liveClassId);
    return this.connectAgoraRoom(session);
  }
  static async showLiveClassNotifications() {
    if (this.role() !== "student" || !window.API?.notifications?.inbox) return;
    const notifications = await window.API.notifications.inbox(20);
    window.NotificationBell?.updateDashboardNotificationCount?.();
    for (const notification of notifications) {
      const match = String(notification.message || "").match(/\[live-class:([a-f0-9-]{36})\]/i);
      if (!match || sessionStorage.getItem(this.notificationKey(notification.id))) continue;
      sessionStorage.setItem(this.notificationKey(notification.id), "shown");
      const liveClassId = match[1];
      const modal = document.createElement("div");
      modal.className = "live-class-notification-modal fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4";
      modal.innerHTML = `<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><p class="text-xs font-bold uppercase tracking-[.18em] text-cyan-700">Agora live class</p><h3 class="mt-2 text-xl font-bold text-slate-900">${this.safe(notification.title || "A live class was scheduled")}</h3><p class="mt-3 text-sm leading-6 text-slate-600">${this.safe(String(notification.message || "").replace(/\s*\[live-class:[^\]]+\]/i, ""))}</p><div class="mt-6 flex justify-end gap-3"><button data-live-popup-close class="rounded-lg border px-4 py-2 text-sm font-medium">Later</button><button data-live-popup-join class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white">Join live class</button></div></div>`;
      modal.querySelector("[data-live-popup-close]")?.addEventListener("click", () => modal.remove());
      modal.querySelector("[data-live-popup-join]")?.addEventListener("click", async () => {
        try { await this.joinFromNotification(liveClassId); modal.remove(); }
        catch (error) { window.Utils?.error?.(error.message || "This class has not started yet.") || window.alert(error.message || "This class has not started yet."); }
      });
      document.body.appendChild(modal);
    }
  }
  static watchStudentLiveClassNotifications() {
    if (this.role() !== "student" || this.liveNotificationTimer) return;
    this.showLiveClassNotifications().catch((error) => console.error("Unable to check live-class notifications:", error));
    this.liveNotificationTimer = window.setInterval(() => this.showLiveClassNotifications().catch((error) => console.error("Unable to check live-class notifications:", error)), 15000);
  }
  static async startLiveClassNotifications() {
    try {
      const profile = await Auth.profile(true);
      if (!profile || String(profile.role || "").toLowerCase() !== "student") return;
      this.state.profile = profile;
      this.watchStudentLiveClassNotifications();
    } catch (error) {
      console.error("Unable to start live-class notifications:", error);
    }
  }
}
window.LiveClassesModule = LiveClassesModule;
document.addEventListener("DOMContentLoaded", () => LiveClassesModule.startLiveClassNotifications());
