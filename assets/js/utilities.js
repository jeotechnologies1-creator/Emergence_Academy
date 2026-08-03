/* ==========================================================
   EMERGENCE ACADEMY
   UTILITIES
   Version 2.0
========================================================== */

class Utils {

    /* ======================================================
       LOADING SCREEN
    ====================================================== */

    static hideLoadingScreen() {

        const screen = document.getElementById("loading-screen");

        if (!screen) return;

        screen.style.opacity = "0";

        setTimeout(() => {

            screen.remove();

        }, 300);

    }

    /* ======================================================
       GLOBAL LOADER
    ====================================================== */

    static showLoader(text = "Loading...") {

        let loader = document.getElementById("global-loader");

        if (!loader) {

            loader = document.createElement("div");

            loader.id = "global-loader";

            loader.className =
                "fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]";

            loader.innerHTML = `

                <div class="bg-white rounded-xl shadow-xl p-6 text-center">

                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>

                    <p id="loader-text" class="text-gray-700">

                        ${text}

                    </p>

                </div>

            `;

            document.body.appendChild(loader);

        }

        loader.style.display = "flex";

        const label = document.getElementById("loader-text");

        if (label) {

            label.textContent = text;

        }

    }

    static hideLoader() {

        const loader = document.getElementById("global-loader");

        if (loader) {

            loader.style.display = "none";

        }

    }

    /* ======================================================
       TOAST MESSAGE
    ====================================================== */

    static toast(message, type = "success") {

        const box = document.getElementById("error-message");

        if (!box) {

            alert(message);

            return;

        }

        box.textContent = message;

        box.classList.remove("hidden");

        box.classList.remove(

            "bg-red-600",

            "bg-green-600",

            "bg-yellow-500"

        );

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

        setTimeout(() => {

            box.classList.add("hidden");

        }, 3000);

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

    /* ======================================================
       CONFIRM
    ====================================================== */

    static confirm(message) {

        return window.confirm(message);

    }

    /* ======================================================
       DATE
    ====================================================== */

    static formatDate(date) {

        if (!date) return "-";

        return new Date(date).toLocaleDateString();

    }

    static formatDateTime(date) {

        if (!date) return "-";

        return new Date(date).toLocaleString();

    }

    static formatTime(date) {

        if (!date) return "-";

        return new Date(date).toLocaleTimeString();

    }

    /* ======================================================
       MONEY
    ====================================================== */

    static money(value = 0) {

        return new Intl.NumberFormat(

            "en-NG",

            {

                style: "currency",

                currency: "NGN"

            }

        ).format(Number(value));

    }

    /* ======================================================
       RANDOM ID
    ====================================================== */

    static id(length = 8) {

        return Math.random()

            .toString(36)

            .substring(2)

            .toUpperCase()

            .slice(0, length);

    }

    /* ======================================================
       VALIDATION
    ====================================================== */

    static validEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    }

    static validPhone(phone) {

        return /^[0-9]{10,15}$/.test(phone);

    }

    static empty(value) {

        return (

            value === null ||

            value === undefined ||

            value === ""

        );

    }

    /* ======================================================
       DOM
    ====================================================== */

    static set(id, value) {

        const el = document.getElementById(id);

        if (el) {

            el.textContent = value;

        }

    }

    static get(id) {

        const el = document.getElementById(id);

        if (!el) return null;

        if ("value" in el) {

            return el.value;

        }

        return el.textContent;

    }

    static show(id) {

        const el = document.getElementById(id);

        if (el) {

            el.classList.remove("hidden");

        }

    }

    static hide(id) {

        const el = document.getElementById(id);

        if (el) {

            el.classList.add("hidden");

        }

    }

    /* ======================================================
       STARTUP
    ====================================================== */

    static init() {

        this.hideLoadingScreen();

        console.log("Utilities Loaded");

    }

}

document.addEventListener(

    "DOMContentLoaded",

    () => {

        Utils.init();

    }

);

window.Utils = Utils;