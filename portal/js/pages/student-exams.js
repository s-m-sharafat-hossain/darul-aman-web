(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Exams & Results',
    pageSubtitle: 'Your published exam results',
    activeKey: 'exam',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;

  window.DAA_API.get('/dashboard/student')
    .then((dash) => {
      const studentId = dash.profile?.id;
      window.DAA_SHELL.setTopbarName(dash.profile?.fullName);
      if (!studentId) throw new Error('Student profile not found.');
      return window.DAA_API.get(`/exams/student/${studentId}/results`);
    })
    .then((results) => {
      if (!results.length) {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-file-lines"></i>No published results yet.</div></div>`;
        return;
      }
      content.innerHTML = `
        <div class="row g-3">
          ${results.map(r => `
            <div class="col-md-6 col-lg-4">
              <div class="p-card" style="border-left:4px solid ${r.isPass === false ? 'var(--danger)' : 'var(--green)'};">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <strong style="font-family:var(--font-display);color:var(--green-deep);">${U.escapeHtml(r.exam?.name || 'Exam')}</strong>
                  <span class="badge-status ${r.isPass === false ? 'badge-danger' : 'badge-ok'}">${r.isPass === false ? 'Failed' : 'Passed'}</span>
                </div>
                <ul class="list-clean" style="font-size:13.5px;">
                  <li><span>Type</span><strong>${r.exam?.examType || '—'}</strong></li>
                  <li><span>Total Obtained</span><strong>${r.totalObtained ?? '—'} / ${r.totalFull ?? '—'}</strong></li>
                  <li><span>Grade</span><strong>${r.grade || '—'}</strong></li>
                  ${r.gpa != null ? `<li><span>GPA</span><strong>${r.gpa}</strong></li>` : ''}
                  ${r.positionInClass ? `<li><span>Class Position</span><strong>${r.positionInClass}</strong></li>` : ''}
                </ul>
                ${r.remarks ? `<p style="font-size:12.5px;color:var(--muted);margin-top:6px;">${U.escapeHtml(r.remarks)}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
