/* ==========================================================
   EMERGENCE ACADEMY
   DASHBOARD USER HELPERS
========================================================== */

async function displayUser() {
    try {
        const profile = await Profile.load();
        if (!profile) return;

        const normalizeAvatarUrl = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (!/^https?:\/\//i.test(raw)) return raw;

            try {
                const parsed = new URL(raw);
                const marker = "/storage/v1/object/";
                const markerIndex = parsed.pathname.indexOf(marker);
                if (markerIndex === -1) return raw;

                const objectPath = parsed.pathname.slice(markerIndex + marker.length);
                if (objectPath.startsWith("public/")) return raw;

                const slashIndex = objectPath.indexOf("/");
                if (slashIndex <= 0) return raw;

                const bucket = objectPath.slice(0, slashIndex);
                const key = objectPath.slice(slashIndex + 1);
                if (!bucket || !key) return raw;

                return `${parsed.origin}/storage/v1/object/public/${bucket}/${key}`;
            } catch (_) {
                return raw;
            }
        };

        const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || profile.name || profile.email || "User";
        const email = profile.email || "";
        const initials = fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "U";

        document.querySelectorAll(".user-name").forEach((el) => {
            el.textContent = fullName;
        });

        document.querySelectorAll(".user-role").forEach((el) => {
            el.textContent = profile.role || "-";
        });

        document.querySelectorAll(".user-email").forEach((el) => {
            el.textContent = email;
        });

        document.querySelectorAll("[data-user-avatar]").forEach((el) => {
            const avatarUrl = normalizeAvatarUrl(profile.avatar_url || profile.profile_image || "");
            const showInitials = () => {
                el.replaceChildren(document.createTextNode(initials));
                el.style.backgroundImage = "";
                el.setAttribute("aria-label", `${fullName}'s initials`);
            };

            if (!avatarUrl) {
                showInitials();
                return;
            }

            // Use an actual image instead of a CSS background. Besides being
            // more accessible, this gives failed or expired storage URLs a
            // clean initials fallback rather than an empty blue circle.
            const image = document.createElement("img");
            image.src = avatarUrl;
            image.alt = `${fullName}'s profile photo`;
            image.className = "h-full w-full object-cover";
            image.addEventListener("error", showInitials, { once: true });
            el.replaceChildren(image);
            el.style.backgroundImage = "";
            el.setAttribute("aria-label", `${fullName}'s profile image`);
        });
    } catch (error) {
        console.error("displayUser failed:", error);
    }
}

window.displayUser = displayUser;
document.addEventListener("DOMContentLoaded", displayUser);
