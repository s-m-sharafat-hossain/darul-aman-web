(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Assignments',
    pageSubtitle: 'Homework and assignments set for your class',
    activeKey: 'assignments',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:160px;border-radius:14px;"></div>`;

  window.DAA_API.get('/dashboard/student')
    .then((dash) => {
      const studentId = dash.profile?.id;
      window.DAA_SHELL.setTopbarName(dash.profile?.fullName);
      if (!studentId) throw new Error('Student profile not found.');
      return Promise.all([
        window.DAA_API.get(`/assignments/student/${studentId}`),
        window.DAA_API.get('/academic/subjects').catch(() => []),
      ]);
    })
    .then(([assignments, subjects]) => {
      const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));
      if (!assignments.length) {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-book-open"></i>No assignments set for your class yet.</div></div>`;
        return;
      }
      const today = new Date().setHours(0, 0, 0, 0);
      content.innerHTML = `
        <div class="row g-3">
          ${assignments.map(a => {
            const overdue = a.dueDate && new Date(a.dueDate).setHours(0, 0, 0, 0) < today;
            return `
            <div class="col-md-6">
              <div class="p-card h-100">
                <div class="d-flex justify-content-between align-items-start">
                  <span class="badge-status badge-muted">${subjectMap[a.subjectId] || 'Subject'}</span>
                  <span class="badge-status ${a.type === 'homework' ? 'badge-gold' : 'badge-ok'}">${a.type}</span>
                </div>
                <h6 class="mt-2 mb-1" style="font-family:var(--font-display);">${U.escapeHtml(a.title)}</h6>
                ${a.instructions ? `<p style="font-size:13.5px;color:var(--muted);white-space:pre-wrap;">${U.escapeHtml(a.instructions)}</p>` : ''}
                <div style="font-size:12.5px;" class="${overdue ? 'text-danger' : 'text-muted'}">
                  ${a.dueDate ? `<i class="fa-solid fa-calendar-day me-1"></i>Due ${U.fmtDate(a.dueDate)}${overdue ? ' (overdue)' : ''}` : 'No due date'}
                  ${a.totalMarks ? ` &middot; ${a.totalMarks} marks` : ''}
                </div>
                ${a.attachmentUrl ? `<a href="${a.attachmentUrl}" target="_blank" rel="noopener" class="btn btn-portal-outline btn-sm mt-2"><i class="fa-solid fa-paperclip me-1"></i>Attachment</a>` : ''}
              </div>
            </div>
          `;
          }).join('')}
        </div>
      `;
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
