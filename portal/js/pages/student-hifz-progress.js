(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Hifz Progress',
    pageSubtitle: 'Your Hifz-ul-Quran memorization journey',
    activeKey: 'hifz',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;

  const TOTAL_PARAS = 30;

  function qualityBadge(quality) {
    const map = {
      excellent: ['badge-ok', 'Excellent'],
      good: ['badge-ok', 'Good'],
      average: ['badge-warn', 'Average'],
      weak: ['badge-danger', 'Needs Work'],
    };
    if (!quality) return '<span class="badge-status badge-muted">—</span>';
    const [cls, label] = map[quality] || ['badge-muted', quality];
    return `<span class="badge-status ${cls}">${label}</span>`;
  }

  function paraGrid(completedSet, currentPara, totalParas) {
    let cells = '';
    for (let i = 1; i <= totalParas; i++) {
      let cls = 'para-cell-pending';
      if (completedSet.has(i)) cls = 'para-cell-done';
      else if (i === currentPara) cls = 'para-cell-current';
      cells += `<div class="para-cell ${cls}" title="Para ${i}">${i}</div>`;
    }
    return `<div class="para-grid">${cells}</div>`;
  }

  // The backend returns the raw HifzEnrollment record (with nested
  // dailyEvaluations / paraCompletions / exams / certificate / teacher) —
  // not a pre-computed "summary" object — so derive the view model here.
  function render(enrollment) {
    const completedParaNumbers = (enrollment.paraCompletions || []).map((pc) => pc.paraId);
    const completedSet = new Set(completedParaNumbers);
    const evaluations = enrollment.dailyEvaluations || [];
    const teacherName = enrollment.teacher?.staff?.fullName;

    content.innerHTML = `
      <div class="row g-3 mb-1">
        <div class="col-6 col-lg-3">
          <div class="stat-card info">
            <div class="stat-icon"><i class="fa-solid fa-book-quran"></i></div>
            <div><div class="stat-value">${Number(enrollment.completionPercent ?? 0)}%</div><div class="stat-label">Overall Completion</div></div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="stat-card gold">
            <div class="stat-icon"><i class="fa-solid fa-layer-group"></i></div>
            <div><div class="stat-value">${enrollment.parasCompleted ?? completedParaNumbers.length}/${TOTAL_PARAS}</div><div class="stat-label">Paras Completed</div></div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="stat-icon"><i class="fa-solid fa-bookmark"></i></div>
            <div><div class="stat-value" style="font-size:16px;">Para ${enrollment.currentParaId ?? '—'}</div><div class="stat-label">Currently On</div></div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="stat-card danger">
            <div class="stat-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
            <div><div class="stat-value" style="font-size:16px;">${teacherName ? U.escapeHtml(teacherName) : '—'}</div><div class="stat-label">Hifz Teacher</div></div>
          </div>
        </div>
      </div>

      <div class="p-card mt-1">
        <h5><i class="fa-solid fa-table-cells"></i> Para-by-Para Progress</h5>
        ${paraGrid(completedSet, enrollment.currentParaId, TOTAL_PARAS)}
        <div class="para-legend">
          <span><i class="para-dot para-cell-done"></i> Completed</span>
          <span><i class="para-dot para-cell-current"></i> In Progress</span>
          <span><i class="para-dot para-cell-pending"></i> Upcoming</span>
        </div>
      </div>

      ${enrollment.certificate ? `<div class="p-card mt-1">
        <h5><i class="fa-solid fa-certificate"></i> Certificate</h5>
        <p style="margin:0;font-size:13.5px;">Issued ${U.fmtDate(enrollment.certificate.issuedDate)} — Certificate No. ${U.escapeHtml(enrollment.certificate.certificateNumber)}</p>
      </div>` : ''}

      <div class="p-card mt-1">
        <h5><i class="fa-solid fa-clipboard-check"></i> Daily Evaluation History</h5>
        ${evaluations.length ? `<div class="table-responsive"><table class="table align-middle" style="font-size:13.5px;">
          <thead><tr><th>Date</th><th>Sabak (New)</th><th>Sabqi (Recent)</th><th>Manzil (Old)</th><th>Remarks</th></tr></thead>
          <tbody>
            ${evaluations.map(ev => `<tr>
              <td>${U.fmtDate(ev.evaluationDate)}</td>
              <td>${ev.sabakParaId ? 'Para ' + ev.sabakParaId : '—'} ${qualityBadge(ev.sabakQuality)}</td>
              <td>${ev.sabqiRange ? U.escapeHtml(ev.sabqiRange) : '—'} ${qualityBadge(ev.sabqiQuality)}</td>
              <td>${ev.manzilRange ? U.escapeHtml(ev.manzilRange) : '—'} ${qualityBadge(ev.manzilQuality)}</td>
              <td>${ev.teacherRemarks ? U.escapeHtml(ev.teacherRemarks) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No evaluations recorded yet.</div>`}
      </div>
    `;
  }

  window.DAA_API.get('/dashboard/student')
    .then((dash) => {
      const studentId = dash.profile?.id;
      window.DAA_SHELL.setTopbarName(dash.profile?.fullName);
      if (!studentId) throw new Error('Student profile not found.');
      return window.DAA_API.get(`/hifz/student/${studentId}/overview`);
    })
    .then(render)
    .catch((err) => {
      if (err.status === 404) {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-book-quran"></i>No Hifz records found for your profile yet.</div></div>`;
        return;
      }
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
