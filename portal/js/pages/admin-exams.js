(function () {
  // exam.create/exam.edit are held by admin/principal (full) and teacher
  // (create+edit only, not approve/publish) — this page is scoped to the
  // unrestricted staff roles (admin/principal/super_admin) who can also
  // enter marks for any class without the per-assignment ownership check
  // teachers go through (see backend assertCanEnterMarksForSchedule).
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;
  const CAN_PUBLISH = ['admin', 'principal', 'super_admin'].includes(user.role);

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Exams & Results',
    pageSubtitle: 'Create exams, schedule subject papers, enter marks and publish results',
    activeKey: 'exams',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let years = [];
  let classes = [];
  let subjects = [];
  let exams = [];

  function loadAll() {
    return Promise.all([
      window.DAA_API.get('/academic/years'),
      window.DAA_API.get('/academic/classes'),
      window.DAA_API.get('/academic/subjects'),
      window.DAA_API.get('/exams'),
    ]).then(([y, c, s, e]) => { years = y; classes = c; subjects = s; exams = e; });
  }

  loadAll()
    .then(renderPage)
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });

  const EXAM_TYPES = ['monthly', 'half_yearly', 'annual', 'model_test', 'hifz_exam', 'class_test'];

  function renderPage() {
    const currentYear = years.find(y => y.isCurrent) || years[0];

    content.innerHTML = `
      <div class="p-card mb-3">
        <h5><i class="fa-solid fa-file-circle-plus me-1"></i> Create Exam</h5>
        <div class="auth-error" id="examMsg"></div>
        <form id="examForm" class="row g-2">
          <div class="col-md-4"><label class="form-label">Name</label><input class="form-control" id="exName" placeholder="First Term Exam 2026" required></div>
          <div class="col-md-3"><label class="form-label">Type</label>
            <select class="form-control" id="exType">${EXAM_TYPES.map(t => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`).join('')}</select>
          </div>
          <div class="col-md-3"><label class="form-label">Academic Year</label>
            <select class="form-control" id="exYear">${years.map(y => `<option value="${y.id}" ${currentYear && y.id === currentYear.id ? 'selected' : ''}>${U.escapeHtml(y.name)}</option>`).join('')}</select>
          </div>
          <div class="col-md-3"><label class="form-label">Start Date</label><input type="date" class="form-control" id="exStart"></div>
          <div class="col-md-3"><label class="form-label">End Date</label><input type="date" class="form-control" id="exEnd"></div>
          <div class="col-md-2"><button type="submit" class="btn btn-portal-primary w-100 mt-2" id="exSubmit">Create</button></div>
        </form>
      </div>

      <div id="examList"></div>

      <div class="modal fade" id="scheduleModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Add Subject Paper</h5>
            <div class="auth-error" id="schedMsg"></div>
            <form id="scheduleForm">
              <input type="hidden" id="scExamId">
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label">Class</label>
                  <select class="form-control" id="scClass" required><option value="">—</option>${classes.map(c => `<option value="${c.id}">${U.escapeHtml(c.name)}</option>`).join('')}</select>
                </div>
                <div class="col-md-6"><label class="form-label">Subject</label>
                  <select class="form-control" id="scSubject" required><option value="">—</option>${subjects.map(s => `<option value="${s.id}">${U.escapeHtml(s.name)}</option>`).join('')}</select>
                </div>
                <div class="col-md-6"><label class="form-label">Exam Date</label><input type="date" class="form-control" id="scDate" required></div>
                <div class="col-md-3"><label class="form-label">Full Marks</label><input type="number" class="form-control" id="scFull" value="100" required></div>
                <div class="col-md-3"><label class="form-label">Pass Marks</label><input type="number" class="form-control" id="scPass" value="33" required></div>
              </div>
              <button type="submit" class="btn btn-portal-primary mt-3" id="schedSubmit">Add Paper</button>
            </form>
          </div>
        </div></div>
      </div>

      <div class="modal fade" id="marksModal" tabindex="-1">
        <div class="modal-dialog modal-lg"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Enter Marks</h5>
            <div class="auth-error" id="marksMsg"></div>
            <div id="marksTableBox"><div class="skeleton" style="height:160px;border-radius:10px;"></div></div>
            <button class="btn btn-portal-primary mt-3" id="marksSubmit">Save Marks</button>
          </div>
        </div></div>
      </div>
    `;

    document.getElementById('examForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('examMsg');
      const btn = document.getElementById('exSubmit');
      msg.classList.remove('show');
      btn.disabled = true;
      try {
        await window.DAA_API.post('/exams', {
          name: document.getElementById('exName').value.trim(),
          examType: document.getElementById('exType').value,
          academicYearId: Number(document.getElementById('exYear').value),
          startDate: document.getElementById('exStart').value || undefined,
          endDate: document.getElementById('exEnd').value || undefined,
        });
        await loadAll();
        renderPage();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
        btn.disabled = false;
      }
    });

    renderExamList();

    const scheduleModal = new bootstrap.Modal(document.getElementById('scheduleModal'));
    document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('schedMsg');
      const btn = document.getElementById('schedSubmit');
      msg.classList.remove('show');
      btn.disabled = true;
      try {
        const examId = document.getElementById('scExamId').value;
        await window.DAA_API.post(`/exams/${examId}/schedules`, {
          classId: Number(document.getElementById('scClass').value),
          subjectId: Number(document.getElementById('scSubject').value),
          examDate: document.getElementById('scDate').value,
          fullMarks: Number(document.getElementById('scFull').value),
          passMarks: Number(document.getElementById('scPass').value),
        });
        scheduleModal.hide();
        await loadAll();
        renderPage();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });
    window.__openScheduleModal = (examId) => {
      document.getElementById('schedMsg').classList.remove('show');
      document.getElementById('scheduleForm').reset();
      document.getElementById('scExamId').value = examId;
      scheduleModal.show();
    };

    const marksModal = new bootstrap.Modal(document.getElementById('marksModal'));
    window.__openMarksModal = (scheduleId) => {
      document.getElementById('marksMsg').classList.remove('show');
      marksModal.show();
      const box = document.getElementById('marksTableBox');
      box.innerHTML = `<div class="skeleton" style="height:160px;border-radius:10px;"></div>`;
      window.DAA_API.get(`/exams/schedules/${scheduleId}/marks`)
        .then(({ schedule, students }) => {
          if (!students.length) {
            box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-graduate"></i>No students in this class yet.</div>`;
            document.getElementById('marksSubmit').style.display = 'none';
            return;
          }
          document.getElementById('marksSubmit').style.display = '';
          box.innerHTML = `
            <p style="font-size:12.5px;color:var(--muted);">Full marks: ${schedule.fullMarks} &middot; Pass marks: ${schedule.passMarks}</p>
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13px;">
                <thead><tr><th>Roll</th><th>Name</th><th>Written</th><th>Absent</th></tr></thead>
                <tbody>
                  ${students.map(s => `
                    <tr>
                      <td>${s.rollNumber || '—'}</td>
                      <td>${U.escapeHtml(s.fullName)}</td>
                      <td><input type="number" min="0" class="form-control form-control-sm mk-written" data-id="${s.id}" value="${s.mark?.writtenMarks ?? ''}" style="width:90px;"></td>
                      <td><input type="checkbox" class="form-check-input mk-absent" data-id="${s.id}" ${s.mark?.isAbsent ? 'checked' : ''}></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
          document.getElementById('marksSubmit').onclick = async () => {
            const msg = document.getElementById('marksMsg');
            const btn = document.getElementById('marksSubmit');
            msg.classList.remove('show');
            btn.disabled = true;
            try {
              const entries = students.map(s => {
                const isAbsent = document.querySelector(`.mk-absent[data-id="${s.id}"]`).checked;
                const writtenVal = document.querySelector(`.mk-written[data-id="${s.id}"]`).value;
                return {
                  studentId: s.id,
                  isAbsent,
                  writtenMarks: !isAbsent && writtenVal !== '' ? Number(writtenVal) : undefined,
                };
              });
              await window.DAA_API.post(`/exams/schedules/${scheduleId}/marks`, { entries });
              marksModal.hide();
            } catch (err) {
              msg.textContent = err.message;
              msg.classList.add('show');
            } finally {
              btn.disabled = false;
            }
          };
        })
        .catch((err) => {
          box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div>`;
          document.getElementById('marksSubmit').style.display = 'none';
        });
    };
  }

  function renderExamList() {
    const box = document.getElementById('examList');
    if (!exams.length) {
      box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-file-lines"></i>No exams created yet.</div></div>`;
      return;
    }
    box.innerHTML = exams.map(ex => `
      <div class="p-card mb-3">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong style="font-family:var(--font-display);color:var(--green-deep);">${U.escapeHtml(ex.name)}</strong>
            <span class="badge-status badge-muted ms-2">${ex.examType.replace(/_/g, ' ')}</span>
            ${ex.resultPublished ? '<span class="badge-status badge-ok ms-1">Results Published</span>' : ''}
          </div>
          <div>
            <button class="btn btn-portal-outline btn-sm add-sched-btn" data-id="${ex.id}"><i class="fa-solid fa-plus me-1"></i>Add Paper</button>
            ${CAN_PUBLISH && !ex.resultPublished ? `<button class="btn btn-portal-primary btn-sm publish-btn" data-id="${ex.id}">Publish Results</button>` : ''}
          </div>
        </div>
        ${ex.schedules && ex.schedules.length ? `
          <div class="table-responsive mt-2">
            <table class="table align-middle" style="font-size:13px;">
              <thead><tr><th>Class</th><th>Subject</th><th>Date</th><th>Full Marks</th><th></th></tr></thead>
              <tbody>
                ${ex.schedules.map(s => `
                  <tr>
                    <td>${s.class?.name || '—'}</td>
                    <td>${s.subject?.name || '—'}</td>
                    <td>${U.fmtDate(s.examDate)}</td>
                    <td>${s.fullMarks}</td>
                    <td><button class="btn btn-portal-outline btn-sm marks-btn" data-id="${s.id}">Enter Marks</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state" style="padding:10px 0;color:var(--muted);font-size:12.5px;">No subject papers scheduled yet.</div>`}
      </div>
    `).join('');

    document.querySelectorAll('.add-sched-btn').forEach(b => b.addEventListener('click', () => window.__openScheduleModal(b.dataset.id)));
    document.querySelectorAll('.marks-btn').forEach(b => b.addEventListener('click', () => window.__openMarksModal(b.dataset.id)));
    document.querySelectorAll('.publish-btn').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Publish results for this exam? Students and guardians will be able to see their results.')) return;
      b.disabled = true;
      try {
        await window.DAA_API.post(`/exams/${b.dataset.id}/publish`, {});
        await loadAll();
        renderPage();
      } catch (err) {
        alert(err.message);
        b.disabled = false;
      }
    }));
  }
})();
