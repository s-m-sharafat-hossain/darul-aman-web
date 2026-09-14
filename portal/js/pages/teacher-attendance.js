(function () {
  const user = window.DAA_API.requireAuth(['teacher', 'hifz_teacher']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Mark Attendance',
    pageSubtitle: 'Select a class and date to take attendance',
    activeKey: 'att',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let classes = [];
  let years = [];

  Promise.all([
    window.DAA_API.get('/academic/classes'),
    window.DAA_API.get('/academic/years'),
  ]).then(([cls, yrs]) => {
    classes = cls;
    years = yrs;
    const currentYear = years.find(y => y.isCurrent) || years[0];

    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label">Class</label>
            <select class="form-control" id="selClass">
              <option value="">Select class</option>
              ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Section</label>
            <select class="form-control" id="selSection"><option value="">All</option></select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Date</label>
            <input type="date" class="form-control" id="selDate" value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="col-md-3">
            <button class="btn btn-portal-primary w-100" id="loadStudentsBtn"><i class="fa-solid fa-magnifying-glass me-2"></i>Load Students</button>
          </div>
        </div>
      </div>
      <div id="rosterBox"></div>
    `;

    document.getElementById('selClass').addEventListener('change', (e) => {
      const cls = classes.find(c => String(c.id) === e.target.value);
      const sectionSel = document.getElementById('selSection');
      sectionSel.innerHTML = `<option value="">All</option>` + (cls?.sections || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    });

    document.getElementById('loadStudentsBtn').addEventListener('click', loadRoster);

    function loadRoster() {
      const classId = document.getElementById('selClass').value;
      const sectionId = document.getElementById('selSection').value;
      const date = document.getElementById('selDate').value;
      const box = document.getElementById('rosterBox');

      if (!classId || !date) {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-circle-info"></i>Choose a class and date first.</div></div>`;
        return;
      }
      box.innerHTML = `<div class="skeleton" style="height:160px;border-radius:14px;"></div>`;

      let qs = `classId=${classId}&limit=100`;
      if (sectionId) qs += `&sectionId=${sectionId}`;

      let existingLoadFailed = false;
      Promise.all([
        window.DAA_API.get(`/students?${qs}`),
        window.DAA_API.get(`/attendance/class?classId=${classId}${sectionId ? '&sectionId=' + sectionId : ''}&date=${date}`).catch(() => { existingLoadFailed = true; return []; }),
      ]).then(([students, existing]) => {
        const existingMap = Object.fromEntries((existing || []).map(r => [r.studentId, r.status]));

        if (!students.length) {
          box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i>No students found for this class/section.</div></div>`;
          return;
        }

        box.innerHTML = `
          <div class="p-card">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5 style="margin:0;"><i class="fa-solid fa-clipboard-check"></i> Roster — ${students.length} students</h5>
              <div class="auth-error" id="markMsg" style="margin:0;"></div>
            </div>
            ${existingLoadFailed ? `<div class="empty-state" style="padding:8px 0;color:var(--danger,#b3261e);"><i class="fa-solid fa-triangle-exclamation"></i> Couldn't load already-marked attendance for this date — statuses below default to Present and may not reflect existing records. Re-check before saving.</div>` : ''}
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>Roll</th><th>Name</th><th>Status</th></tr></thead>
                <tbody>
                  ${students.map(s => `
                    <tr>
                      <td>${s.rollNumber || '—'}</td>
                      <td>${U.escapeHtml(s.fullName)}</td>
                      <td>
                        <select class="form-control form-control-sm status-sel" data-student="${s.id}" style="width:140px;">
                          <option value="present" ${(!existingMap[s.id] || existingMap[s.id] === 'present') ? 'selected' : ''}>Present</option>
                          <option value="absent" ${existingMap[s.id] === 'absent' ? 'selected' : ''}>Absent</option>
                          <option value="late" ${existingMap[s.id] === 'late' ? 'selected' : ''}>Late</option>
                          <option value="leave" ${existingMap[s.id] === 'leave' ? 'selected' : ''}>On Leave</option>
                        </select>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <button class="btn btn-portal-primary" id="submitAttendance"><i class="fa-solid fa-floppy-disk me-2"></i>Save Attendance</button>
          </div>
        `;

        document.getElementById('submitAttendance').addEventListener('click', async () => {
          const btn = document.getElementById('submitAttendance');
          const msg = document.getElementById('markMsg');
          msg.classList.remove('show');
          btn.disabled = true;
          const entries = Array.from(document.querySelectorAll('.status-sel')).map(sel => ({
            studentId: sel.dataset.student,
            status: sel.value,
          }));
          try {
            await window.DAA_API.post('/attendance/mark', {
              classId: Number(classId),
              sectionId: sectionId ? Number(sectionId) : undefined,
              academicYearId: currentYear?.id,
              attendanceDate: date,
              entries,
            });
            msg.style.background = 'var(--ok-soft)';
            msg.style.color = 'var(--ok)';
            msg.textContent = 'Attendance saved successfully.';
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
      }).catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
    }
  }).catch((err) => {
    content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
  });
})();
