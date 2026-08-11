/* ==========================================================
   EMERGENCE ACADEMY — CURRICULUM SUBJECT DIRECTORY
========================================================== */

class SubjectsModule {
    static async render(container) {
        container.innerHTML = '<div class="rounded-xl bg-white p-6 shadow">Loading subjects…</div>';

        const { data, error } = await API.db
            .from("subjects")
            .select("id,subject_name,subject_code,curriculum_band,curriculum_level,curriculum_track")
            .order("curriculum_band")
            .order("curriculum_level")
            .order("curriculum_track")
            .order("subject_name");

        if (error) throw error;
        const subjects = Array.isArray(data) ? data : [];
        const groups = subjects.reduce((all, subject) => {
            const band = subject.curriculum_band || "Other";
            const level = subject.curriculum_level || "General";
            const track = subject.curriculum_track || "Core";
            const key = `${band}|${level}|${track}`;
            (all[key] ||= { band, level, track, subjects: [] }).subjects.push(subject);
            return all;
        }, {});

        container.innerHTML = `
            <section class="space-y-6">
                <div class="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow">
                    <h2 class="text-3xl font-bold">Subject Directory</h2>
                    <p class="mt-2 text-blue-100">Primary 3–6, JSS 1–3, and SSS 1–3 curriculum and trade options.</p>
                </div>
                <div class="rounded-xl bg-white p-5 shadow">
                    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <p class="font-semibold text-slate-800">${subjects.length} subjects available</p>
                        <input id="subject-directory-search" type="search" placeholder="Search subjects…" class="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-72">
                    </div>
                    <div id="subject-directory-groups" class="grid gap-4 lg:grid-cols-2">
                        ${Object.values(groups).map((group) => this.groupTemplate(group)).join("") || '<p class="text-slate-500">No subjects have been configured yet.</p>'}
                    </div>
                </div>
            </section>`;

        document.getElementById("subject-directory-search")?.addEventListener("input", (event) => {
            const query = String(event.target.value || "").trim().toLowerCase();
            document.querySelectorAll("[data-subject-entry]").forEach((entry) => {
                entry.classList.toggle("hidden", Boolean(query) && !entry.textContent.toLowerCase().includes(query));
            });
        });
    }

    static groupTemplate(group) {
        const title = [group.band, group.level, group.track === "Core" ? "" : group.track].filter(Boolean).join(" · ");
        return `<article class="rounded-xl border border-slate-200 p-4"><h3 class="font-bold text-slate-800">${this.safe(title)}</h3><ul class="mt-3 space-y-2 text-sm text-slate-600">${group.subjects.map((subject) => `<li data-subject-entry class="rounded bg-slate-50 px-3 py-2">${this.safe(subject.subject_name)}${subject.subject_code ? `<span class="ml-2 text-xs text-slate-400">${this.safe(subject.subject_code)}</span>` : ""}</li>`).join("")}</ul></article>`;
    }

    static safe(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
}

window.SubjectsModule = SubjectsModule;
