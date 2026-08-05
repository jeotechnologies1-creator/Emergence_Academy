/* ==========================================================
   EMERGENCE ACADEMY
   UTILITIES
========================================================== */

class Utils {
    static hideLoadingScreen() {
        const screen = document.getElementById("loading-screen");
        if (!screen) return;
        screen.style.opacity = "0";
        setTimeout(() => {
            screen.remove();
        }, 300);
    }
    static showLoader(text = "Loading...") {
        let loader = document.getElementById("global-loader");
        if (!loader) {
            loader = document.createElement("div");
            loader.id = "global-loader";
            loader.className = "fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]";
            loader.innerHTML = `
                <div class="bg-white rounded-xl shadow-xl p-6 text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                    <p id="loader-text" class="text-gray-700">${text}</p>
                </div>
            `;
            document.body.appendChild(loader);
        }
        loader.style.display = "flex";
        const label = document.getElementById("loader-text");
        if (label) label.textContent = text;
    }
    static hideLoader() {
        const loader = document.getElementById("global-loader");
        if (loader) loader.style.display = "none";
    }
    static toast(message, type = "success") {
        const box = document.getElementById("error-message") || document.getElementById("success-message");
        if (!box) {
            alert(message);
            return;
        }
        box.textContent = message;
        box.classList.remove("hidden", "bg-red-600", "bg-green-600", "bg-yellow-500");
        switch (type) {
            case "success":
                box.classList.add("bg-green-600");
                break;
            case "warning":
                box.classList.add("bg-yellow-500");
                break;
            default:
                box.classList.add("bg-red-600");
        }
        box.classList.remove("hidden");
        setTimeout(() => {
            box.classList.add("hidden");
        }, 3500);
    }
    static success(message) {
        this.toast(message, "success");
    }
    static error(message) {
        this.toast(message, "error");
    }
    static warning(message) {
        this.toast(message, "warning");
    }
    static confirm(message) {
        return window.confirm(message);
    }
    static formatDate(value) {
        if (!value) return "-";
        return new Date(value).toLocaleDateString();
    }
    static formatDateTime(value) {
        if (!value) return "-";
        return new Date(value).toLocaleString();
    }
    static formatTime(value) {
        if (!value) return "-";
        return new Date(value).toLocaleTimeString();
    }
    static money(value = 0) {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(value) || 0);
    }
    static id(length = 8) {
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }
    static validEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    static validPhone(phone) {
        return /^[0-9]{10,15}$/.test(phone);
    }
    static empty(value) {
        return value === null || value === undefined || value === "";
    }
    static set(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    static get(id) {
        const el = document.getElementById(id);
        if (!el) return null;
        return "value" in el ? el.value : el.textContent;
    }
    static show(id) {
        document.getElementById(id)?.classList.remove("hidden");
    }
    static hide(id) {
        document.getElementById(id)?.classList.add("hidden");
    }
    static init() {
        this.hideLoadingScreen();
        console.log("Utilities Loaded");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    Utils.init();
});

window.Utils = Utils;
