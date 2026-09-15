/**
 * Darul Aman Academy Portal — central sidebar nav config.
 * Every dashboard/module page imports this and calls DAA_NAV.get(role, activeKey).
 * Paths are relative to a role folder (e.g. /portal/student/).
 */
(function () {
  const NAV = {
    student: [
      { label: 'Dashboard', icon: 'fa-solid fa-gauge', href: 'student/dashboard.html', key: 'dash' },
      { label: 'Attendance', icon: 'fa-solid fa-calendar-check', href: 'student/attendance.html', key: 'att' },
      { label: 'Exams & Results', icon: 'fa-solid fa-file-lines', href: 'student/exams.html', key: 'exam' },
      { label: 'My Assignments', icon: 'fa-solid fa-book-open', href: 'student/assignments.html', key: 'assignments' },
      { label: 'Fees', icon: 'fa-solid fa-money-bill-wave', href: 'student/fees.html', key: 'fees' },
      { label: 'Hifz Progress', icon: 'fa-solid fa-book-quran', href: 'student/hifz-progress.html', key: 'hifz' },
      { label: 'Notices', icon: 'fa-solid fa-bullhorn', href: 'student/notices.html', key: 'notice' },
      { label: 'My Profile', icon: 'fa-solid fa-user', href: 'student/profile.html', key: 'profile' },
    ],
    guardian: [
      { label: 'Dashboard', icon: 'fa-solid fa-gauge', href: 'guardian/dashboard.html', key: 'dash' },
      { label: 'My Children', icon: 'fa-solid fa-children', href: 'guardian/children.html', key: 'children' },
      { label: 'Fees', icon: 'fa-solid fa-money-bill-wave', href: 'guardian/fees.html', key: 'fees' },
      { label: 'Notices', icon: 'fa-solid fa-bullhorn', href: 'guardian/notices.html', key: 'notice' },
      { label: 'My Profile', icon: 'fa-solid fa-user', href: 'coming-soon.html', key: 'profile' },
    ],
    teacher: [
      { label: 'Dashboard', icon: 'fa-solid fa-gauge', href: 'teacher/dashboard.html', key: 'dash' },
      { label: 'My Students', icon: 'fa-solid fa-user-graduate', href: 'teacher/students.html', key: 'students', roles: ['teacher', 'hifz_teacher'] },
      { label: 'My Assignments', icon: 'fa-solid fa-calendar-days', href: 'teacher/assignments.html', key: 'routine' },
      { label: 'Mark Attendance', icon: 'fa-solid fa-calendar-check', href: 'teacher/attendance.html', key: 'att' },
      { label: 'Hifz Evaluation', icon: 'fa-solid fa-book-quran', href: 'teacher/hifz-evaluation.html', key: 'hifz', roles: ['hifz_teacher', 'hifz_coordinator'] },
      { label: 'Notices', icon: 'fa-solid fa-bullhorn', href: 'teacher/notices.html', key: 'notice' },
    ],
    admin: [
      { label: 'Dashboard', icon: 'fa-solid fa-gauge', href: 'admin/dashboard.html', key: 'dash' },
      { label: 'Students', icon: 'fa-solid fa-user-graduate', href: 'admin/students.html', key: 'students' },
      { label: 'Teachers & Staff', icon: 'fa-solid fa-chalkboard-user', href: 'admin/teachers.html', key: 'teachers' },
      { label: 'Academic Setup', icon: 'fa-solid fa-school', href: 'admin/academic.html', key: 'academic', roles: ['admin', 'principal'] },
      { label: 'Exams & Results', icon: 'fa-solid fa-file-lines', href: 'admin/exams.html', key: 'exams', roles: ['admin', 'principal'] },
      { label: 'Hifz Management', icon: 'fa-solid fa-book-quran', href: 'admin/hifz.html', key: 'hifz', roles: ['admin', 'principal'] },
      { label: 'Admissions', icon: 'fa-solid fa-file-signature', href: 'admin/admissions.html', key: 'admissions' },
      { label: 'Finance', icon: 'fa-solid fa-sack-dollar', href: 'admin/finance.html', key: 'finance' },
      { label: 'Notices', icon: 'fa-solid fa-bullhorn', href: 'admin/notices.html', key: 'notice' },
      { label: 'Gallery', icon: 'fa-solid fa-images', href: 'admin/gallery.html', key: 'gallery', roles: ['admin', 'principal'] },
      { label: 'Audit Log', icon: 'fa-solid fa-clock-rotate-left', href: 'super-admin/audit.html', key: 'audit', roles: ['admin'] },
    ],
    'super-admin': [
      { label: 'Dashboard', icon: 'fa-solid fa-gauge', href: 'super-admin/dashboard.html', key: 'dash' },
      { label: 'Students', icon: 'fa-solid fa-user-graduate', href: 'admin/students.html', key: 'students' },
      { label: 'Teachers & Staff', icon: 'fa-solid fa-chalkboard-user', href: 'admin/teachers.html', key: 'teachers' },
      { label: 'Academic Setup', icon: 'fa-solid fa-school', href: 'admin/academic.html', key: 'academic' },
      { label: 'Exams & Results', icon: 'fa-solid fa-file-lines', href: 'admin/exams.html', key: 'exams' },
      { label: 'Hifz Management', icon: 'fa-solid fa-book-quran', href: 'admin/hifz.html', key: 'hifz' },
      { label: 'Finance', icon: 'fa-solid fa-sack-dollar', href: 'admin/finance.html', key: 'finance' },
      { label: 'Users & Roles', icon: 'fa-solid fa-users-gear', href: 'super-admin/users.html', key: 'users' },
      { label: 'Permissions', icon: 'fa-solid fa-key', href: 'super-admin/permissions.html', key: 'perms' },
      { label: 'Audit Log', icon: 'fa-solid fa-clock-rotate-left', href: 'super-admin/audit.html', key: 'audit' },
      { label: 'Notices', icon: 'fa-solid fa-bullhorn', href: 'super-admin/notices.html', key: 'notice' },
      { label: 'Gallery', icon: 'fa-solid fa-images', href: 'admin/gallery.html', key: 'gallery' },
    ],
  };

  const ROLE_FOLDER = {
    student: 'student', guardian: 'guardian',
    teacher: 'teacher', hifz_teacher: 'teacher', hifz_coordinator: 'teacher',
    admin: 'admin', principal: 'admin', accountant: 'admin', receptionist: 'admin', librarian: 'admin',
    super_admin: 'super-admin',
  };

  window.DAA_NAV = {
    folderFor(role) { return ROLE_FOLDER[role] || 'admin'; },
    itemsFor(role) {
      const items = NAV[ROLE_FOLDER[role] || 'admin'] || [];
      return items.filter(item => !item.roles || item.roles.includes(role));
    },
  };
})();
