(function () {
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'accountant', 'receptionist', 'librarian', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Admin Dashboard',
    pageSubtitle: 'Institution-wide overview',
    activeKey: 'dash',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="row g-3">${Array(4).fill('<div class="col-6 col-lg-3"><div class="skeleton" style="height:88px;border-radius:14px;"></div></div>').join('')}</div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  window.DAA_API.get('/dashboard/admin')
    .then((data) => {
      content.innerHTML = `
        <div class="row g-3 mb-1">
          <div class="col-6 col-lg-3">
            <div class="stat-card">
              <div class="stat-icon"><i class="fa-solid fa-user-graduate"></i></div>
              <div><div class="stat-value">${data.totalStudents}</div><div class="stat-label">${data.activeStudents} Active Students</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card gold">
              <div class="stat-icon"><i class="fa-solid fa-book-quran"></i></div>
              <div><div class="stat-value">${data.hifzStudents}</div><div class="stat-label">Hifz Students</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card info">
              <div class="stat-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
              <div><div class="stat-value">${data.totalTeachers}</div><div class="stat-label">${data.totalStaff} Total Staff</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card danger">
              <div class="stat-icon"><i class="fa-solid fa-sack-dollar"></i></div>
              <div><div class="stat-value">৳${(data.monthlyFeeCollection || 0).toLocaleString()}</div><div class="stat-label">Fee Collected This Month</div></div>
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-calendar-check"></i> Today's Attendance</h5>
              <ul class="list-clean">
                <li><span>Present</span><span class="badge-status badge-ok">${data.todayAttendance?.present ?? 0}</span></li>
                <li><span>Absent</span><span class="badge-status badge-danger">${data.todayAttendance?.absent ?? 0}</span></li>
              </ul>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-file-lines"></i> Exams</h5>
              <ul class="list-clean">
                <li><span>Upcoming Exams</span><strong>${data.upcomingExamCount}</strong></li>
              </ul>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-layer-group"></i> Students by Class</h5>
              ${(data.studentsByClass || []).length ? `<ul class="list-clean">
                ${data.studentsByClass.map(c => `<li><span>${U.escapeHtml(c.className)}</span><strong>${c.count}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No class data yet.</div>`}
            </div>
          </div>
        </div>
      `;
    })
    .catch((err) => {
      if (err.status === 403) {
        content.innerHTML = `
          <div class="p-card text-center" style="max-width:520px;margin:20px auto;padding:36px 26px;">
            <i class="fa-solid fa-lock" style="font-size:30px;color:var(--gold);margin-bottom:12px;"></i>
            <h4>Your role has a focused view</h4>
            <p style="color:var(--muted);">The full institution overview is limited to Admin, Principal and Super Admin. Your day-to-day tools will live under the sidebar sections above as they're built.</p>
          </div>`;
        return;
      }
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
