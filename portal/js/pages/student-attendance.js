(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Attendance',
    pageSubtitle: 'Your attendance history and summary',
    activeKey: 'att',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;

  window.DAA_API.get('/dashboard/student')
    .then((dash) => {
      const studentId = dash.profile?.id;
      window.DAA_SHELL.setTopbarName(dash.profile?.fullName);
      if (!studentId) throw new Error('Student profile not found.');
      return window.DAA_API.get(`/attendance/student/${studentId}`);
    })
    .then((data) => {
      const s = data.summary;
      content.innerHTML = `
        <div class="row g-3 mb-1">
          <div class="col-6 col-lg-3">
            <div class="stat-card">
              <div class="stat-icon"><i class="fa-solid fa-percent"></i></div>
              <div><div class="stat-value">${s.percentage}%</div><div class="stat-label">Attendance Rate</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card">
              <div class="stat-icon"><i class="fa-solid fa-check"></i></div>
              <div><div class="stat-value">${s.present}</div><div class="stat-label">Present</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card danger">
              <div class="stat-icon"><i class="fa-solid fa-xmark"></i></div>
              <div><div class="stat-value">${s.absent}</div><div class="stat-label">Absent</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card gold">
              <div class="stat-icon"><i class="fa-solid fa-clock"></i></div>
              <div><div class="stat-value">${s.late}</div><div class="stat-label">Late</div></div>
            </div>
          </div>
        </div>

        <div class="p-card mt-1">
          <h5><i class="fa-solid fa-calendar-days"></i> Attendance Log</h5>
          ${data.records.length ? `<ul class="list-clean">
            ${data.records.map(r => `<li><span>${U.fmtDate(r.attendanceDate)}</span>${U.statusBadge(r.status)}</li>`).join('')}
          </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No attendance recorded yet.</div>`}
        </div>
      `;
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
