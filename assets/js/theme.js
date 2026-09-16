/* Persistent, accessible theme control for authenticated app pages. */
(() => {
  const storageKey = "emergence_theme";

  const preferredTheme = () => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const isDark = theme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      button.innerHTML = `<i class="ph ${isDark ? "ph-sun" : "ph-moon"} text-xl" aria-hidden="true"></i><span class="theme-toggle-label">${isDark ? "Light" : "Dark"}</span>`;
    });
  };

  const initialise = () => {
    applyTheme(preferredTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        localStorage.setItem(storageKey, next);
        applyTheme(next);
      });
    });
  };

  window.EmergenceTheme = { applyTheme, preferredTheme };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
