(function () {
  // academic.create is granted to admin/principal (and bypassed by super_admin) —
  // see backend prisma/seed.js ROLE_PERMISSION_MAP. Other admin-folder roles
  // (accountant/receptionist/librarian) have no academic.* permission at all.
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Academic Setup',
    pageSubtitle: 'Departments, academic years, classes, sections & subjects',
    activeKey: 'academic',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let departments = [];
  let years = [];
  let classes = [];
  let subjects = [];

  function loadAll() {
    return Promise.all([
      window.DAA_API.get('/academic/departments'),
      window.DAA_API.get('/academic/years'),
      window.DAA_API.get('/academic/classes'),
      window.DAA_API.get('/academic/subjects'),
    ]).then(([d, y, c, s]) => {
      departments = d; years = y; classes = c; subjects = s;
    });
  }

  loadAll()
    .then(renderPage)
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });

  function deptOptions(selectedId) {
    return `<option value="">—</option>` + departments.map(d => `<option value="${d.id}" ${String(d.id) === String(selectedId) ? 'selected' : ''}>${U.escapeHtml(d.name)}</option>`).join('');
  }

  function renderPage() {
    content.innerHTML = `
      <div class="row g-3">
        <div class="col-lg-6">
          <div class="p-card">
            <h5><i class="fa-solid fa-calendar-days me-1"></i> Academic Years</h5>
            <div class="auth-error" id="yearMsg"></div>
            <div class="table-responsive mb-3">
              <table class="table align-middle" style="font-size:13px;">
                <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Current</th></tr></thead>
                <tbody>
                  ${years.map(y => `<tr><td>${U.escapeHtml(y.name)}</td><td>${new Date(y.startDate).toLocaleDateString()}</td><td>${new Date(y.endDate).toLocaleDateString()}</td><td>${y.isCurrent ? '<span class="badge-status badge-ok">Current</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">No academic years yet.</td></tr>'}
                </tbody>
              </table>
            </div>
            <form id="yearForm" class="row g-2">
              <div class="col-md-4"><label class="form-label">Name</label><input class="form-control" id="yName" placeholder="2026-2027" required></div>
              <div class="col-md-4"><label class="form-label">Start Date</label><input type="date" class="form-control" id="yStart" required></div>
              <div class="col-md-4"><label class="form-label">End Date</label><input type="date" class="form-control" id="yEnd" required></div>
              <div class="col-md-8">
                <div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="yCurrent"><label class="form-check-label" for="yCurrent">Set as current academic year</label></div>
              </div>
              <div class="col-md-4"><button type="submit" class="btn btn-portal-primary w-100 mt-2" id="ySubmit">Add Year</button></div>
            </form>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="p-card">
            <h5><i class="fa-solid fa-building me-1"></i> Departments</h5>
            <div class="auth-error" id="deptMsg"></div>
            <div class="table-responsive mb-3">
              <table class="table align-middle" style="font-size:13px;">
                <thead><tr><th>Name</th><th>Slug</th></tr></thead>
                <tbody>
                  ${departments.map(d => `<tr><td>${U.escapeHtml(d.name)}</td><td>${U.escapeHtml(d.slug)}</td></tr>`).join('') || '<tr><td colspan="2" class="text-muted">No departments yet.</td></tr>'}
                </tbody>
              </table>
            </div>
            <form id="deptForm" class="row g-2">
              <div class="col-md-6"><label class="form-label">Name</label><input class="form-control" id="dName" placeholder="Hifz Department" required></div>
              <div class="col-md-6"><label class="form-label">Slug</label><input class="form-control" id="dSlug" placeholder="hifz" required></div>
              <div class="col-md-4"><button type="submit" class="btn btn-portal-primary w-100 mt-2" id="dSubmit">Add Department</button></div>
            </form>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="p-card">
            <h5><i class="fa-solid fa-school me-1"></i> Classes & Sections</h5>
            <div class="auth-error" id="classMsg"></div>
            <div class="table-responsive mb-3">
              <table class="table align-middle" style="font-size:13px;">
                <thead><tr><th>Class</th><th>Department</th><th>Sections</th></tr></thead>
                <tbody>
                  ${classes.map(c => `<tr><td>${U.escapeHtml(c.name)}</td><td>${c.department?.name || '—'}</td><td>${(c.sections || []).map(s => U.escapeHtml(s.name)).join(', ') || '<span class="text-muted">none</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="text-muted">No classes yet.</td></tr>'}
                </tbody>
              </table>
            </div>
            <form id="classForm" class="row g-2 mb-3">
              <div class="col-md-5"><label class="form-label">Class Name</label><input class="form-control" id="cName" placeholder="Class 5" required></div>
              <div class="col-md-5"><label class="form-label">Department</label><select class="form-control" id="cDept">${deptOptions()}</select></div>
              <div class="col-md-2"><button type="submit" class="btn btn-portal-primary w-100 mt-2" id="cSubmit">Add</button></div>
            </form>
            <hr>
            <form id="sectionForm" class="row g-2">
              <div class="col-md-5"><label class="form-label">Add Section to Class</label>
                <select class="form-control" id="sClass" required><option value="">—</option>${classes.map(c => `<option value="${c.id}">${U.escapeHtml(c.name)}</option>`).join('')}</select>
              </div>
              <div class="col-md-3"><label class="form-label">Section Name</label><input class="form-control" id="sName" placeholder="A" required></div>
              <div class="col-md-2"><label class="form-label">Capacity</label><input type="number" min="1" class="form-control" id="sCapacity"></div>
              <div class="col-md-2"><button type="submit" class="btn btn-portal-outline w-100 mt-2" id="sSubmit">Add</button></div>
            </form>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="p-card">
            <h5><i class="fa-solid fa-book me-1"></i> Subjects</h5>
            <div class="auth-error" id="subjMsg"></div>
            <div class="table-responsive mb-3">
              <table class="table align-middle" style="font-size:13px;">
                <thead><tr><th>Name</th><th>Code</th><th>Department</th><th>Hifz</th></tr></thead>
                <tbody>
                  ${subjects.map(s => `<tr><td>${U.escapeHtml(s.name)}</td><td>${s.code || '—'}</td><td>${departments.find(d => d.id === s.departmentId)?.name || '—'}</td><td>${s.isHifzSubject ? 'Yes' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">No subjects yet.</td></tr>'}
                </tbody>
              </table>
            </div>
            <form id="subjForm" class="row g-2">
              <div class="col-md-4"><label class="form-label">Name</label><input class="form-control" id="subName" placeholder="Arabic" required></div>
              <div class="col-md-3"><label class="form-label">Code</label><input class="form-control" id="subCode" placeholder="ARB"></div>
              <div class="col-md-3"><label class="form-label">Department</label><select class="form-control" id="subDept">${deptOptions()}</select></div>
              <div class="col-md-2">
                <label class="form-label d-block">Hifz?</label>
                <div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="subHifz"></div>
              </div>
              <div class="col-md-3"><button type="submit" class="btn btn-portal-primary w-100 mt-2" id="subSubmit">Add Subject</button></div>
            </form>
          </div>
        </div>
      </div>
    `;

    wireForm('yearForm', 'ySubmit', 'yearMsg', () => ({
      name: document.getElementById('yName').value.trim(),
      startDate: document.getElementById('yStart').value,
      endDate: document.getElementById('yEnd').value,
      isCurrent: document.getElementById('yCurrent').checked,
    }), '/academic/years');

    wireForm('deptForm', 'dSubmit', 'deptMsg', () => ({
      name: document.getElementById('dName').value.trim(),
      slug: document.getElementById('dSlug').value.trim(),
    }), '/academic/departments');

    wireForm('classForm', 'cSubmit', 'classMsg', () => ({
      name: document.getElementById('cName').value.trim(),
      departmentId: document.getElementById('cDept').value ? Number(document.getElementById('cDept').value) : undefined,
    }), '/academic/classes');

    wireForm('sectionForm', 'sSubmit', 'classMsg', () => ({
      classId: Number(document.getElementById('sClass').value),
      name: document.getElementById('sName').value.trim(),
      capacity: document.getElementById('sCapacity').value ? Number(document.getElementById('sCapacity').value) : undefined,
    }), '/academic/sections');

    wireForm('subjForm', 'subSubmit', 'subjMsg', () => ({
      name: document.getElementById('subName').value.trim(),
      code: document.getElementById('subCode').value.trim() || undefined,
      departmentId: document.getElementById('subDept').value ? Number(document.getElementById('subDept').value) : undefined,
      isHifzSubject: document.getElementById('subHifz').checked,
    }), '/academic/subjects');
  }

  function wireForm(formId, btnId, msgId, buildPayload, endpoint) {
    const form = document.getElementById(formId);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById(msgId);
      const btn = document.getElementById(btnId);
      msg.classList.remove('show');
      btn.disabled = true;
      try {
        await window.DAA_API.post(endpoint, buildPayload());
        await loadAll();
        renderPage();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
        btn.disabled = false;
      }
    });
  }
})();
