(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Dashboard',
    pageSubtitle: "Here's your academic snapshot for today",
    activeKey: 'dash',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="row g-3" id="skeletonRow">
    ${Array(4).fill('<div class="col-6 col-lg-3"><div class="skeleton" style="height:88px;border-radius:14px;"></div></div>').join('')}
  </div>`;

  function statusBadge(status) {
    const map = {
      present: ['badge-ok', 'Present'],
      absent: ['badge-danger', 'Absent'],
      late: ['badge-warn', 'Late'],
      leave: ['badge-muted', 'On Leave'],
      not_marked: ['badge-muted', 'Not marked yet'],
    };
    const [cls, label] = map[status] || map.not_marked;
    return `<span class="badge-status ${cls}">${label}</span>`;
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  window.DAA_API.get('/dashboard/student')
    .then((data) => {
      const p = data.profile || {};
      window.DAA_SHELL.setTopbarName(p.fullName);

      content.innerHTML = `
        <div class="row g-3 mb-1">
          <div class="col-6 col-lg-3">
            <div class="stat-card">
              <div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div>
              <div><div class="stat-value" style="font-size:16px;">${statusBadge(data.todayAttendanceStatus)}</div><div class="stat-label">Today's Attendance</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card gold">
              <div class="stat-icon"><i class="fa-solid fa-file-lines"></i></div>
              <div><div class="stat-value">${(data.upcomingExams || []).length}</div><div class="stat-label">Upcoming Exams</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card danger">
              <div class="stat-icon"><i class="fa-solid fa-money-bill-wave"></i></div>
              <div><div class="stat-value">৳${(data.feeStatus?.totalDue || 0).toLocaleString()}</div><div class="stat-label">${data.feeStatus?.unpaidInvoiceCount || 0} Unpaid Invoice(s)</div></div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card info">
              <div class="stat-icon"><i class="fa-solid fa-book-quran"></i></div>
              <div><div class="stat-value">${data.hifzProgress ? data.hifzProgress.completionPercent + '%' : '—'}</div><div class="stat-label">Hifz Completion</div></div>
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-id-card"></i> My Profile</h5>
              <ul class="list-clean">
                <li><span>Student Code</span><strong>${p.studentCode || '—'}</strong></li>
                <li><span>Class</span><strong>${p.currentClass?.name || '—'}</strong></li>
                <li><span>Section</span><strong>${p.currentSection?.name || '—'}</strong></li>
                <li><span>Department</span><strong>${p.department?.name || '—'}</strong></li>
                <li><span>Status</span><span class="badge-status ${p.status === 'active' ? 'badge-ok' : 'badge-muted'}">${p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : '—'}</span></li>
              </ul>
            </div>
          </div>

          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-file-lines"></i> Upcoming Exams</h5>
              ${(data.upcomingExams || []).length ? `<ul class="list-clean">
                ${data.upcomingExams.map(ex => `<li><span>${ex.exam?.name || 'Exam'}</span><strong>${fmtDate(ex.examDate)}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No upcoming exams scheduled.</div>`}
            </div>
          </div>

          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-bullhorn"></i> Latest Notices</h5>
              ${(data.latestNotices || []).length ? `<ul class="list-clean">
                ${data.latestNotices.map(n => `<li><span>${n.title}</span><strong>${fmtDate(n.publishedAt)}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No notices yet.</div>`}
            </div>
          </div>
        </div>

        ${data.hifzProgress ? `
        <div class="row g-3 mt-1">
          <div class="col-12">
            <div class="p-card">
              <h5><i class="fa-solid fa-book-quran"></i> Hifz-ul-Quran Progress</h5>
              <div class="d-flex align-items-center gap-3 mb-2">
                <div class="progress flex-grow-1" style="height:10px;border-radius:6px;background:#EFEDE6;">
                  <div class="progress-bar" style="width:${data.hifzProgress.completionPercent}%;background:var(--green);"></div>
                </div>
                <strong>${data.hifzProgress.completionPercent}%</strong>
              </div>
              <p style="color:var(--muted);font-size:13.5px;margin:0;">Paras completed: <strong>${data.hifzProgress.parasCompleted}</strong>
              ${data.hifzProgress.lastEvaluation ? ` &middot; Last evaluation: ${fmtDate(data.hifzProgress.lastEvaluation.evaluationDate)}` : ''}</p>
            </div>
          </div>
        </div>` : ''}
      `;
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
