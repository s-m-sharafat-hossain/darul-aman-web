(function () {
  // hifz.create/view are held by admin/principal (full) and hifz_teacher
  // (create/edit/view on their own roster only) — see backend
  // prisma/seed.js ROLE_PERMISSION_MAP. This school-wide analytics +
  // enrollment page is admin-tier; hifz_teacher's own working page is
  // "Hifz Evaluation" (teacher-hifz-evaluation.js), which stays unchanged.
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;
  const CAN_ENROLL = true;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Hifz Management',
    pageSubtitle: 'Enroll students into the Hifz program and track progress',
    activeKey: 'hifz',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let selectedStudent = null;
  let hifzTeachers = [];

  const loaders = [window.DAA_API.get('/hifz/analytics').catch(() => null)];
  if (CAN_ENROLL) loaders.push(window.DAA_API.get('/teachers?teacherType=hifz&limit=100').catch(() => []));

  Promise.all(loaders).then(([analytics, teachers]) => {
    hifzTeachers = teachers || [];
    renderPage(analytics);
  });

  function renderPage(analytics) {
    content.innerHTML = `
      <div class="row g-3 mb-1" id="statCards">
        ${analytics ? `
          <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-users"></i></div><div><div class="stat-value">${analytics.totalStudents}</div><div class="stat-label">Enrolled</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-spinner"></i></div><div><div class="stat-value">${analytics.ongoing}</div><div class="stat-label">Ongoing</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card gold"><div class="stat-icon"><i class="fa-solid fa-crown"></i></div><div><div class="stat-value">${analytics.completed}</div><div class="stat-label">Completed Hifz</div></div></div></div>
          <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div><div><div class="stat-value">${analytics.avgCompletion}%</div><div class="stat-label">Avg. Completion</div></div></div></div>
        ` : `<div class="col-12"><div class="p-card"><div class="empty-state"><i class="fa-solid fa-chart-simple"></i>Analytics aren't available for your role — showing your own roster only. Visit "Hifz Evaluation" to work with your assigned students.</div></div></div>`}
      </div>

      ${analytics && Object.keys(analytics.byTeacher || {}).length ? `
      <div class="p-card mt-2">
        <h5><i class="fa-solid fa-chalkboard-user me-1"></i> Students per Hifz Teacher</h5>
        <ul class="list-clean">
          ${Object.entries(analytics.byTeacher).map(([name, count]) => `<li><span>${U.escapeHtml(name)}</span><strong>${count}</strong></li>`).join('')}
        </ul>
      </div>` : ''}

      ${CAN_ENROLL ? `
      <div class="p-card mt-3">
        <h5><i class="fa-solid fa-user-plus me-1"></i> Enroll a Student in the Hifz Program</h5>
        <div class="auth-error" id="enrollMsg"></div>
        <div class="mb-2">
          <label class="form-label">Student</label>
          <div class="input-group">
            <input class="form-control" id="hzStudentSearch" placeholder="Search by name, roll or student code">
            <button class="btn btn-portal-outline" type="button" id="hzStudentSearchBtn">Search</button>
          </div>
          <div id="hzStudentResults" class="mt-1"></div>
          <div id="hzStudentSelected" class="mt-1" style="font-size:13px;"></div>
        </div>
        <form id="enrollForm" class="row g-2">
          <div class="col-md-4"><label class="form-label">Assigned Hifz Teacher</label>
            <select class="form-control" id="hzTeacher"><option value="">— Unassigned —</option>${hifzTeachers.map(t => `<option value="${t.id}">${U.escapeHtml(t.staff?.fullName)}</option>`).join('')}</select>
          </div>
          <div class="col-md-4"><label class="form-label">Start Date</label><input type="date" class="form-control" id="hzStart" value="${new Date().toISOString().slice(0, 10)}" required></div>
          <div class="col-md-4"><label class="form-label">Target Completion (optional)</label><input type="date" class="form-control" id="hzTarget"></div>
          <div class="col-md-4"><button type="submit" class="btn btn-portal-primary w-100 mt-2" id="enrollSubmit">Enroll</button></div>
        </form>
      </div>
      ` : ''}
    `;

    if (!CAN_ENROLL) return;

    function runStudentSearch() {
      const q = document.getElementById('hzStudentSearch').value.trim();
      const resultsBox = document.getElementById('hzStudentResults');
      if (!q) { resultsBox.innerHTML = ''; return; }
      resultsBox.innerHTML = `<div style="font-size:12.5px;color:var(--muted);">Searching…</div>`;
      window.DAA_API.get(`/students?search=${encodeURIComponent(q)}&limit=8`)
        .then((students) => {
          if (!students.length) {
            resultsBox.innerHTML = `<div style="font-size:12.5px;color:var(--muted);">No matching students.</div>`;
            return;
          }
          resultsBox.innerHTML = students.map(s => `
            <button type="button" class="btn btn-portal-outline btn-sm me-1 mb-1 pick-student-btn" data-id="${s.id}" data-name="${U.escapeHtml(s.fullName)}" data-code="${s.studentCode}">
              ${U.escapeHtml(s.fullName)} (${s.studentCode})${s.isHifzStudent ? ' — already flagged Hifz' : ''}
            </button>
          `).join('');
          resultsBox.querySelectorAll('.pick-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              selectedStudent = { id: btn.dataset.id, name: btn.dataset.name, code: btn.dataset.code };
              document.getElementById('hzStudentSelected').innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--ok);"></i> Selected: <strong>${U.escapeHtml(selectedStudent.name)}</strong> (${selectedStudent.code})`;
              resultsBox.innerHTML = '';
              document.getElementById('hzStudentSearch').value = '';
            });
          });
        })
        .catch((err) => {
          resultsBox.innerHTML = `<div style="font-size:12.5px;color:var(--danger);">${err.message}</div>`;
        });
    }
    document.getElementById('hzStudentSearchBtn').addEventListener('click', runStudentSearch);
    document.getElementById('hzStudentSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runStudentSearch(); }
    });

    document.getElementById('enrollForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('enrollMsg');
      const btn = document.getElementById('enrollSubmit');
      msg.classList.remove('show');
      if (!selectedStudent) {
        msg.textContent = 'Search for and select a student first.';
        msg.classList.add('show');
        return;
      }
      btn.disabled = true;
      try {
        await window.DAA_API.post('/hifz/enroll', {
          studentId: selectedStudent.id,
          assignedTeacherId: document.getElementById('hzTeacher').value || undefined,
          startDate: document.getElementById('hzStart').value,
          targetCompletionDate: document.getElementById('hzTarget').value || undefined,
        });
        document.getElementById('enrollForm').reset();
        document.getElementById('hzStart').value = new Date().toISOString().slice(0, 10);
        selectedStudent = null;
        document.getElementById('hzStudentSelected').innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--ok);"></i> Enrolled successfully. Remember to also mark the student as a Hifz student on their profile (Students → Edit) if not already set.';
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });
  }
})();
