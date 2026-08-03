const db = {
  users: [],
  teachers: [],
  courses: [],
  students: [],
  assignments: [],
  payments: []
};

if (typeof globalThis !== 'undefined') {
  globalThis.db = db;
}

const officeNames = { CEO: 'CEO Office', Executive: 'Executive Suite', Admin: 'Administration Block', Teacher: 'Staff Room', Student: 'Student Portal', Parent: 'Parent Lounge', Guest: 'Visitor Center' };

function permissions(role) {
  const base = {
    canCreate: ['CEO', 'Admin', 'Executive', 'Teacher'].includes(role),
    canModify: ['CEO', 'Admin', 'Executive', 'Teacher'].includes(role),
    canDelete: ['CEO', 'Admin'].includes(role),
    canGrade: ['Teacher'].includes(role),
    canPay: ['Parent', 'Admin', 'CEO', 'Executive'].includes(role),
    canBroadcast: ['CEO', 'Admin', 'Executive'].includes(role)
  };
  return base;
}

function naira(value) {
  return `₦${Number(value).toLocaleString()}`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
