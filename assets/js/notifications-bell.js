(function () {
    "use strict";

    let forceZeroUntil = 0;

    function setActiveNotificationsNav() {
        document
            .querySelectorAll("[data-route]")
            .forEach((button) => button.classList.remove("active"));

        document
            .querySelectorAll('[data-route="notifications"]')
            .forEach((button) => button.classList.add("active"));
    }

    async function navigateToNotifications() {
        const onDashboardPage = !!document.getElementById("dashboard-content");

        if (
            onDashboardPage &&
            window.RoleRouter &&
            typeof window.RoleRouter.isAllowedRoute === "function" &&
            !window.RoleRouter.isAllowedRoute("notifications")
        ) {
            window.Utils?.toast?.(
                "You do not have permission to access notifications.",
                "error"
            );
            return;
        }

        if (
            onDashboardPage &&
            window.Router &&
            typeof window.Router.navigate === "function"
        ) {
            setActiveNotificationsNav();
            await window.Router.navigate("notifications");
            return;
        }

        window.location.href = "dashboard.html#notifications";
    }

    async function updateDashboardNotificationCount() {
        if (!document.querySelector("[data-notification-count]")) {
            return;
        }

        if (!window.API?.notifications?.unreadCount) {
            return;
        }

        try {
            let total = await window.API.notifications.unreadCount();
            total = Number(total || 0);

            if (Date.now() < forceZeroUntil) {
                total = 0;
            }

            document.querySelectorAll("[data-notification-count]").forEach((badge) => {
                badge.textContent = String(total);
                badge.classList.toggle("hidden", total <= 0);
            });
        } catch (error) {
            console.error("[Notifications] Unable to update notification count:", error);
        }
    }

    function bindNotificationBells() {
        document.querySelectorAll("[data-notification-bell]").forEach((button) => {
            if (button.hasAttribute("data-route")) {
                return;
            }

            button.addEventListener("click", async (event) => {
                event.preventDefault();
                await navigateToNotifications();
            });
        });
    }

    async function markNotificationsViewed() {
        try {
            if (!window.API?.notifications?.markInboxViewed) {
                return;
            }

            forceZeroUntil = Date.now() + 1200;
            await window.API.notifications.markInboxViewed();
            await updateDashboardNotificationCount();
        } catch (error) {
            console.error("[Notifications] Unable to mark notifications viewed:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindNotificationBells();
        updateDashboardNotificationCount();

        window.setInterval(() => {
            updateDashboardNotificationCount();
        }, 30000);

        if (window.location.hash.replace("#", "") === "notifications") {
            markNotificationsViewed();
        }
    });

    window.NotificationBell = {
        navigateToNotifications,
        updateDashboardNotificationCount,
        markNotificationsViewed
    };
})();
