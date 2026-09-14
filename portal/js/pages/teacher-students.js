(function () {
  const user = window.DAA_API.requireAuth(['teacher', 'hifz_teacher']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Students',
    pageSubtitle: 'Students in your assigned classes and sections',
    activeKey: 'students',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  // teacher and hifz_teacher both hold student.create/student.edit (see
  // prisma/seed.js) but NEVER student.transfer/student.archive — those stay
  // Admin/Principal-only, enforced server-side regardless of what this page
  // shows. Hardcoding these two as false (rather than a role list) mirrors
  // how the rest of the portal already tracks permissions client-side —
  // there's no "my permissions" endpoint to query instead — and is still
  // only a UX convenience: the backend's own requirePermission(...) is what
  // actually blocks these two actions.
  const CAN_CREATE_STUDENT = true;
  const CAN_EDIT_STUDENT = true;
  const CAN_TRANSFER = false;
  const CAN_ARCHIVE = false;
  const CAN_VIEW_DETAILS = true;

  let allClasses = []; // full catalogue, from /academic/classes (dept+sections included)
  let myAssignments = []; // this teacher's own TeacherClassAssignment rows (bare ids)
  let years = [];
  let page = 1;
  const limit = 20;

  Promise.all([
    window.DAA_API.get('/teachers/my-assignments'),
    window.DAA_API.get('/academic/classes'),
    window.DAA_API.get('/academic/years'),
  ])
    .then(([assignments, cls, yrs]) => {
      myAssignments = assignments;
      allClasses = cls;
      years = yrs;
      renderShell();
      // renderShell() shows a dedicated "no assignments" card and returns
      // early when the teacher has no classes at all — there's no
      // #studentTableBox in that markup, so only load the list when the
      // normal filters+table UI actually rendered.
      if (myClasses().length) loadStudents();
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${U.escapeHtml(err.message)}</div></div>`;
    });

  // ---- scope helpers ---------------------------------------------------
  // These only shape which options this UI *offers* — the server
  // independently re-derives and enforces the same scope from the
  // authenticated session via assertTeacherCanPlaceStudent() /
  // getAccessibleStudentIds(), never trusting anything sent from here.

  function myClassIds() {
    return [...new Set(myAssignments.map((a) => a.classId))];
  }
  function myClasses() {
    const ids = myClassIds();
    return allClasses.filter((c) => ids.includes(c.id));
  }
  /** Sections this teacher may use for a given class: every section in that
   * class if any of their assignment rows for it has no sectionId (a
   * whole-class assignment), otherwise only the specific sections they're
   * assigned to — mirrors assertTeacherCanPlaceStudent()'s own logic. */
  function allowedSectionsFor(classId) {
    const cls = allClasses.find((c) => String(c.id) === String(classId));
    if (!cls) return [];
    const rowsForClass = myAssignments.filter((a) => String(a.classId) === String(classId));
    if (rowsForClass.some((a) => a.sectionId === null || a.sectionId === undefined)) {
      return cls.sections || [];
    }
    const allowedIds = new Set(rowsForClass.map((a) => a.sectionId));
    return (cls.sections || []).filter((s) => allowedIds.has(s.id));
  }
  function myTeachingSummary() {
    const byDept = {};
    myClasses().forEach((c) => {
      const deptName = c.department?.name || 'Unassigned';
      byDept[deptName] = byDept[deptName] || new Set();
      byDept[deptName].add(c.name);
    });
    return Object.entries(byDept).map(([dept, classSet]) => `${dept} — ${[...classSet].join(', ')}`).join(' · ');
  }

  function classOptionsHtml(selected) {
    const list = myClasses();
    return `<option value="">— Select —</option>` +
      list.map((c) => `<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join('');
  }
  function sectionOptionsHtml(classId, selected) {
    const list = classId ? allowedSectionsFor(classId) : [];
    return `<option value="">${classId ? '— Select —' : 'Select class first'}</option>` +
      list.map((s) => `<option value="${s.id}" ${String(s.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(s.name)}</option>`).join('');
  }
  function yearOptionsHtml(selected) {
    return `<option value="">— Select —</option>` +
      years.map((y) => `<option value="${y.id}" ${String(y.id) === String(selected) ? 'selected' : ''}>${U.escapeHtml(y.name)}${y.isCurrent ? ' (current)' : ''}</option>`).join('');
  }

  // ---- shell ---------------------------------------------------------------

  function renderShell() {
    if (!myClasses().length) {
      content.innerHTML = `
        <div class="p-card">
          <div class="empty-state">
            <i class="fa-solid fa-chalkboard-user"></i>
            No Class Assignments Yet
            <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">
              You aren't currently assigned to any class or section, so there are no students to show here.
              Ask an admin to assign you to a class.
            </div>
          </div>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div>
            <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);">Filters</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">Teaching: ${U.escapeHtml(myTeachingSummary())}</div>
          </div>
          ${CAN_CREATE_STUDENT ? `<button class="btn btn-portal-primary" id="addStudentBtn"><i class="fa-solid fa-plus me-1"></i>Add Student</button>` : ''}
        </div>
        <div class="row g-2 align-items-end">
          <div class="col-lg-3 col-md-6">
            <label class="form-label">Search</label>
            <input type="text" class="form-control" id="searchInput" placeholder="Name, ID or roll">
          </div>
          <div class="col-lg-3 col-md-6">
            <label class="form-label">Class</label>
            <select class="form-control" id="filterClass">${classOptionsHtml('')}</select>
          </div>
          <div class="col-lg-2 col-md-6">
            <label class="form-label">Section</label>
            <select class="form-control" id="filterSection">${sectionOptionsHtml('', '')}</select>
          </div>
          <div class="col-lg-2 col-md-6">
            <label class="form-label">Academic Year</label>
            <select class="form-control" id="filterYear">${yearOptionsHtml('')}</select>
          </div>
          <div class="col-lg-2 col-md-6">
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
    `;

    const filterClass = document.getElementById('filterClass');
    const filterSection = document.getElementById('filterSection');
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
  }

  // ---- Add Student (intentionally smaller than the Admin form) ------------

  function addModalHtml() {
    return `
      <div class="modal fade" id="addModal" tabindex="-1" aria-labelledby="addModalLabel">
        <div class="modal-dialog modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
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
                <div class="col-md-4"><label class="form-label" for="npDob">Date of Birth</label><input type="date" class="form-control" id="npDob"></div>
                <div class="col-md-4"><label class="form-label" for="npGender">Gender</label>
                  <select class="form-control" id="npGender"><option value="male">Male</option><option value="female">Female</option></select>
                </div>
                <div class="col-md-4"><label class="form-label" for="npBlood">Blood Group</label><input class="form-control" id="npBlood" placeholder="e.g. B+"></div>
                <div class="col-md-4"><label class="form-label" for="npRoll">Roll Number</label><input class="form-control" id="npRoll"></div>
                <div class="col-md-6"><label class="form-label" for="npPresentAddr">Present Address</label><input class="form-control" id="npPresentAddr"></div>
                <div class="col-md-6"><label class="form-label" for="npPermanentAddr">Permanent Address</label><input class="form-control" id="npPermanentAddr"></div>
              </div>

              <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:8px;">Academic Information</div>
              <p style="font-size:12px;color:var(--muted);margin-bottom:8px;">Only your own assigned classes and sections are offered here — this is enforced by the server, not just this form.</p>
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label" for="npClass">Class</label>
                  <select class="form-control" id="npClass" required>${classOptionsHtml('')}</select>
                </div>
                <div class="col-md-6"><label class="form-label" for="npSection">Section</label>
                  <select class="form-control" id="npSection">${sectionOptionsHtml('', '')}</select>
                </div>
                <div class="col-md-6"><label class="form-label" for="npYear">Academic Year</label>
                  <select class="form-control" id="npYear">${yearOptionsHtml('')}</select>
                </div>
                <div class="col-md-6"><label class="form-label" for="npAdmDate">Admission Date</label><input type="date" class="form-control" id="npAdmDate"></div>
              </div>
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
      const classes = myClasses();
      // Auto-populate when there's exactly one assigned class (spec Step 12
      // example: Hifz -> Hifz-2 -> Section A filled in automatically);
      // with more than one, the teacher still picks among only their own.
      const defaultClassId = classes.length === 1 ? classes[0].id : '';
      document.getElementById('npClass').innerHTML = classOptionsHtml(defaultClassId);
      document.getElementById('npSection').innerHTML = sectionOptionsHtml(defaultClassId, '');
      document.getElementById('addMsg').classList.remove('show');
      addModal.show();
    });
    document.getElementById('npClass').addEventListener('change', (e) => {
      document.getElementById('npSection').innerHTML = sectionOptionsHtml(e.target.value, '');
    });

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
        const classId = document.getElementById('npClass').value;
        // departmentId is derived from the chosen class, never offered as
        // its own control — a teacher can't pick an arbitrary department.
        const cls = allClasses.find((c) => String(c.id) === String(classId));
        const payload = {
          fullName: document.getElementById('npFullName').value.trim(),
          dateOfBirth: document.getElementById('npDob').value || undefined,
          gender: document.getElementById('npGender').value,
          bloodGroup: document.getElementById('npBlood').value.trim() || undefined,
          presentAddress: document.getElementById('npPresentAddr').value.trim() || undefined,
          permanentAddress: document.getElementById('npPermanentAddr').value.trim() || undefined,
          rollNumber: document.getElementById('npRoll').value.trim() || undefined,
          departmentId: cls?.departmentId ? Number(cls.departmentId) : undefined,
          currentClassId: classId ? Number(classId) : undefined,
          currentSectionId: document.getElementById('npSection').value ? Number(document.getElementById('npSection').value) : undefined,
          academicYearId: document.getElementById('npYear').value ? Number(document.getElementById('npYear').value) : undefined,
          admissionDate: document.getElementById('npAdmDate').value || undefined,
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

  // ---- Edit Student (personal fields only — placement/status are Admin-only,
  // enforced server-side in students.service.js's TEACHER_RESTRICTED_PLACEMENT_FIELDS) ---

  function editModalHtml() {
    return `
      <div class="modal fade" id="editModal" tabindex="-1" aria-labelledby="editModalLabel">
        <div class="modal-dialog modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-header">
            <h5 class="modal-title" id="editModalLabel">Edit Student</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <p id="editContext" style="font-weight:700;color:var(--green-deep);"></p>
            <div class="auth-error" id="editMsg" role="alert"></div>
            <form id="editForm">
              <input type="hidden" id="epId">
              <div class="row g-2">
                <div class="col-md-8"><label class="form-label" for="epFullName">Full Name</label><input class="form-control" id="epFullName" required></div>
                <div class="col-md-4"><label class="form-label" for="epDob">Date of Birth</label><input type="date" class="form-control" id="epDob"></div>
                <div class="col-md-4"><label class="form-label" for="epGender">Gender</label>
                  <select class="form-control" id="epGender"><option value="male">Male</option><option value="female">Female</option></select>
                </div>
                <div class="col-md-4"><label class="form-label" for="epBlood">Blood Group</label><input class="form-control" id="epBlood"></div>
                <div class="col-md-4"><label class="form-label" for="epRoll">Roll Number</label><input class="form-control" id="epRoll"></div>
                <div class="col-md-6"><label class="form-label" for="epPresentAddr">Present Address</label><input class="form-control" id="epPresentAddr"></div>
                <div class="col-md-6"><label class="form-label" for="epPermanentAddr">Permanent Address</label><input class="form-control" id="epPermanentAddr"></div>
              </div>
              <p style="font-size:12px;color:var(--muted);margin:8px 0 0;">Department, class, section, academic year and status can only be changed by an admin.</p>
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

    window.__openEditStudent = (s) => {
      document.getElementById('editMsg').classList.remove('show');
      document.getElementById('epId').value = s.id;
      document.getElementById('editContext').textContent =
        `${s.department?.name || '—'} • ${s.currentClass?.name || '—'} • ${s.currentSection?.name || '—'} • Roll ${s.rollNumber || '—'}`;
      document.getElementById('epFullName').value = s.fullName || '';
      document.getElementById('epDob').value = s.dateOfBirth ? String(s.dateOfBirth).slice(0, 10) : '';
      document.getElementById('epGender').value = s.gender || 'male';
      document.getElementById('epBlood').value = s.bloodGroup || '';
      document.getElementById('epPresentAddr').value = s.presentAddress || '';
      document.getElementById('epPermanentAddr').value = s.permanentAddress || '';
      document.getElementById('epRoll').value = s.rollNumber || '';
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
        // Deliberately no departmentId/currentClassId/currentSectionId/
        // academicYearId/status in this payload — those fields are never
        // offered here, and the backend would reject them from a
        // teacher/hifz_teacher caller regardless (updateStudent's
        // TEACHER_RESTRICTED_PLACEMENT_FIELDS check).
        const payload = {
          fullName: document.getElementById('epFullName').value.trim(),
          dateOfBirth: document.getElementById('epDob').value || undefined,
          gender: document.getElementById('epGender').value,
          bloodGroup: document.getElementById('epBlood').value.trim() || undefined,
          presentAddress: document.getElementById('epPresentAddr').value.trim() || undefined,
          permanentAddress: document.getElementById('epPermanentAddr').value.trim() || undefined,
          rollNumber: document.getElementById('epRoll').value.trim() || undefined,
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

  // ---- List / table -------------------------------------------------------
  // GET /students is the exact same endpoint Admin Students uses — for this
  // caller it's transparently scoped server-side to only this teacher's
  // accessible students (getAccessibleStudentIds in scope.js, derived from
  // the authenticated session's own TeacherClassAssignment/hifzTeacherId
  // rows), never from a teacherId this page could pass in.

  function loadStudents() {
    const box = document.getElementById('studentTableBox');
    box.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;

    const search = document.getElementById('searchInput').value.trim();
    const classId = document.getElementById('filterClass').value;
    const sectionId = document.getElementById('filterSection').value;
    const academicYearId = document.getElementById('filterYear').value;
    const status = document.getElementById('filterStatus').value;

    let qs = `page=${page}&limit=${limit}`;
    if (search) qs += `&search=${encodeURIComponent(search)}`;
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
            <div class="empty-state"><i class="fa-solid fa-user-graduate"></i>No Students Assigned<div style="font-size:12.5px;color:var(--muted);margin-top:4px;">No students match these filters in your assigned classes.</div></div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadStudents(); });
          return;
        }

        const anyRowAction = CAN_VIEW_DETAILS || CAN_EDIT_STUDENT;
        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr>
                  <th>Student</th><th>Department</th><th>Class</th><th>Section</th>
                  <th>Academic Year</th><th>Roll</th><th>Status</th>
                  ${anyRowAction ? '<th class="text-end">Actions</th>' : ''}
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
                      ${anyRowAction ? `<td class="text-end">
                        <div class="btn-group">
                          ${CAN_VIEW_DETAILS ? `<a class="btn btn-portal-outline btn-sm" href="../student-details.html?id=${encodeURIComponent(s.id)}" title="View"><i class="fa-solid fa-eye"></i></a>` : ''}
                          ${CAN_EDIT_STUDENT ? `<button class="btn btn-portal-outline btn-sm edit-student-btn" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>` : ''}
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
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${U.escapeHtml(err.message)}</div></div>`;
      });
  }
})();
