// Central mapping of role -> the dashboard route the frontend should
// redirect to after login. Keeping this server-side means the frontend
// never has to hardcode/guess the mapping, and it stays in sync if a role
// is renamed.
const ROLE_REDIRECTS = {
  student: '/student',
  guardian: '/guardian',
  teacher: '/teacher',
  hifz_teacher: '/hifz-teacher',
  hifz_coordinator: '/hifz-teacher',
  admin: '/admin',
  principal: '/admin',
  accountant: '/admin/finance',
  receptionist: '/admin/admissions',
  librarian: '/admin/library',
  super_admin: '/super-admin',
};

function getRedirectPath(roleName) {
  return ROLE_REDIRECTS[roleName] || '/login';
}

module.exports = { getRedirectPath, ROLE_REDIRECTS };
