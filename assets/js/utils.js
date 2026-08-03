// Utilities
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
const naira = (n) => '₦' + Number(n).toLocaleString();
window.$ = $;
window.esc = esc;
window.naira = naira;

// Permissions
function permissions(role) {
  const p = { canCreate: false, canModify: false, canDelete: false, canBroadcast: false, canGrade: false, canPay: false, canLearn: false, canEnroll: false };
  if (role === 'CEO') { p.canCreate = true; p.canModify = true; p.canDelete = true; p.canBroadcast = true; }
  else if (role === 'Executive') { p.canCreate = true; p.canModify = true; p.canBroadcast = true; }
  else if (role === 'Admin') { p.canCreate = true; p.canModify = true; p.canDelete = true; p.canBroadcast = true; p.canPay = true; }
  else if (role === 'Teacher') { p.canCreate = true; p.canModify = true; p.canGrade = true; }
  else if (role === 'Student') { p.canLearn = true; p.canEnroll = false; }
  else if (role === 'Parent') { p.canPay = true; }
  return p;
}
function accessDenied() {
  return `
  <div class="flex flex-col items-center justify-center text-center py-20 fade-in">
    <div class="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-4xl mb-4"><i class="ph ph-lock-key"></i></div>
    <h2 class="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
    <p class="text-slate-500 max-w-md">Your role does not have permission to access this office or module. Contact your administrator if you need access.</p>
    <button onclick="setView('dashboard')" class="mt-6 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition">Return to Dashboard</button>
  </div>`;
}