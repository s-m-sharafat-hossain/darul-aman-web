(function () {
  // Every role that already holds some form of student-view access in the
  // existing backend (scope.js's getAccessibleStudentIds) can reach this
  // page's shell — this deliberately includes accountant/receptionist/
  // librarian/super_admin, which the spec's own role list for this step
  // omitted, because Admin Students' "View" action (built in Step 8)
  // already links here for those roles; narrowing this list would break
  // that existing, already-shipped link. Backend authorization
  // (assertCanAccessStudent) is what actually decides what data comes back
  // — this list only decides who gets past the page shell at all.
  const ALLOWED_ROLES = ['admin', 'principal', 'accountant', 'receptionist', 'librarian', 'super_admin', 'teacher', 'hifz_teacher', 'student'];
  const user = window.DAA_API.requireAuth(ALLOWED_ROLES);
  if (!user) return;
  const U = window.DAA_UTIL;

  const ADMIN_TIER = ['admin', 'super_admin', 'principal'].includes(user.role);
  // student.edit holders (see prisma/seed.js) — admin/principal always;
  // teacher/hifz_teacher too, but the backend independently blocks them
  // from touching placement/status fields regardless of this flag.
  const CAN_EDIT = ADMIN_TIER || ['teacher', 'hifz_teacher'].includes(user.role);
  const CAN_TRANSFER = ADMIN_TIER; // student.transfer — admin/principal only
  const CAN_ARCHIVE = ADMIN_TIER; // student.archive — admin/principal only
  const CAN_UPLOAD_DOCUMENT = ADMIN_TIER; // student.document.upload — admin/principal only, never inferred from student.edit

  const studentId = new URLSearchParams(location.search).get('id');

  // ---- root-level page: adjust nav.js's role-folder-relative hrefs -------
  // nav.js's hrefs are written relative to a role's own subfolder (e.g.
  // 'students.html' from inside portal/admin/); this page lives at
  // portal/ root, one level up, so every href needs the role's folder
  // prepended — except entries already written as a cross-folder '../...'
  // link (e.g. super_admin's Students entry), which only need one leading
  // '../' stripped to resolve correctly from here instead.
  function rootAdjustedNavItems(role) {
    const folder = window.DAA_NAV.folderFor(role);
    return window.DAA_NAV.itemsFor(role).map((item) => {
      const href = item.href.startsWith('../') ? item.href.slice(3) : `${folder}/${item.href}`;
      return Object.assign({}, item, { href });
    });
  }
  function backHref(role) {
    if (role === 'student') return 'student/profile.html';
    if (['teacher', 'hifz_teacher'].includes(role)) return 'teacher/students.html';
    return 'admin/students.html';
  }

  // rootPrefix '' is correct here (not '../'): shell.js uses it only for the
  // logo path and the logout redirect, both of which are one level shallower
  // from portal/ root than from a role subfolder.
  const content = window.DAA_SHELL.render({
    rootPrefix: '',
    pageTitle: 'Student Details',
    pageSubtitle: '',
    activeKey: '__none__', // never matches a real nav key — no sidebar item should highlight on this shared detail page
    navItems: rootAdjustedNavItems(user.role),
  });
  window.DAA_SHELL.setTopbarName(user.userCode);

  if (!studentId) {
    renderFatalError({ status: 404, message: 'No student was specified.' });
    return;
  }

  content.innerHTML = `<div class="skeleton" style="height:160px;border-radius:14px;margin-bottom:16px;"></div><div class="skeleton" style="height:320px;border-radius:14px;"></div>`;

  let student = null;
  let allClasses = []; // only needed to resolve Enrollment history rows' bare classId/sectionId to names
  const tabLoaded = {}; // per-tab session cache so switching back to an already-opened tab doesn't refetch

  Promise.all([
    window.DAA_API.get(`/students/${encodeURIComponent(studentId)}`),
    window.DAA_API.get('/academic/classes'),
  ])
    .then(([s, classes]) => {
      student = s;
      allClasses = classes;
      renderPage();
    })
    .catch((err) => renderFatalError(err));

  // ---- fatal (whole-page) error states -------------------------------------

  function renderFatalError(err) {
    const status = err && err.status;
    let title = 'Something Went Wrong';
    let body = (err && err.message) || 'Please try again.';
    if (status === 404) {
      title = 'Student Not Found';
      body = 'This student record does not exist, or has been removed.';
    } else if (status === 403) {
      // Deliberately generic — never confirms or denies that the id exists,
      // matching the backend's own intentionally uninformative 403 message.
      title = 'Access Restricted';
      body = 'You do not have access to this student\u2019s records.';
    } else if (status === 401) {
      // api.js's own refresh/redirect-to-login flow already handles this —
      // if we still got here, just show a neutral message rather than guess.
      title = 'Session Expired';
      body = 'Please log in again.';
    }
    content.innerHTML = `
      <div class="p-card">
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          ${U.escapeHtml(title)}
          <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${U.escapeHtml(body)}</div>
          <a class="btn btn-portal-outline btn-sm mt-3" href="${backHref(user.role)}">Back</a>
        </div>
      </div>`;
  }

  // ---- small local helpers -------------------------------------------------

  function fmtMoney(n) { return U.fmtMoney(n); }
  function fmtDate(d) { return U.fmtDate(d); }
  function classNameFor(classId) { const c = allClasses.find((x) => String(x.id) === String(classId)); return c ? c.name : '—'; }
  function sectionNameFor(classId, sectionId) {
    if (!sectionId) return '—';
    const c = allClasses.find((x) => String(x.id) === String(classId));
    const s = c && (c.sections || []).find((x) => String(x.id) === String(sectionId));
    return s ? s.name : '—';
  }
  function field(label, value) {
    return `<div class="col-md-4 col-6"><div style="font-size:11.5px;color:var(--muted);">${U.escapeHtml(label)}</div><div style="font-weight:600;">${value == null || value === '' ? '—' : U.escapeHtml(String(value))}</div></div>`;
  }
  function loadingRow(label) {
    return `<div class="empty-state"><div class="skeleton" style="height:80px;border-radius:10px;"></div><div style="margin-top:8px;">Loading ${U.escapeHtml(label)}...</div></div>`;
  }
  function errorState(err) {
    return `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${U.escapeHtml((err && err.message) || 'Failed to load.')}</div>`;
  }
  function emptyState(icon, text) {
    return `<div class="empty-state"><i class="fa-solid ${icon}"></i>${U.escapeHtml(text)}</div>`;
  }

  // ---- page shell + header -------------------------------------------------

  function renderPage() {
    const s = student;
    content.innerHTML = `
      <div class="print-only print-header">
        <div class="print-academy-name">Darul Aman Academy</div>
        <div class="print-doc-title">Student Profile</div>
      </div>

      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 no-print">
        <a href="${backHref(user.role)}" style="font-size:13px;color:var(--green-deep);font-weight:700;text-decoration:none;"><i class="fa-solid fa-arrow-left me-1"></i>Back to Students</a>
      </div>

      <div class="p-card mb-3 student-header-card">
        <div class="d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div class="d-flex gap-3 align-items-center">
            <div style="width:64px;height:64px;font-size:22px;">${U.avatarHtml(s, '')}</div>
            <div>
              <div style="font-weight:800;font-size:1.15rem;font-family:var(--font-display);color:var(--green-deep);">${U.escapeHtml(s.fullName)}</div>
              <div style="font-size:12.5px;color:var(--muted);">Student ID: ${U.escapeHtml(s.studentCode)}</div>
              <div style="font-size:13px;margin-top:4px;">
                ${U.escapeHtml(s.department?.name || '—')} • ${U.escapeHtml(s.currentClass?.name || '—')} • ${U.escapeHtml(s.currentSection?.name || '—')}
                &nbsp;·&nbsp;Roll: ${U.escapeHtml(s.rollNumber || '—')}
                &nbsp;·&nbsp;Session: ${U.escapeHtml(s.academicYear?.name || '—')}
              </div>
              <div style="margin-top:6px;">${U.statusBadge(s.status)}</div>
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap no-print">
            ${CAN_EDIT ? `<button class="btn btn-portal-outline btn-sm" id="editStudentBtn"><i class="fa-solid fa-pen me-1"></i>Edit</button>` : ''}
            ${CAN_TRANSFER ? `<button class="btn btn-portal-outline btn-sm" id="transferStudentBtn"><i class="fa-solid fa-right-left me-1"></i>Transfer</button>` : ''}
            ${CAN_ARCHIVE ? `<button class="btn btn-portal-outline btn-sm" id="archiveStudentBtn"><i class="fa-solid fa-box-archive me-1"></i>Archive</button>` : ''}
            <button class="btn btn-portal-outline btn-sm" id="printStudentBtn"><i class="fa-solid fa-print me-1"></i>Print</button>
          </div>
        </div>
      </div>

      <div class="p-card">
        <ul class="nav nav-tabs student-detail-tabs no-print" id="sdTabs" role="tablist">
          ${tabButton('overview', 'Overview', true)}
          ${tabButton('academic', 'Academic')}
          ${tabButton('attendance', 'Attendance')}
          ${tabButton('exams', 'Exams & Results')}
          ${tabButton('hifz', 'Hifz')}
          ${tabButton('assignments', 'Assignments')}
          ${tabButton('fees', 'Fees')}
          ${tabButton('documents', 'Documents')}
        </ul>
        <div class="tab-content pt-3" id="sdTabContent">
          <div class="tab-pane fade show active" id="tab-overview" role="tabpanel">${overviewHtml(s)}</div>
          <div class="tab-pane fade" id="tab-academic" role="tabpanel">${academicHtml(s)}</div>
          <div class="tab-pane fade" id="tab-attendance" role="tabpanel">${loadingRow('attendance')}</div>
          <div class="tab-pane fade" id="tab-exams" role="tabpanel">${loadingRow('exam results')}</div>
          <div class="tab-pane fade" id="tab-hifz" role="tabpanel">${loadingRow('Hifz progress')}</div>
          <div class="tab-pane fade" id="tab-assignments" role="tabpanel">${loadingRow('assignments')}</div>
          <div class="tab-pane fade" id="tab-fees" role="tabpanel">${loadingRow('fee invoices')}</div>
          <div class="tab-pane fade" id="tab-documents" role="tabpanel">${loadingRow('documents')}</div>
        </div>
      </div>
    `;

    wireHeaderActions();
    wireTabs();
  }

  function tabButton(key, label, active) {
    return `<li class="nav-item" role="presentation">
      <button class="nav-link ${active ? 'active' : ''}" id="tabbtn-${key}" data-bs-toggle="tab" data-bs-target="#tab-${key}" type="button" role="tab" aria-controls="tab-${key}" aria-selected="${active ? 'true' : 'false'}">${U.escapeHtml(label)}</button>
    </li>`;
  }

  // ---- header actions -------------------------------------------------------

  function wireHeaderActions() {
    const printBtn = document.getElementById('printStudentBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    if (CAN_EDIT) {
      const editBtn = document.getElementById('editStudentBtn');
      if (editBtn) editBtn.addEventListener('click', openEditModal);
    }
    if (CAN_TRANSFER) {
      const transferBtn = document.getElementById('transferStudentBtn');
      if (transferBtn) transferBtn.addEventListener('click', openTransferModal);
    }
    if (CAN_ARCHIVE) {
      const archiveBtn = document.getElementById('archiveStudentBtn');
      if (archiveBtn) archiveBtn.addEventListener('click', doArchive);
    }
  }

  function wireTabs() {
    // Lazy-load: Overview/Academic are already rendered from data we already
    // have. Every other tab fetches only the first time it's actually
    // opened, then is cached for the rest of this page's session (never in
    // localStorage — spec §23).
    const lazyTabs = {
      attendance: loadAttendance,
      exams: loadExams,
      hifz: loadHifz,
      assignments: loadAssignments,
      fees: loadFees,
      documents: loadDocuments,
    };
    Object.keys(lazyTabs).forEach((key) => {
      const btn = document.getElementById(`tabbtn-${key}`);
      if (!btn) return;
      btn.addEventListener('shown.bs.tab', () => {
        if (tabLoaded[key]) return;
        tabLoaded[key] = true;
        lazyTabs[key]();
      });
    });
  }

  // ================= TAB 1 — OVERVIEW =================

  function overviewHtml(s) {
    const guardianRows = (s.guardians || []).map((sg) => `
      <tr>
        <td>${U.escapeHtml(sg.guardian?.fullName)}</td>
        <td style="text-transform:capitalize;">${U.escapeHtml(sg.relation)}${sg.isPrimary ? ' <span class="badge-status badge-ok">Primary</span>' : ''}</td>
        <td>${U.escapeHtml(sg.guardian?.phone)}</td>
        <td>${U.escapeHtml(sg.guardian?.email)}</td>
        <td>${U.escapeHtml(sg.guardian?.occupation)}</td>
        <td>${U.escapeHtml(sg.guardian?.address)}</td>
      </tr>`).join('');

    return `
      <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:10px;">Personal Information</div>
      <div class="row g-3 mb-4">
        ${field('Full Name', s.fullName)}
        ${field('Student Code', s.studentCode)}
        ${field('Gender', s.gender)}
        ${field('Date of Birth', s.dateOfBirth ? fmtDate(s.dateOfBirth) : null)}
        ${field('Blood Group', s.bloodGroup)}
        ${field('Status', s.status)}
      </div>

      <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:10px;">Address</div>
      <div class="row g-3 mb-4">
        ${field('Present Address', s.presentAddress)}
        ${field('Permanent Address', s.permanentAddress)}
      </div>

      <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:10px;">Guardian Information</div>
      ${(s.guardians || []).length ? `
        <div class="table-responsive">
          <table class="table align-middle" style="font-size:13.5px;">
            <thead><tr><th>Guardian</th><th>Relation</th><th>Phone</th><th>Email</th><th>Occupation</th><th>Address</th></tr></thead>
            <tbody>${guardianRows}</tbody>
          </table>
        </div>
      ` : emptyState('fa-user-group', 'No guardian information available.')}
    `;
  }

  // ================= TAB 2 — ACADEMIC =================

  function academicHtml(s) {
    const historyRows = (s.enrollments || []).map((e) => `
      <tr>
        <td>${U.escapeHtml(e.academicYear?.name)}</td>
        <td>${U.escapeHtml(classNameFor(e.classId))}</td>
        <td>${U.escapeHtml(sectionNameFor(e.classId, e.sectionId))}</td>
        <td>${U.statusBadge(e.status)}</td>
      </tr>`).join('');

    return `
      <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:10px;">Current Academic Placement</div>
      <div class="row g-3 mb-4">
        ${field('Department', s.department?.name)}
        ${field('Class', s.currentClass?.name)}
        ${field('Section', s.currentSection?.name)}
        ${field('Roll Number', s.rollNumber)}
        ${field('Academic Year', s.academicYear?.name)}
        ${field('Admission Date', s.admissionDate ? fmtDate(s.admissionDate) : null)}
        ${field('Status', s.status)}
      </div>

      <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:10px;">Academic History</div>
      ${(s.enrollments || []).length ? `
        <div class="table-responsive">
          <table class="table align-middle" style="font-size:13.5px;">
            <thead><tr><th>Academic Year</th><th>Class</th><th>Section</th><th>Status</th></tr></thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>
      ` : emptyState('fa-clock-rotate-left', 'No historical enrollment records found.')}
    `;
  }

  // ================= TAB 3 — ATTENDANCE =================

  function loadAttendance() {
    const box = document.getElementById('tab-attendance');
    window.DAA_API.get(`/attendance/student/${encodeURIComponent(studentId)}`)
      .then((res) => {
        const sum = res.summary || {};
        const rows = (res.records || []).map((r) => `
          <tr><td>${fmtDate(r.attendanceDate)}</td><td>${U.statusBadge(r.status)}</td><td>${U.escapeHtml(r.remarks) || '—'}</td></tr>
        `).join('');
        box.innerHTML = `
          <div class="row g-3 mb-3">
            ${field('Present', sum.present)}
            ${field('Absent', sum.absent)}
            ${field('Late', sum.late)}
            ${field('Attendance %', sum.percentage != null ? sum.percentage + '%' : null)}
          </div>
          ${(res.records || []).length ? `
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>Date</th><th>Status</th><th>Remarks</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>` : emptyState('fa-calendar-xmark', 'No attendance records found.')}
        `;
      })
      .catch((err) => { box.innerHTML = errorState(err); tabLoaded.attendance = false; });
  }

  // ================= TAB 4 — EXAMS & RESULTS =================

  function loadExams() {
    const box = document.getElementById('tab-exams');
    window.DAA_API.get(`/exams/student/${encodeURIComponent(studentId)}/results`)
      .then((results) => {
        if (!results.length) { box.innerHTML = emptyState('fa-file-lines', 'No published examination results found.'); return; }
        const rows = results.map((r) => `
          <tr>
            <td>${U.escapeHtml(r.exam?.name)}</td>
            <td>${U.escapeHtml(r.exam?.examType)}</td>
            <td>${r.exam?.startDate ? fmtDate(r.exam.startDate) : '—'}</td>
            <td>${r.totalObtained != null ? U.escapeHtml(String(r.totalObtained)) : '—'} / ${r.totalFull != null ? U.escapeHtml(String(r.totalFull)) : '—'}</td>
            <td>${r.gpa != null ? U.escapeHtml(String(r.gpa)) : '—'}</td>
            <td>${U.escapeHtml(r.grade) || '—'}</td>
            <td>${r.isPass == null ? '—' : U.statusBadge(r.isPass ? 'approved' : 'rejected')}</td>
          </tr>`).join('');
        // Note: the existing exam results API returns one row per exam
        // (aggregate marks/gpa/grade), not a per-subject breakdown — this
        // table reflects exactly that shape rather than inventing a
        // Subject column the data doesn't have.
        box.innerHTML = `
          <div class="table-responsive">
            <table class="table align-middle" style="font-size:13.5px;">
              <thead><tr><th>Exam</th><th>Type</th><th>Date</th><th>Marks</th><th>GPA</th><th>Grade</th><th>Result</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      })
      .catch((err) => { box.innerHTML = errorState(err); tabLoaded.exams = false; });
  }

  // ================= TAB 5 — HIFZ =================

  function loadHifz() {
    const box = document.getElementById('tab-hifz');
    if (!student.isHifzStudent) {
      box.innerHTML = emptyState('fa-book-quran', 'This student is not currently enrolled in the Hifz program.');
      return;
    }
    window.DAA_API.get(`/hifz/student/${encodeURIComponent(studentId)}/overview`)
      .then((e) => {
        const evalRows = (e.dailyEvaluations || []).map((d) => `
          <tr>
            <td>${fmtDate(d.evaluationDate)}</td>
            <td>${d.sabakParaId ? 'Para ' + U.escapeHtml(String(d.sabakParaId)) : '—'}${d.sabakFromAyat ? ` (Ayat ${U.escapeHtml(String(d.sabakFromAyat))}\u2013${U.escapeHtml(String(d.sabakToAyat || d.sabakFromAyat))})` : ''}</td>
            <td>${U.escapeHtml(d.sabakQuality) || '—'}</td>
            <td>${d.mistakesCount ?? 0}</td>
          </tr>`).join('');
        box.innerHTML = `
          <div class="row g-3 mb-3">
            ${field('Current Para', e.currentParaId ? 'Para ' + e.currentParaId : null)}
            ${field('Current Surah', e.currentSurahId ? 'Surah #' + e.currentSurahId : null)}
            ${field('Paras Completed', e.parasCompleted)}
            ${field('Progress', e.completionPercent != null ? e.completionPercent + '%' : null)}
            ${field('Teacher', e.teacher?.staff?.fullName)}
            ${field('Status', e.status)}
          </div>
          <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);margin-bottom:10px;">Recent Evaluations</div>
          ${(e.dailyEvaluations || []).length ? `
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>Date</th><th>Sabak</th><th>Quality</th><th>Mistakes</th></tr></thead>
                <tbody>${evalRows}</tbody>
              </table>
            </div>` : emptyState('fa-book-quran', 'No evaluations recorded yet.')}
        `;
      })
      .catch((err) => {
        if (err.status === 404) {
          box.innerHTML = emptyState('fa-book-quran', 'This student is not currently enrolled in the Hifz program.');
        } else {
          box.innerHTML = errorState(err);
          tabLoaded.hifz = false;
        }
      });
  }

  // ================= TAB 6 — ASSIGNMENTS =================

  function loadAssignments() {
    const box = document.getElementById('tab-assignments');
    window.DAA_API.get(`/assignments/student/${encodeURIComponent(studentId)}`)
      .then((list) => {
        if (!list.length) { box.innerHTML = emptyState('fa-book-open', 'No assignments found.'); return; }
        const rows = list.map((a) => `
          <tr>
            <td>${U.escapeHtml(a.title)}</td>
            <td>${U.escapeHtml(a.subject?.name) || '—'}</td>
            <td>${a.dueDate ? fmtDate(a.dueDate) : '—'}</td>
            <td>${U.statusBadge(a.status)}</td>
          </tr>`).join('');
        box.innerHTML = `
          <div class="table-responsive">
            <table class="table align-middle" style="font-size:13.5px;">
              <thead><tr><th>Assignment</th><th>Subject</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      })
      .catch((err) => { box.innerHTML = errorState(err); tabLoaded.assignments = false; });
  }

  // ================= TAB 7 — FEES =================

  function loadFees() {
    const box = document.getElementById('tab-fees');
    // Mounted at /api/finance, not /api/fees — see backend/src/app.js.
    window.DAA_API.get(`/finance/student/${encodeURIComponent(studentId)}/invoices`)
      .then((res) => {
        const totals = res.totals || {};
        if (!(res.invoices || []).length) { box.innerHTML = emptyState('fa-file-invoice-dollar', 'No fee invoices found.'); return; }
        const rows = res.invoices.map((inv) => `
          <tr>
            <td>${U.escapeHtml(inv.feeCategory?.name) || '—'}</td>
            <td>${fmtMoney(inv.amountDue)}</td>
            <td>${fmtMoney(inv.amountPaid)}</td>
            <td>${fmtMoney(Number(inv.amountDue) - Number(inv.discountAmount || 0) - Number(inv.scholarshipAmount || 0) - Number(inv.amountPaid))}</td>
            <td>${U.statusBadge(inv.status)}</td>
          </tr>`).join('');
        box.innerHTML = `
          <div class="row g-3 mb-3">
            ${field('Total Due', fmtMoney(totals.totalDue))}
            ${field('Total Paid', fmtMoney(totals.totalPaid))}
            ${field('Outstanding', fmtMoney(totals.outstanding))}
          </div>
          <div class="table-responsive">
            <table class="table align-middle" style="font-size:13.5px;">
              <thead><tr><th>Invoice</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      })
      .catch((err) => { box.innerHTML = errorState(err); tabLoaded.fees = false; });
  }

  // ================= TAB 8 — DOCUMENTS =================

  const DOCUMENT_TYPE_LABELS = {
    photo: 'Student Photo',
    birth_certificate: 'Birth Certificate',
    previous_result: 'Previous Result',
    transfer_certificate: 'Transfer Certificate',
    other: 'Other Document',
  };

  function loadDocuments() {
    const box = document.getElementById('tab-documents');
    window.DAA_API.get(`/students/${encodeURIComponent(studentId)}/documents`)
      .then((docs) => {
        const rows = docs.map((d) => `
          <tr>
            <td>${U.escapeHtml(DOCUMENT_TYPE_LABELS[d.documentType] || d.documentType)}</td>
            <td>${d.isVerified ? U.statusBadge('approved') : U.statusBadge('pending')}</td>
            <td>${fmtDate(d.createdAt)}</td>
            <td class="text-end">
              <button class="btn btn-portal-outline btn-sm doc-view-btn" data-id="${d.id}"><i class="fa-solid fa-eye me-1"></i>View</button>
            </td>
          </tr>`).join('');
        box.innerHTML = `
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div style="font-weight:800;font-family:var(--font-display);color:var(--green-deep);">Documents</div>
            ${CAN_UPLOAD_DOCUMENT ? `
              <form id="docUploadForm" class="d-flex gap-2 flex-wrap align-items-center">
                <select class="form-control form-control-sm" id="docType" style="width:auto;">
                  <option value="photo">Student Photo</option>
                  <option value="birth_certificate">Birth Certificate</option>
                  <option value="previous_result">Previous Result</option>
                  <option value="transfer_certificate">Transfer Certificate</option>
                  <option value="other" selected>Other Document</option>
                </select>
                <input type="file" class="form-control form-control-sm" id="docFile" style="width:auto;" required>
                <button type="submit" class="btn btn-portal-primary btn-sm" id="docUploadBtn">Upload</button>
              </form>` : ''}
          </div>
          <div class="auth-error" id="docMsg" role="alert"></div>
          ${docs.length ? `
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>Document</th><th>Verified</th><th>Uploaded</th><th class="text-end">Actions</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>` : emptyState('fa-folder-open', 'No documents uploaded yet.')}
        `;

        document.querySelectorAll('.doc-view-btn').forEach((btn) => {
          btn.addEventListener('click', () => viewDocument(btn.dataset.id));
        });

        const form = document.getElementById('docUploadForm');
        if (form) {
          let uploading = false;
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (uploading) return;
            const msg = document.getElementById('docMsg');
            const btn = document.getElementById('docUploadBtn');
            const fileInput = document.getElementById('docFile');
            msg.classList.remove('show');
            if (!fileInput.files.length) return;
            uploading = true;
            btn.disabled = true;
            const originalLabel = btn.textContent;
            btn.textContent = 'Uploading...';
            try {
              // multipart/form-data upload — api.js's raw() only knows how to
              // send JSON, so this one request goes through fetch() directly,
              // still using the same config/token architecture (API base
              // URL + bearer token), not a second API client.
              const fd = new FormData();
              fd.append('file', fileInput.files[0]);
              fd.append('documentType', document.getElementById('docType').value);
              const res = await fetch(`${window.DAA_CONFIG.API_BASE_URL}/students/${encodeURIComponent(studentId)}/documents`, {
                method: 'POST',
                headers: window.DAA_API.getToken() ? { Authorization: 'Bearer ' + window.DAA_API.getToken() } : {},
                credentials: 'include',
                body: fd,
              });
              const json = await res.json().catch(() => null);
              if (!res.ok || (json && json.success === false)) {
                throw new Error((json && json.error && json.error.message) || 'Upload failed.');
              }
              tabLoaded.documents = false;
              loadDocuments();
            } catch (err) {
              msg.textContent = err.message;
              msg.classList.add('show');
            } finally {
              uploading = false;
              btn.disabled = false;
              btn.textContent = originalLabel;
            }
          });
        }
      })
      .catch((err) => { box.innerHTML = errorState(err); tabLoaded.documents = false; });
  }

  function viewDocument(docId) {
    // Streams through the authenticated GET /:id/documents/:docId/file
    // endpoint (fetch, with the bearer token) rather than a plain <a href>,
    // which wouldn't carry the Authorization header at all.
    fetch(`${window.DAA_CONFIG.API_BASE_URL}/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(docId)}/file`, {
      headers: window.DAA_API.getToken() ? { Authorization: 'Bearer ' + window.DAA_API.getToken() } : {},
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error((json && json.error && json.error.message) || 'Could not open document.');
        }
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      })
      .catch((err) => alert(err.message));
  }

  // ================= HEADER ACTIONS: Edit / Transfer / Archive =================
  // These reuse the same modal markup/behavior pattern as Admin Students
  // (Step 8) rather than a new component; kept local to this file since the
  // two pages render different surrounding shells.

  function openEditModal() {
    const s = student;
    const isAdminTier = ADMIN_TIER;
    const modalHtml = `
      <div class="modal fade" id="sdEditModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
        <div class="modal-header"><h5 class="modal-title">Edit Student</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body p-4">
          <div class="auth-error" id="sdEditMsg" role="alert"></div>
          <form id="sdEditForm">
            <div class="row g-2 mb-3">
              <div class="col-md-8"><label class="form-label">Full Name</label><input class="form-control" id="sdFullName" value="${U.escapeHtml(s.fullName)}" required></div>
              <div class="col-md-4"><label class="form-label">Blood Group</label><input class="form-control" id="sdBlood" value="${U.escapeHtml(s.bloodGroup || '')}"></div>
              <div class="col-md-4"><label class="form-label">Date of Birth</label><input type="date" class="form-control" id="sdDob" value="${s.dateOfBirth ? String(s.dateOfBirth).slice(0, 10) : ''}"></div>
              <div class="col-md-4"><label class="form-label">Gender</label><select class="form-control" id="sdGender"><option value="male" ${s.gender === 'male' ? 'selected' : ''}>Male</option><option value="female" ${s.gender === 'female' ? 'selected' : ''}>Female</option></select></div>
              <div class="col-md-4"><label class="form-label">Roll Number</label><input class="form-control" id="sdRoll" value="${U.escapeHtml(s.rollNumber || '')}"></div>
              <div class="col-md-6"><label class="form-label">Present Address</label><input class="form-control" id="sdPresentAddr" value="${U.escapeHtml(s.presentAddress || '')}"></div>
              <div class="col-md-6"><label class="form-label">Permanent Address</label><input class="form-control" id="sdPermanentAddr" value="${U.escapeHtml(s.permanentAddress || '')}"></div>
              ${isAdminTier ? `<div class="col-md-4"><label class="form-label">Status</label><select class="form-control" id="sdStatus">
                ${['active', 'inactive', 'transferred', 'graduated', 'archived'].map((st) => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}
              </select></div>` : ''}
            </div>
            ${!isAdminTier ? `<p style="font-size:12px;color:var(--muted);">Department, class, section, academic year and status can only be changed by an admin.</p>` : ''}
            <button type="submit" class="btn btn-portal-primary" id="sdEditSubmit"><span class="btn-label">Save Changes</span><span class="spinner-border spinner-border-sm ms-2 d-none"></span></button>
          </form>
        </div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('sdEditModal');
    const modal = new bootstrap.Modal(modalEl);
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
    modal.show();

    let submitting = false;
    document.getElementById('sdEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const msg = document.getElementById('sdEditMsg');
      const btn = document.getElementById('sdEditSubmit');
      msg.classList.remove('show');
      submitting = true;
      btn.disabled = true;
      btn.querySelector('.spinner-border').classList.remove('d-none');
      try {
        const payload = {
          fullName: document.getElementById('sdFullName').value.trim(),
          bloodGroup: document.getElementById('sdBlood').value.trim() || undefined,
          dateOfBirth: document.getElementById('sdDob').value || undefined,
          gender: document.getElementById('sdGender').value,
          rollNumber: document.getElementById('sdRoll').value.trim() || undefined,
          presentAddress: document.getElementById('sdPresentAddr').value.trim() || undefined,
          permanentAddress: document.getElementById('sdPermanentAddr').value.trim() || undefined,
        };
        if (isAdminTier) payload.status = document.getElementById('sdStatus').value;
        const updated = await window.DAA_API.patch(`/students/${encodeURIComponent(studentId)}`, payload);
        student = Object.assign({}, student, updated);
        modal.hide();
        renderPage();
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

  function openTransferModal() {
    const s = student;
    function deptOptions(sel) { return `<option value="">— Select —</option>` + [...new Map(allClasses.map((c) => [c.departmentId, c.department])).values()].map((d) => `<option value="${d.id}" ${String(d.id) === String(sel) ? 'selected' : ''}>${U.escapeHtml(d.name)}</option>`).join(''); }
    function classOptions(deptId, sel) { const list = deptId ? allClasses.filter((c) => String(c.departmentId) === String(deptId)) : []; return `<option value="">${deptId ? '— Select —' : 'Select department first'}</option>` + list.map((c) => `<option value="${c.id}" ${String(c.id) === String(sel) ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join(''); }
    function sectionOptions(classId, sel) { const c = allClasses.find((x) => String(x.id) === String(classId)); const list = (c && c.sections) || []; return `<option value="">${classId ? '— Select —' : 'Select class first'}</option>` + list.map((sec) => `<option value="${sec.id}" ${String(sec.id) === String(sel) ? 'selected' : ''}>${U.escapeHtml(sec.name)}</option>`).join(''); }

    const deptId = s.department?.id || '';
    const classId = s.currentClass?.id || '';
    const sectionId = s.currentSection?.id || '';

    const modalHtml = `
      <div class="modal fade" id="sdTransferModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
        <div class="modal-header"><h5 class="modal-title">Transfer Student</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body p-4">
          <p style="font-weight:700;color:var(--green-deep);">${U.escapeHtml(s.fullName)} (${U.escapeHtml(s.studentCode)})</p>
          <div class="auth-error" id="sdTransferMsg" role="alert"></div>
          <form id="sdTransferForm">
            <div class="row g-2">
              <div class="col-12"><label class="form-label">Department</label><select class="form-control" id="sdTfDept" required>${deptOptions(deptId)}</select></div>
              <div class="col-12"><label class="form-label">Class</label><select class="form-control" id="sdTfClass" required>${classOptions(deptId, classId)}</select></div>
              <div class="col-12"><label class="form-label">Section</label><select class="form-control" id="sdTfSection">${sectionOptions(classId, sectionId)}</select></div>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:10px 0 0;">This only changes current placement — attendance, exam, fee, Hifz and assignment history are kept as they are.</p>
            <button type="submit" class="btn btn-portal-primary mt-3" id="sdTransferSubmit"><span class="btn-label">Confirm Transfer</span><span class="spinner-border spinner-border-sm ms-2 d-none"></span></button>
          </form>
        </div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('sdTransferModal');
    const modal = new bootstrap.Modal(modalEl);
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
    modal.show();

    document.getElementById('sdTfDept').addEventListener('change', (e) => {
      document.getElementById('sdTfClass').innerHTML = classOptions(e.target.value, '');
      document.getElementById('sdTfSection').innerHTML = sectionOptions('', '');
    });
    document.getElementById('sdTfClass').addEventListener('change', (e) => {
      document.getElementById('sdTfSection').innerHTML = sectionOptions(e.target.value, '');
    });

    let submitting = false;
    document.getElementById('sdTransferForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting) return;
      const msg = document.getElementById('sdTransferMsg');
      const btn = document.getElementById('sdTransferSubmit');
      msg.classList.remove('show');
      submitting = true;
      btn.disabled = true;
      btn.querySelector('.spinner-border').classList.remove('d-none');
      try {
        const payload = {
          departmentId: Number(document.getElementById('sdTfDept').value),
          classId: Number(document.getElementById('sdTfClass').value),
          sectionId: document.getElementById('sdTfSection').value ? Number(document.getElementById('sdTfSection').value) : undefined,
        };
        const updated = await window.DAA_API.post(`/students/${encodeURIComponent(studentId)}/transfer`, payload);
        student = Object.assign({}, student, updated);
        modal.hide();
        renderPage();
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

  function doArchive() {
    if (!confirm(`Are you sure you want to archive ${student.fullName} (${student.studentCode})? This does not delete the student — history is kept, and an admin can still view the record afterwards.`)) return;
    const btn = document.getElementById('archiveStudentBtn');
    btn.disabled = true;
    window.DAA_API.post(`/students/${encodeURIComponent(studentId)}/archive`, {})
      .then((updated) => {
        student = Object.assign({}, student, updated);
        renderPage();
      })
      .catch((err) => { alert(err.message); btn.disabled = false; });
  }
})();
