(function () {
  const user = window.DAA_API.requireAuth(['hifz_teacher', 'hifz_coordinator']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Hifz Evaluation',
    pageSubtitle: 'Record daily Sabaq, Sabqi & Manzil evaluations for your students',
    activeKey: 'hifz',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  const QUALITY_OPTIONS = [
    ['excellent', 'Excellent'],
    ['good', 'Good'],
    ['average', 'Average'],
    ['weak', 'Needs Work'],
  ];

  function qualitySelect(cls, current) {
    return `<select class="form-control form-control-sm ${cls}" style="width:120px;">
      <option value="">—</option>
      ${QUALITY_OPTIONS.map(([v, l]) => `<option value="${v}" ${current === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>`;
  }

  // Hifz teachers only ever evaluate students directly assigned to them
  // (assignedTeacherId on the enrollment) — there's no class/section
  // picker here because that scoping is enforced server-side via the
  // roster endpoint, not by a client-supplied classId.
  window.DAA_API.get('/hifz/my-roster')
    .then((roster) => {
      if (!roster.length) {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i>No students are currently assigned to you.</div></div>`;
        return;
      }

      content.innerHTML = `
        <div class="p-card mb-3">
          <div class="row g-2 align-items-end">
            <div class="col-md-4">
              <label class="form-label">Date</label>
              <input type="date" class="form-control" id="selDate" value="${new Date().toISOString().slice(0, 10)}">
            </div>
          </div>
        </div>
        <div class="p-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 style="margin:0;"><i class="fa-solid fa-book-quran"></i> Your Roster — ${roster.length} students</h5>
            <div class="auth-error" id="evalMsg" style="margin:0;"></div>
          </div>
          <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">Fill in only the students you evaluated today — rows left completely blank are skipped when saving.</p>
          <div class="table-responsive">
            <table class="table align-middle" style="font-size:13.5px;">
              <thead><tr><th>Name</th><th>Sabak Para</th><th>Sabak Quality</th><th>Sabqi Range</th><th>Sabqi Quality</th><th>Manzil Range</th><th>Manzil Quality</th><th>Remarks</th></tr></thead>
              <tbody>
                ${roster.map(e => `
                <tr data-student="${e.student.id}">
                  <td>${U.escapeHtml(e.student.fullName)}${e.needsAttention ? ' <span class="badge-status badge-warn" style="font-size:10px;">Needs attention</span>' : ''}</td>
                  <td><input type="number" min="1" max="30" class="form-control form-control-sm eval-sabak-para" style="width:70px;"></td>
                  <td>${qualitySelect('eval-sabak-quality')}</td>
                  <td><input type="text" class="form-control form-control-sm eval-sabqi-range" style="width:110px;" placeholder="e.g. Para 5-6"></td>
                  <td>${qualitySelect('eval-sabqi-quality')}</td>
                  <td><input type="text" class="form-control form-control-sm eval-manzil-range" style="width:110px;" placeholder="e.g. Para 1-3"></td>
                  <td>${qualitySelect('eval-manzil-quality')}</td>
                  <td><input type="text" class="form-control form-control-sm eval-remarks" style="width:150px;" placeholder="Optional"></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <button class="btn btn-portal-primary" id="submitEval"><i class="fa-solid fa-floppy-disk me-2"></i>Save Evaluations</button>
        </div>
      `;

      document.getElementById('submitEval').addEventListener('click', async () => {
        const btn = document.getElementById('submitEval');
        const msg = document.getElementById('evalMsg');
        const date = document.getElementById('selDate').value;
        msg.classList.remove('show');

        if (!date) {
          msg.style.background = 'var(--warn-soft)';
          msg.style.color = 'var(--warn)';
          msg.textContent = 'Choose a date first.';
          msg.classList.add('show');
          return;
        }

        const entries = Array.from(document.querySelectorAll('tbody tr')).map((row) => {
          const sabakParaId = row.querySelector('.eval-sabak-para').value;
          const sabakQuality = row.querySelector('.eval-sabak-quality').value;
          const sabqiRange = row.querySelector('.eval-sabqi-range').value.trim();
          const sabqiQuality = row.querySelector('.eval-sabqi-quality').value;
          const manzilRange = row.querySelector('.eval-manzil-range').value.trim();
          const manzilQuality = row.querySelector('.eval-manzil-quality').value;
          const teacherRemarks = row.querySelector('.eval-remarks').value.trim();

          const hasAnything = sabakParaId || sabakQuality || sabqiRange || sabqiQuality || manzilRange || manzilQuality || teacherRemarks;
          if (!hasAnything) return null;

          return {
            studentId: row.dataset.student,
            sabakParaId: sabakParaId ? Number(sabakParaId) : undefined,
            sabakQuality: sabakQuality || undefined,
            sabqiRange: sabqiRange || undefined,
            sabqiQuality: sabqiQuality || undefined,
            manzilRange: manzilRange || undefined,
            manzilQuality: manzilQuality || undefined,
            teacherRemarks: teacherRemarks || undefined,
          };
        }).filter(Boolean);

        if (!entries.length) {
          msg.style.background = 'var(--warn-soft)';
          msg.style.color = 'var(--warn)';
          msg.textContent = 'Fill in at least one student before saving.';
          msg.classList.add('show');
          return;
        }

        btn.disabled = true;
        try {
          const result = await window.DAA_API.post('/hifz/evaluations/bulk', { evaluationDate: date, entries });
          msg.style.background = 'var(--ok-soft)';
          msg.style.color = 'var(--ok)';
          msg.textContent = `Saved ${result.saved} evaluation(s).` + (result.skipped?.length ? ` ${result.skipped.length} skipped (not assigned to you).` : '');
          msg.classList.add('show');
        } catch (err) {
          msg.style.background = 'var(--danger-soft)';
          msg.style.color = 'var(--danger)';
          msg.textContent = err.message;
          msg.classList.add('show');
        } finally {
          btn.disabled = false;
        }
      });
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
