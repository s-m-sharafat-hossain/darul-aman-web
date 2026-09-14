(function () {
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Teachers & Staff',
    pageSubtitle: 'Manage teaching staff records',
    activeKey: 'teachers',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  window.DAA_API.get('/academic/departments')
    .then((departments) => {
      Promise.all([
        window.DAA_API.get('/academic/classes'),
        window.DAA_API.get('/academic/subjects'),
        window.DAA_API.get('/academic/years'),
      ])
        .then(([cls, subj, years]) => {
          renderShell(departments, cls, subj, years);
          loadTeachers();
        })
        .catch((err) => {
          content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
        });
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });

  let page = 1;
  const limit = 20;

  function renderShell(departments, classesList, subjectsList, years) {
    const currentYear = years.find(y => y.isCurrent) || years[0];
    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Teacher Type</label>
            <select class="form-control" id="filterType">
              <option value="">All</option>
              <option value="general">General</option>
              <option value="hifz">Hifz</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div class="col-md-6"></div>
          <div class="col-md-2">
            <button class="btn btn-portal-primary w-100" id="addBtn"><i class="fa-solid fa-plus me-1"></i>Add</button>
          </div>
        </div>
      </div>
      <div id="tableBox"></div>

      <div class="modal fade" id="addModal" tabindex="-1">
        <div class="modal-dialog modal-lg"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Add New Teacher / Staff</h5>
            <div class="auth-error" id="addMsg"></div>
            <form id="addForm">
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label">Full Name</label><input class="form-control" id="npFullName" required></div>
                <div class="col-md-3"><label class="form-label">Gender</label>
                  <select class="form-control" id="npGender"><option value="male">Male</option><option value="female">Female</option></select>
                </div>
                <div class="col-md-3"><label class="form-label">Teacher Type</label>
                  <select class="form-control" id="npType"><option value="general">General</option><option value="hifz">Hifz</option><option value="both">Both</option></select>
                </div>
                <div class="col-md-6"><label class="form-label">Department</label>
                  <select class="form-control" id="npDept"><option value="">—</option>${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}</select>
                </div>
                <div class="col-md-6"><label class="form-label">Specialization</label><input class="form-control" id="npSpec"></div>
                <div class="col-md-6"><label class="form-label">Email (optional)</label><input type="email" class="form-control" id="npEmail"></div>
                <div class="col-md-6"><label class="form-label">Phone (optional)</label><input class="form-control" id="npPhone"></div>
              </div>
              <button type="submit" class="btn btn-portal-primary mt-3" id="addSubmit">Create</button>
            </form>
          </div>
        </div></div>
      </div>

      <div class="modal fade" id="resultModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4 text-center">
            <i class="fa-solid fa-circle-check" style="font-size:32px;color:var(--ok);margin-bottom:10px;"></i>
            <h5>Teacher Account Created</h5>
            <p id="resultText" style="font-size:14px;"></p>
          </div>
        </div></div>
      </div>

      <div class="modal fade" id="assignModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Assign to Class</h5>
            <div class="auth-error" id="assignMsg"></div>
            <form id="assignForm">
              <input type="hidden" id="asTeacherId">
              <div class="row g-2">
                <div class="col-12"><label class="form-label">Class</label>
                  <select class="form-control" id="asClass" required><option value="">—</option>${classesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
                </div>
                <div class="col-12"><label class="form-label">Section (optional)</label><select class="form-control" id="asSection"><option value="">—</option></select></div>
                <div class="col-12"><label class="form-label">Subject (optional — leave blank for class teacher / all subjects)</label>
                  <select class="form-control" id="asSubject"><option value="">—</option>${subjectsList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
                </div>
                <div class="col-12">
                  <div class="form-check"><input class="form-check-input" type="checkbox" id="asIsClassTeacher"><label class="form-check-label" for="asIsClassTeacher">Assign as Class Teacher</label></div>
                </div>
              </div>
              <button type="submit" class="btn btn-portal-primary mt-3" id="assignSubmit">Assign</button>
            </form>
          </div>
        </div></div>
      </div>
    `;

    document.getElementById('filterType').addEventListener('change', () => { page = 1; loadTeachers(); });
    const addModal = new bootstrap.Modal(document.getElementById('addModal'));
    const resultModal = new bootstrap.Modal(document.getElementById('resultModal'));
    document.getElementById('addBtn').addEventListener('click', () => addModal.show());

    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('addMsg');
      const btn = document.getElementById('addSubmit');
      msg.classList.remove('show');
      btn.disabled = true;
      try {
        const result = await window.DAA_API.post('/teachers', {
          fullName: document.getElementById('npFullName').value.trim(),
          gender: document.getElementById('npGender').value,
          teacherType: document.getElementById('npType').value,
          departmentId: document.getElementById('npDept').value ? Number(document.getElementById('npDept').value) : undefined,
          specialization: document.getElementById('npSpec').value.trim() || undefined,
          email: document.getElementById('npEmail').value.trim() || undefined,
          phone: document.getElementById('npPhone').value.trim() || undefined,
        });
        addModal.hide();
        document.getElementById('addForm').reset();
        if (result.portalCredentials) {
          document.getElementById('resultText').innerHTML = `User Code: <strong>${result.portalCredentials.userCode}</strong><br>Temporary Password: <strong>${result.portalCredentials.temporaryPassword}</strong>`;
          resultModal.show();
        }
        loadTeachers();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('asClass').addEventListener('change', (e) => {
      const cls = classesList.find(c => String(c.id) === e.target.value);
      document.getElementById('asSection').innerHTML = `<option value="">—</option>` + (cls?.sections || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    });

    const assignModal = new bootstrap.Modal(document.getElementById('assignModal'));
    window.__openAssignTeacher = (teacherId) => {
      document.getElementById('assignMsg').classList.remove('show');
      document.getElementById('asTeacherId').value = teacherId;
      document.getElementById('assignForm').reset();
      document.getElementById('asSection').innerHTML = `<option value="">—</option>`;
      assignModal.show();
    };

    document.getElementById('assignForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('assignMsg');
      const btn = document.getElementById('assignSubmit');
      msg.classList.remove('show');
      if (!currentYear) {
        msg.textContent = 'No academic year is configured yet — set one up under Academic before assigning classes.';
        msg.classList.add('show');
        return;
      }
      btn.disabled = true;
      try {
        const teacherId = document.getElementById('asTeacherId').value;
        await window.DAA_API.post(`/teachers/${teacherId}/assignments`, {
          classId: Number(document.getElementById('asClass').value),
          sectionId: document.getElementById('asSection').value ? Number(document.getElementById('asSection').value) : undefined,
          subjectId: document.getElementById('asSubject').value ? Number(document.getElementById('asSubject').value) : undefined,
          academicYearId: currentYear.id,
          isClassTeacher: document.getElementById('asIsClassTeacher').checked,
        });
        assignModal.hide();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });
  }

  function loadTeachers() {
    const box = document.getElementById('tableBox');
    box.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;
    const type = document.getElementById('filterType').value;
    let qs = `page=${page}&limit=${limit}`;
    if (type) qs += `&teacherType=${type}`;

    window.DAA_API.get(`/teachers?${qs}`)
      .then((teachers) => {
        const meta = teachers._meta;
        const totalPages = meta ? meta.totalPages : null;
        const hasNext = meta ? page < totalPages : teachers.length >= limit;

        if (!teachers.length) {
          box.innerHTML = `<div class="p-card">
            <div class="empty-state"><i class="fa-solid fa-chalkboard-user"></i>No teachers found.</div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadTeachers(); });
          return;
        }
        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>Staff Code</th><th>Name</th><th>Type</th><th>Designation</th><th>Department</th><th></th></tr></thead>
                <tbody>
                  ${teachers.map(t => `
                    <tr>
                      <td>${t.staff?.staffCode || '—'}</td>
                      <td>${U.escapeHtml(t.staff?.fullName)}</td>
                      <td><span class="badge-status badge-muted">${t.teacherType}</span></td>
                      <td>${t.staff?.designation?.name || '—'}</td>
                      <td>${t.staff?.department?.name || '—'}</td>
                      <td><button class="btn btn-portal-outline btn-sm assign-teacher-btn" data-id="${t.id}"><i class="fa-solid fa-chalkboard me-1"></i>Assign</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
              <span style="font-size:12.5px;color:var(--muted);">${meta ? `Page ${page} of ${totalPages} &middot; ${meta.total} teacher(s)` : `Page ${page}`}</span>
              <div class="btn-group">
                <button class="btn btn-portal-outline btn-sm" id="prevPage" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <button class="btn btn-portal-outline btn-sm" id="nextPage" ${hasNext ? '' : 'disabled'}>Next</button>
              </div>
            </div>
          </div>
        `;
        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.addEventListener('click', () => { page--; loadTeachers(); });
        if (next) next.addEventListener('click', () => { page++; loadTeachers(); });
        document.querySelectorAll('.assign-teacher-btn').forEach(btn => {
          btn.addEventListener('click', () => window.__openAssignTeacher(btn.dataset.id));
        });
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
  }
})();
