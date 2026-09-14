(function () {
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'accountant', 'receptionist', 'librarian', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Students',
    pageSubtitle: 'Search, filter and manage student records',
    activeKey: 'students',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  // Permission constants mirror backend/prisma/seed.js's ROLE_PERMISSION_MAP —
  // hiding a control here is only a UX convenience so a user doesn't hit a
  // 403; the backend (students.routes.js requirePermission(...)) is what
  // actually enforces every one of these, not this file.
  // student.create: admin/super_admin/principal/receptionist
  const CAN_CREATE_STUDENT = ['admin', 'super_admin', 'principal', 'receptionist'].includes(user.role);
  // student.edit: admin/super_admin/principal only
  const CAN_EDIT_STUDENT = ['admin', 'super_admin', 'principal'].includes(user.role);
  // student.transfer / student.archive: admin/super_admin/principal only
  // (see the EXTRA_PERMISSIONS grant in prisma/seed.js)
  const CAN_TRANSFER = ['admin', 'super_admin', 'principal'].includes(user.role);
  const CAN_ARCHIVE = ['admin', 'super_admin', 'principal'].includes(user.role);
  // student.view is held by every role allowed onto this page at all.
  const CAN_VIEW_DETAILS = true;
  const ANY_ROW_ACTION = CAN_EDIT_STUDENT || CAN_TRANSFER || CAN_ARCHIVE || CAN_VIEW_DETAILS;

  let departments = [];
  let classes = [];
  let years = [];
  let page = 1;
  const limit = 20;

  Promise.all([
    window.DAA_API.get('/academic/departments'),
    window.DAA_API.get('/academic/classes'),
    window.DAA_API.get('/academic/years'),
  ])
    .then(([depts, cls, yrs]) => {
      departments = depts;
      classes = cls; // each already includes { department, sections } — see academic.controller.js
      years = yrs;
      renderShell();
      loadStudents();
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${U.escapeHtml(err.message)}</div></div>`;
    });

  // ---- small shared helpers -------------------------------------------------

  function classesFor(departmentId) {
    if (!departmentId) return [];
    return classes.filter((c) => String(c.departmentId) === String(departmentId));
  }
  function sectionsFor(classId) {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.sections || [];
  }

  function departmentOptionsHtml(selected) {
    return `<option value="">— Select —</option>` +
      departments.map((d) => `<option value="${d.id}" ${String(d.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(d.name)}</option>`).join('');
  }
  function classOptionsHtml(departmentId, selected, opts) {
    const opt = opts || {};
    const list = departmentId ? classesFor(departmentId) : (opt.allowAll ? classes : []);
    const placeholder = departmentId || opt.allowAll ? '— Select —' : 'Select department first';
    return `<option value="">${placeholder}</option>` +
      list.map((c) => `<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join('');
  }
  function sectionOptionsHtml(classId, selected) {
    const list = sectionsFor(classId);
    return `<option value="">${classId ? '— Select —' : 'Select class first'}</option>` +
      list.map((s) => `<option value="${s.id}" ${String(s.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(s.name)}</option>`).join('');
  }
  function yearOptionsHtml(selected) {
    return `<option value="">— Select —</option>` +
      years.map((y) => `<option value="${y.id}" ${String(y.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`).join('');
  }

  /** Wires a Department -> Class -> Section cascade for one form/filter's
   * trio of <select> elements. `onLeafChange` fires after section changes
   * too, so callers (filters) can reload data; forms just no-op it. */
  function wireCascade(deptId, classIdEl, sectionIdEl, onLeafChange) {
    const deptEl = document.getElementById(deptId);
    const classEl = document.getElementById(classIdEl);
    const sectionEl = document.getElementById(sectionIdEl);
    deptEl.addEventListener('change', () => {
      classEl.innerHTML = classOptionsHtml(deptEl.value, '');
      sectionEl.innerHTML = sectionOptionsHtml('', '');
      if (onLeafChange) onLeafChange();
    });
    classEl.addEventListener('change', () => {
      sectionEl.innerHTML = sectionOptionsHtml(classEl.value, '');
      if (onLeafChange) onLeafChange();
    });
    if (onLeafChange) sectionEl.addEventListener('change', onLeafChange);
  }

  // avatarHtml(student, size) now lives in common.js as U.avatarHtml — shared
  // with any other page that lists students (e.g. Teacher My Students),
  // instead of duplicating it per page.

  // ---- shell (filters + table box + modals) ---------------------------------

  function renderShell() {
    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);">Filters</div>
          ${CAN_CREATE_STUDENT ? `<button class="btn btn-portal-primary" id="addStudentBtn"><i class="fa-solid fa-plus me-1"></i>Add Student</button>` : ''}
        </div>
        <div class="row g-2 align-items-end">
          <div class="col-lg-2 col-md-4 col-sm-6">
            <label class="form-label">Search</label>
            <input type="text" class="form-control" id="searchInput" placeholder="Name, ID or roll">
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <label class="form-label">Department</label>
            <select class="form-control" id="filterDept">${departmentOptionsHtml('')}</select>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <label class="form-label">Class</label>
            <select class="form-control" id="filterClass">${classOptionsHtml('', '', { allowAll: true })}</select>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <label class="form-label">Section</label>
            <select class="form-control" id="filterSection">${sectionOptionsHtml('', '')}</select>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <label class="form-label">Academic Year</label>
            <select class="form-control" id="filterYear">${yearOptionsHtml('')}</select>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <label class="form-label">Status</label>
            <select class="form-control" id="filterStatus">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>
      <div id="studentTableBox"></div>

      ${CAN_CREATE_STUDENT ? addModalHtml() : ''}
      ${CAN_EDIT_STUDENT ? editModalHtml() : ''}
      ${CAN_TRANSFER ? transferModalHtml() : ''}
    `;

    // --- Filter cascade: Department resets Class+Section; Class resets Section ---
    const filterDept = document.getElementById('filterDept');
    const filterClass = document.getElementById('filterClass');
    const filterSection = document.getElementById('filterSection');
    filterDept.addEventListener('change', () => {
      filterClass.innerHTML = classOptionsHtml(filterDept.value, '', { allowAll: false });
      filterSection.innerHTML = sectionOptionsHtml('', '');
      page = 1;
      loadStudents();
    });
    filterClass.addEventListener('change', () => {
      filterSection.innerHTML = sectionOptionsHtml(filterClass.value, '');
      page = 1;
      loadStudents();
    });
    filterSection.addEventListener('change', () => { page = 1; loadStudents(); });
    document.getElementById('filterYear').addEventListener('change', () => { page = 1; loadStudents(); });
    document.getElementById('filterStatus').addEventListener('change', () => { page = 1; loadStudents(); });

    let debounce;
    document.getElementById('searchInput').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { page = 1; loadStudents(); }, 400);
    });

    if (CAN_CREATE_STUDENT) wireAddForm();
    if (CAN_EDIT_STUDENT) wireEditForm();
    if (CAN_TRANSFER) wireTransferForm();
  }

  // ---- Add Student ------------------------------------------------------

  function addModalHtml() {
    return `
      <div class="modal fade" id="addModal" tabindex="-1" aria-labelledby="addModalLabel">
        <div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-header">
            <h5 class="modal-title" id="addModalLabel">Add New Student</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <div class="auth-error" id="addMsg" role="alert"></div>
            <form id="addForm">
              <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:8px;">Personal Information</div>
              <div class="row g-2 mb-3">
                <div class="col-md-8"><label class="form-label" for="npFullName">Full Name</label><input class="form-control" id="npFullName" required></div>
                <div class="col-md-4"><label class="form-label" for="npPhoto">Photo URL</label><input class="form-control" id="npPhoto" placeholder="Optional"></div>
                <div class="col-md-4"><label class="form-label" for="npDob">Date of Birth</label><input type="date" class="form-control" id="npDob"></div>
                <div class="col-md-4"><label class="form-label" for="npGender">Gender</label>
                  <select class="form-control" id="npGender"><option value="male">Male</option><option value="female">Female</option></select>
                </div>
                <div class="col-md-4"><label class="form-label" for="npBlood">Blood Group</label><input class="form-control" id="npBlood" placeholder="e.g. B+"></div>
                <div class="col-md-6"><label class="form-label" for="npPresentAddr">Present Address</label><input class="form-control" id="npPresentAddr"></div>
                <div class="col-md-6"><label class="form-label" for="npPermanentAddr">Permanent Address</label><input class="form-control" id="npPermanentAddr"></div>
              </div>

              <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:8px;">Academic Information</div>
              <div class="row g-2 mb-2">
                <div class="col-md-4"><label class="form-label" for="npDept">Department</label>
                  <select class="form-control" id="npDept">${departmentOptionsHtml('')}</select>
                </div>
                <div class="col-md-4"><label class="form-label" for="npClass">Class</label>
                  <select class="form-control" id="npClass">${classOptionsHtml('', '')}</select>
                </div>
                <div class="col-md-4"><label class="form-label" for="npSection">Section</label>
                  <select class="form-control" id="npSection">${sectionOptionsHtml('', '')}</select>
                </div>
                <div class="col-md-3"><label class="form-label" for="npRoll">Roll Number</label><input class="form-control" id="npRoll"></div>
                <div class="col-md-3"><label class="form-label" for="npYear">Academic Year</label>
                  <select class="form-control" id="npYear">${yearOptionsHtml('')}</select>
                </div>
                <div class="col-md-3"><label class="form-label" for="npAdmDate">Admission Date</label><input type="date" class="form-control" id="npAdmDate"></div>
                <div class="col-md-3">
                  <label class="form-label d-block">Hifz Student?</label>
                  <div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="npHifz"></div>
                </div>
              </div>
              <p style="font-size:12.5px;color:var(--muted);margin-bottom:0;">
                Guardian linking isn't available on this form yet — add the student first, then link a guardian from the Guardians module.
              </p>
              <button type="submit" class="btn btn-portal-primary mt-3" id="addSubmit">
                <span class="btn-label">Create Student</span>
                <span class="spinner-border spinner-border-sm ms-2 d-none" id="addSpinner" aria-hidden="true"></span>
              </button>
            </form>
          </div>
        </div></div>
      </div>`;
  }

  function wireAddForm() {
    const addModalEl = document.getElementById('addModal');
    const addModal = new bootstrap.Modal(addModalEl);
    document.getElementById('addStudentBtn').addEventListener('click', () => {
      document.getElementById('addForm').reset();
      document.getElementById('npClass').innerHTML = classOptionsHtml('', '');
      document.getElementById('npSection').innerHTML = sectionOptionsHtml('', '');
      document.getElementById('addMsg').classList.remove('show');
      addModal.show();
    });
    wireCascade('npDept', 'npClass', 'npSection');

    let submitting = false;
    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const msg = document.getElementById('addMsg');
      const btn = document.getElementById('addSubmit');
      msg.classList.remove('show');
      submitting = true;
      btn.disabled = true;
      btn.querySelector('.spinner-border').classList.remove('d-none');
      try {
        const payload = {
          fullName: document.getElementById('npFullName').value.trim(),
          photoUrl: document.getElementById('npPhoto').value.trim() || undefined,
          dateOfBirth: document.getElementById('npDob').value || undefined,
          gender: document.getElementById('npGender').value,
          bloodGroup: document.getElementById('npBlood').value.trim() || undefined,
          presentAddress: document.getElementById('npPresentAddr').value.trim() || undefined,
          permanentAddress: document.getElementById('npPermanentAddr').value.trim() || undefined,
          rollNumber: document.getElementById('npRoll').value.trim() || undefined,
          departmentId: document.getElementById('npDept').value ? Number(document.getElementById('npDept').value) : undefined,
          currentClassId: document.getElementById('npClass').value ? Number(document.getElementById('npClass').value) : undefined,
          currentSectionId: document.getElementById('npSection').value ? Number(document.getElementById('npSection').value) : undefined,
          academicYearId: document.getElementById('npYear').value ? Number(document.getElementById('npYear').value) : undefined,
          admissionDate: document.getElementById('npAdmDate').value || undefined,
          isHifzStudent: document.getElementById('npHifz').checked,
        };
        await window.DAA_API.post('/students', payload);
        addModal.hide();
        document.getElementById('addForm').reset();
        page = 1;
        loadStudents();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        submitting = false;
        btn.disabled = false;
        btn.querySelector('.spinner-border').classList.add('d-none');
      }
    });
  }

  // ---- Edit Student -------------------------------------------------------

  function editModalHtml() {
    return `
      <div class="modal fade" id="editModal" tabindex="-1" aria-labelledby="editModalLabel">
        <div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-header">
            <h5 class="modal-title" id="editModalLabel">Edit Student</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <div class="auth-error" id="editMsg" role="alert"></div>
            <form id="editForm">
              <input type="hidden" id="epId">
              <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:8px;">Personal Information</div>
              <div class="row g-2 mb-3">
                <div class="col-md-8"><label class="form-label" for="epFullName">Full Name</label><input class="form-control" id="epFullName" required></div>
                <div class="col-md-4"><label class="form-label" for="epPhoto">Photo URL</label><input class="form-control" id="epPhoto"></div>
                <div class="col-md-4"><label class="form-label" for="epDob">Date of Birth</label><input type="date" class="form-control" id="epDob"></div>
                <div class="col-md-4"><label class="form-label" for="epGender">Gender</label>
                  <select class="form-control" id="epGender"><option value="male">Male</option><option value="female">Female</option></select>
                </div>
                <div class="col-md-4"><label class="form-label" for="epBlood">Blood Group</label><input class="form-control" id="epBlood"></div>
                <div class="col-md-6"><label class="form-label" for="epPresentAddr">Present Address</label><input class="form-control" id="epPresentAddr"></div>
                <div class="col-md-6"><label class="form-label" for="epPermanentAddr">Permanent Address</label><input class="form-control" id="epPermanentAddr"></div>
              </div>

              <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:8px;">Academic Information</div>
              <div class="row g-2">
                <div class="col-md-4"><label class="form-label" for="epDept">Department</label>
                  <select class="form-control" id="epDept">${departmentOptionsHtml('')}</select>
                </div>
                <div class="col-md-4"><label class="form-label" for="epClass">Class</label>
                  <select class="form-control" id="epClass">${classOptionsHtml('', '')}</select>
                </div>
                <div class="col-md-4"><label class="form-label" for="epSection">Section</label>
                  <select class="form-control" id="epSection">${sectionOptionsHtml('', '')}</select>
                </div>
                <div class="col-md-3"><label class="form-label" for="epRoll">Roll Number</label><input class="form-control" id="epRoll"></div>
                <div class="col-md-3"><label class="form-label" for="epYear">Academic Year</label>
                  <select class="form-control" id="epYear">${yearOptionsHtml('')}</select>
                </div>
                <div class="col-md-3"><label class="form-label" for="epStatus">Status</label>
                  <select class="form-control" id="epStatus">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="transferred">Transferred</option>
                    <option value="graduated">Graduated</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label d-block">Hifz Student?</label>
                  <div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="epHifz"></div>
                </div>
              </div>
              <button type="submit" class="btn btn-portal-primary mt-3" id="editSubmit">
                <span class="btn-label">Save Changes</span>
                <span class="spinner-border spinner-border-sm ms-2 d-none" id="editSpinner" aria-hidden="true"></span>
              </button>
            </form>
          </div>
        </div></div>
      </div>`;
  }

  function wireEditForm() {
    const editModalEl = document.getElementById('editModal');
    const editModal = new bootstrap.Modal(editModalEl);
    wireCascade('epDept', 'epClass', 'epSection');

    window.__openEditStudent = (s) => {
      document.getElementById('editMsg').classList.remove('show');
      document.getElementById('epId').value = s.id;
      document.getElementById('epFullName').value = s.fullName || '';
      document.getElementById('epPhoto').value = s.photoUrl || '';
      document.getElementById('epDob').value = s.dateOfBirth ? String(s.dateOfBirth).slice(0, 10) : '';
      document.getElementById('epGender').value = s.gender || 'male';
      document.getElementById('epBlood').value = s.bloodGroup || '';
      document.getElementById('epPresentAddr').value = s.presentAddress || '';
      document.getElementById('epPermanentAddr').value = s.permanentAddress || '';
      document.getElementById('epRoll').value = s.rollNumber || '';
      document.getElementById('epStatus').value = s.status || 'active';
      document.getElementById('epHifz').checked = !!s.isHifzStudent;
      const deptId = s.department?.id || s.departmentId || '';
      const classId = s.currentClass?.id || s.currentClassId || '';
      const sectionId = s.currentSection?.id || s.currentSectionId || '';
      document.getElementById('epDept').innerHTML = departmentOptionsHtml(deptId);
      document.getElementById('epClass').innerHTML = classOptionsHtml(deptId, classId);
      document.getElementById('epSection').innerHTML = sectionOptionsHtml(classId, sectionId);
      document.getElementById('epYear').innerHTML = yearOptionsHtml(s.academicYear?.id || s.academicYearId || '');
      editModal.show();
    };

    let submitting = false;
    document.getElementById('editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const msg = document.getElementById('editMsg');
      const btn = document.getElementById('editSubmit');
      msg.classList.remove('show');
      submitting = true;
      btn.disabled = true;
      btn.querySelector('.spinner-border').classList.remove('d-none');
      try {
        const id = document.getElementById('epId').value;
        const payload = {
          fullName: document.getElementById('epFullName').value.trim(),
          photoUrl: document.getElementById('epPhoto').value.trim() || undefined,
          dateOfBirth: document.getElementById('epDob').value || undefined,
          gender: document.getElementById('epGender').value,
          bloodGroup: document.getElementById('epBlood').value.trim() || undefined,
          presentAddress: document.getElementById('epPresentAddr').value.trim() || undefined,
          permanentAddress: document.getElementById('epPermanentAddr').value.trim() || undefined,
          rollNumber: document.getElementById('epRoll').value.trim() || undefined,
          departmentId: document.getElementById('epDept').value ? Number(document.getElementById('epDept').value) : undefined,
          currentClassId: document.getElementById('epClass').value ? Number(document.getElementById('epClass').value) : undefined,
          currentSectionId: document.getElementById('epSection').value ? Number(document.getElementById('epSection').value) : undefined,
          academicYearId: document.getElementById('epYear').value ? Number(document.getElementById('epYear').value) : undefined,
          status: document.getElementById('epStatus').value,
          isHifzStudent: document.getElementById('epHifz').checked,
        };
        await window.DAA_API.patch(`/students/${id}`, payload);
        editModal.hide();
        loadStudents();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        submitting = false;
        btn.disabled = false;
        btn.querySelector('.spinner-border').classList.add('d-none');
      }
    });
  }

  // ---- Transfer -------------------------------------------------------------

  function transferModalHtml() {
    return `
      <div class="modal fade" id="transferModal" tabindex="-1" aria-labelledby="transferModalLabel">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-header">
            <h5 class="modal-title" id="transferModalLabel">Transfer Student</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <p id="transferStudentName" style="font-weight:700;color:var(--green-deep);"></p>
            <div class="auth-error" id="transferMsg" role="alert"></div>
            <form id="transferForm">
              <input type="hidden" id="tfId">
              <div class="row g-2">
                <div class="col-12"><label class="form-label" for="tfDept">Department</label>
                  <select class="form-control" id="tfDept" required>${departmentOptionsHtml('')}</select>
                </div>
                <div class="col-12"><label class="form-label" for="tfClass">Class</label>
                  <select class="form-control" id="tfClass" required>${classOptionsHtml('', '')}</select>
                </div>
                <div class="col-12"><label class="form-label" for="tfSection">Section</label>
                  <select class="form-control" id="tfSection">${sectionOptionsHtml('', '')}</select>
                </div>
                <div class="col-12"><label class="form-label" for="tfYear">Academic Year</label>
                  <select class="form-control" id="tfYear" required>${yearOptionsHtml('')}</select>
                </div>
              </div>
              <p style="font-size:12.5px;color:var(--muted);margin:10px 0 0;">
                This only changes the student's current placement — attendance, exam, fee, Hifz and assignment history are kept exactly as they are.
              </p>
              <button type="submit" class="btn btn-portal-primary mt-3" id="transferSubmit">
                <span class="btn-label">Confirm Transfer</span>
                <span class="spinner-border spinner-border-sm ms-2 d-none" id="transferSpinner" aria-hidden="true"></span>
              </button>
            </form>
          </div>
        </div></div>
      </div>`;
  }

  function wireTransferForm() {
    const transferModalEl = document.getElementById('transferModal');
    const transferModal = new bootstrap.Modal(transferModalEl);
    wireCascade('tfDept', 'tfClass', 'tfSection');

    window.__openTransferStudent = (s) => {
      document.getElementById('transferMsg').classList.remove('show');
      document.getElementById('tfId').value = s.id;
      document.getElementById('transferStudentName').textContent = `${s.fullName} (${s.studentCode})`;
      const deptId = s.department?.id || s.departmentId || '';
      const classId = s.currentClass?.id || s.currentClassId || '';
      const sectionId = s.currentSection?.id || s.currentSectionId || '';
      document.getElementById('tfDept').innerHTML = departmentOptionsHtml(deptId);
      document.getElementById('tfClass').innerHTML = classOptionsHtml(deptId, classId);
      document.getElementById('tfSection').innerHTML = sectionOptionsHtml(classId, sectionId);
      document.getElementById('tfYear').innerHTML = yearOptionsHtml(s.academicYear?.id || s.academicYearId || '');
      transferModal.show();
    };

    let submitting = false;
    document.getElementById('transferForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const msg = document.getElementById('transferMsg');
      const btn = document.getElementById('transferSubmit');
      msg.classList.remove('show');

      const departmentId = document.getElementById('tfDept').value;
      const classId = document.getElementById('tfClass').value;
      if (!departmentId || !classId) {
        msg.textContent = 'Department and Class are required.';
        msg.classList.add('show');
        return;
      }

      submitting = true;
      btn.disabled = true;
      btn.querySelector('.spinner-border').classList.remove('d-none');
      try {
        const id = document.getElementById('tfId').value;
        const payload = {
          departmentId: Number(departmentId),
          classId: Number(classId),
          sectionId: document.getElementById('tfSection').value ? Number(document.getElementById('tfSection').value) : undefined,
          academicYearId: document.getElementById('tfYear').value ? Number(document.getElementById('tfYear').value) : undefined,
        };
        await window.DAA_API.post(`/students/${id}/transfer`, payload);
        transferModal.hide();
        loadStudents();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        submitting = false;
        btn.disabled = false;
        btn.querySelector('.spinner-border').classList.add('d-none');
      }
    });
  }

  // ---- Archive ----------------------------------------------------------

  async function archiveStudent(s, btn) {
    if (!confirm(`Are you sure you want to archive ${s.fullName} (${s.studentCode})? This does not delete the student — their attendance, exam, fee, Hifz and assignment history are all kept, and an admin can still view the record afterwards.`)) {
      return;
    }
    btn.disabled = true;
    try {
      await window.DAA_API.post(`/students/${s.id}/archive`, {});
      loadStudents();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---- List / table -------------------------------------------------------

  function loadStudents() {
    const box = document.getElementById('studentTableBox');
    box.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;

    const search = document.getElementById('searchInput').value.trim();
    const departmentId = document.getElementById('filterDept').value;
    const classId = document.getElementById('filterClass').value;
    const sectionId = document.getElementById('filterSection').value;
    const academicYearId = document.getElementById('filterYear').value;
    const status = document.getElementById('filterStatus').value;

    // Every filter is a real server-side query parameter (students.controller.js
    // list()) — nothing here is ever filtered only in the browser.
    let qs = `page=${page}&limit=${limit}`;
    if (search) qs += `&search=${encodeURIComponent(search)}`;
    if (departmentId) qs += `&departmentId=${departmentId}`;
    if (classId) qs += `&classId=${classId}`;
    if (sectionId) qs += `&sectionId=${sectionId}`;
    if (academicYearId) qs += `&academicYearId=${academicYearId}`;
    if (status) qs += `&status=${status}`;

    window.DAA_API.get(`/students?${qs}`)
      .then((students) => {
        const meta = students._meta;
        const totalPages = meta ? meta.totalPages : null;
        const hasNext = meta ? page < totalPages : students.length >= limit;

        if (!students.length) {
          box.innerHTML = `<div class="p-card">
            <div class="empty-state"><i class="fa-solid fa-user-graduate"></i>No students found.</div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadStudents(); });
          return;
        }

        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr>
                  <th>Student</th><th>Department</th><th>Class</th><th>Section</th>
                  <th>Academic Year</th><th>Roll</th><th>Status</th>
                  ${ANY_ROW_ACTION ? '<th class="text-end">Actions</th>' : ''}
                </tr></thead>
                <tbody>
                  ${students.map((s) => `
                    <tr>
                      <td>
                        <div class="d-flex align-items-center gap-2">
                          ${U.avatarHtml(s, 'sm')}
                          <div>
                            <div style="font-weight:700;">${U.escapeHtml(s.fullName)}</div>
                            <div style="font-size:11.5px;color:var(--muted);">${U.escapeHtml(s.studentCode)}</div>
                          </div>
                        </div>
                      </td>
                      <td>${s.department?.name ? U.escapeHtml(s.department.name) : '—'}</td>
                      <td>${s.currentClass?.name ? U.escapeHtml(s.currentClass.name) : '—'}</td>
                      <td>${s.currentSection?.name ? U.escapeHtml(s.currentSection.name) : '—'}</td>
                      <td>${s.academicYear?.name ? U.escapeHtml(s.academicYear.name) : '—'}</td>
                      <td>${s.rollNumber || '—'}</td>
                      <td>${U.statusBadge(s.status)}</td>
                      ${ANY_ROW_ACTION ? `<td class="text-end">
                        <div class="btn-group">
                          ${CAN_VIEW_DETAILS ? `<a class="btn btn-portal-outline btn-sm" href="../student-details.html?id=${encodeURIComponent(s.id)}" title="View"><i class="fa-solid fa-eye"></i></a>` : ''}
                          ${CAN_EDIT_STUDENT ? `<button class="btn btn-portal-outline btn-sm edit-student-btn" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>` : ''}
                          ${CAN_TRANSFER ? `<button class="btn btn-portal-outline btn-sm transfer-student-btn" data-id="${s.id}" title="Transfer"><i class="fa-solid fa-right-left"></i></button>` : ''}
                          ${CAN_ARCHIVE ? `<button class="btn btn-portal-outline btn-sm archive-student-btn" data-id="${s.id}" title="Archive"><i class="fa-solid fa-box-archive"></i></button>` : ''}
                        </div>
                      </td>` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
              <span style="font-size:12.5px;color:var(--muted);">${meta ? `Page ${page} of ${totalPages} &middot; ${meta.total} student(s)` : `Page ${page}`}</span>
              <div class="btn-group">
                <button class="btn btn-portal-outline btn-sm" id="prevPage" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <button class="btn btn-portal-outline btn-sm" id="nextPage" ${hasNext ? '' : 'disabled'}>Next</button>
              </div>
            </div>
          </div>
        `;

        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.addEventListener('click', () => { page--; loadStudents(); });
        if (next) next.addEventListener('click', () => { page++; loadStudents(); });

        if (CAN_EDIT_STUDENT) {
          document.querySelectorAll('.edit-student-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              const s = students.find((st) => String(st.id) === btn.dataset.id);
              if (s && window.__openEditStudent) window.__openEditStudent(s);
            });
          });
        }
        if (CAN_TRANSFER) {
          document.querySelectorAll('.transfer-student-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              const s = students.find((st) => String(st.id) === btn.dataset.id);
              if (s && window.__openTransferStudent) window.__openTransferStudent(s);
            });
          });
        }
        if (CAN_ARCHIVE) {
          document.querySelectorAll('.archive-student-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              const s = students.find((st) => String(st.id) === btn.dataset.id);
              if (s) archiveStudent(s, btn);
            });
          });
        }
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${U.escapeHtml(err.message)}</div></div>`;
      });
  }
})();
