(function () {
  const user = window.DAA_API.requireAuth(['teacher', 'hifz_teacher', 'hifz_coordinator']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Assignments',
    pageSubtitle: 'Your teaching load and homework assignments',
    activeKey: 'routine',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let classes = [];
  let subjects = [];
  let homework = [];
  let homeworkLoadFailed = false;

  Promise.all([
    window.DAA_API.get('/teachers/my-assignments'),
    window.DAA_API.get('/academic/classes'),
    window.DAA_API.get('/academic/subjects'),
    window.DAA_API.get('/assignments/teacher/mine').catch(() => { homeworkLoadFailed = true; return []; }),
  ])
    .then(([teachingLoad, cls, subj, hw]) => {
      classes = cls;
      subjects = subj || [];
      homework = hw || [];
      renderPage(teachingLoad);
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });

  function classMap() { return Object.fromEntries(classes.map(c => [c.id, c])); }
  function subjectMap() { return Object.fromEntries(subjects.map(s => [s.id, s.name])); }

  function renderPage(teachingLoad) {
    const cMap = classMap();

    content.innerHTML = `
      <div class="p-card mb-3">
        <h5><i class="fa-solid fa-calendar-days"></i> My Teaching Load</h5>
        ${teachingLoad.length ? `
        <div class="row g-3">
          ${teachingLoad.map(a => {
            const cls = cMap[a.classId];
            const section = cls?.sections?.find(s => s.id === a.sectionId);
            return `
            <div class="col-md-6 col-lg-4">
              <div class="p-card" style="border-left:4px solid var(--green); box-shadow:none; border:1px solid rgba(4,57,39,.08);">
                <strong style="font-family:var(--font-display);color:var(--green-deep);">${cls?.name || 'Class ' + a.classId}${section ? ' — ' + section.name : ''}</strong>
                <ul class="list-clean" style="font-size:13px;">
                  <li><span>Subject</span><strong>${subjectMap()[a.subjectId] || 'All subjects'}</strong></li>
                  <li><span>Class Teacher</span><strong>${a.isClassTeacher ? 'Yes' : 'No'}</strong></li>
                </ul>
              </div>
            </div>`;
          }).join('')}
        </div>` : `<div class="empty-state"><i class="fa-solid fa-calendar-days"></i>No class assignments yet — ask the office to assign you to a class.</div>`}
      </div>

      <div class="p-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 style="margin:0;"><i class="fa-solid fa-file-pen"></i> Homework Assignments</h5>
          <button class="btn btn-portal-primary btn-sm" id="newAssignBtn"><i class="fa-solid fa-plus me-1"></i>New Assignment</button>
        </div>
        <div id="homeworkList"></div>
      </div>

      <div class="modal fade" id="assignModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">New Assignment</h5>
            <div class="auth-error" id="assignMsg"></div>
            <div class="mb-2">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" id="asTitle" placeholder="e.g. Surah Al-Baqarah — Ayah 1-20 memorization">
            </div>
            <div class="mb-2">
              <label class="form-label">Description</label>
              <textarea class="form-control" id="asDesc" rows="3" placeholder="Instructions for students (optional)"></textarea>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-6">
                <label class="form-label">Class</label>
                <select class="form-control" id="asClass">
                  <option value="">Select class</option>
                  ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">Section</label>
                <select class="form-control" id="asSection"><option value="">All</option></select>
              </div>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-6">
                <label class="form-label">Subject *</label>
                <select class="form-control" id="asSubject" required>
                  <option value="">Select subject</option>
                  ${subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">Due Date</label>
                <input type="date" class="form-control" id="asDue">
              </div>
            </div>
            <button class="btn btn-portal-primary w-100 mt-2" id="asSubmit"><i class="fa-solid fa-paper-plane me-2"></i>Assign to Class</button>
          </div>
        </div></div>
      </div>
    `;

    renderHomeworkList();

    document.getElementById('asClass').addEventListener('change', (e) => {
      const cls = classes.find(c => String(c.id) === e.target.value);
      const sectionSel = document.getElementById('asSection');
      sectionSel.innerHTML = `<option value="">All</option>` + (cls?.sections || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    });

    const modalEl = document.getElementById('assignModal');
    const modal = new bootstrap.Modal(modalEl);
    document.getElementById('newAssignBtn').addEventListener('click', () => {
      document.getElementById('assignMsg').classList.remove('show');
      modal.show();
    });

    document.getElementById('asSubmit').addEventListener('click', async () => {
      const msg = document.getElementById('assignMsg');
      const btn = document.getElementById('asSubmit');
      const title = document.getElementById('asTitle').value.trim();
      const classId = document.getElementById('asClass').value;
      const subjectId = document.getElementById('asSubject').value;
      const dueDate = document.getElementById('asDue').value;

      if (!title || !classId || !subjectId) {
        msg.textContent = 'Title, Class and Subject are required.';
        msg.classList.add('show');
        return;
      }

      btn.disabled = true;
      try {
        const created = await window.DAA_API.post('/assignments', {
          title,
          instructions: document.getElementById('asDesc').value.trim() || undefined,
          classId: Number(classId),
          sectionId: document.getElementById('asSection').value ? Number(document.getElementById('asSection').value) : undefined,
          subjectId: Number(subjectId),
          dueDate: dueDate || undefined,
        });
        homework = [created, ...homework];
        renderHomeworkList();
        modal.hide();
        document.getElementById('asTitle').value = '';
        document.getElementById('asDesc').value = '';
        document.getElementById('asDue').value = '';
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });
  }

  function renderHomeworkList() {
    const box = document.getElementById('homeworkList');
    const cMap = classMap();
    const sMap = subjectMap();

    if (homeworkLoadFailed) {
      box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>Couldn't load your assignments. <a href="#" onclick="location.reload();return false;">Try again</a>.</div>`;
      return;
    }
    if (!homework.length) {
      box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No assignments given yet — click "New Assignment" to create one.</div>`;
      return;
    }

    box.innerHTML = `<div class="table-responsive"><table class="table align-middle" style="font-size:13.5px;">
      <thead><tr><th>Title</th><th>Class</th><th>Subject</th><th>Due Date</th><th>Assigned On</th></tr></thead>
      <tbody>
        ${homework.map(a => {
          const cls = cMap[a.classId];
          const section = cls?.sections?.find(s => s.id === a.sectionId);
          return `<tr>
            <td>${U.escapeHtml(a.title)}</td>
            <td>${cls?.name || '—'}${section ? ' — ' + section.name : ''}</td>
            <td>${sMap[a.subjectId] || 'All subjects'}</td>
            <td>${a.dueDate ? U.fmtDate(a.dueDate) : '—'}</td>
            <td>${U.fmtDate(a.createdAt)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }
})();
