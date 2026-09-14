(function () {
  const user = window.DAA_API.requireAuth(['teacher', 'hifz_teacher']);
  if (!user) return;

  const isHifz = user.role === 'hifz_teacher' || user.role === 'hifz_coordinator';

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: isHifz ? 'Hifz Teacher Dashboard' : 'Teacher Dashboard',
    pageSubtitle: "Today's routine and recent activity",
    activeKey: 'dash',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;

  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return isNaN(d) ? t : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  window.DAA_API.get('/dashboard/teacher')
    .then((data) => {
      window.DAA_SHELL.setTopbarName(user.userCode);
      const routine = data.todayRoutine || [];
      const assignments = data.recentAssignments || [];
      const notices = data.latestNotices || [];

      content.innerHTML = `
        <div class="row g-3 mb-1">
          <div class="col-6 col-lg-4">
            <div class="stat-card">
              <div class="stat-icon"><i class="fa-solid fa-calendar-day"></i></div>
              <div><div class="stat-value">${routine.length}</div><div class="stat-label">Classes Today (${DOW[new Date().getDay()]})</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-4">
            <div class="stat-card gold">
              <div class="stat-icon"><i class="fa-solid fa-file-pen"></i></div>
              <div><div class="stat-value">${assignments.length}</div><div class="stat-label">Recent Assignments</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-4">
            <div class="stat-card info">
              <div class="stat-icon"><i class="fa-solid fa-bullhorn"></i></div>
              <div><div class="stat-value">${notices.length}</div><div class="stat-label">Latest Notices</div></div>
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-lg-6">
            <div class="p-card">
              <h5><i class="fa-solid fa-calendar-days"></i> Today's Routine</h5>
              ${routine.length ? `<ul class="list-clean">
                ${routine.map(r => `<li><span>${r.subject?.name || r.subjectName || 'Class'} — ${r.class?.name || ''} ${r.section?.name || ''}</span><strong>${fmtTime(r.startTime)}${r.endTime ? ' - ' + fmtTime(r.endTime) : ''}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No classes scheduled for today.</div>`}
            </div>
          </div>

          <div class="col-lg-6">
            <div class="p-card">
              <h5><i class="fa-solid fa-file-pen"></i> Recent Assignments</h5>
              ${assignments.length ? `<ul class="list-clean">
                ${assignments.map(a => `<li><span>${a.title}</span><strong>${fmtDate(a.createdAt)}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No assignments yet.</div>`}
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-12">
            <div class="p-card">
              <h5><i class="fa-solid fa-bullhorn"></i> Latest Notices</h5>
              ${notices.length ? `<ul class="list-clean">
                ${notices.map(n => `<li><span>${n.title}</span><strong>${fmtDate(n.publishedAt)}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No notices yet.</div>`}
            </div>
          </div>
        </div>
      `;
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
