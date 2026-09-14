(function () {
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'receptionist', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Admissions',
    pageSubtitle: 'Review applications and finalize enrollment',
    activeKey: 'admissions',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let classes = [];
  let years = [];
  let applications = [];
  let page = 1;
  const limit = 20;

  Promise.all([
    window.DAA_API.get('/academic/classes'),
    window.DAA_API.get('/academic/years'),
  ]).then(([cls, yrs]) => {
    classes = cls;
    years = yrs;
    renderShell();
    loadApplications();
  }).catch((err) => {
    content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
  });

  function renderShell() {
    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Status</label>
            <select class="form-control" id="filterStatus">
              <option value="">All</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="correction_requested">Correction Requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>
      <div id="tableBox"></div>

      <div class="modal fade" id="reviewModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Review Application</h5>
            <div class="auth-error" id="reviewMsg"></div>
            <div id="reviewDetail" class="mb-3" style="font-size:13px;background:var(--cream,#FBF7EE);border-radius:10px;padding:12px 14px;"></div>
            <div class="mb-2"><label class="form-label">Decision</label>
              <select class="form-control" id="rvStatus">
                <option value="under_review">Under Review</option>
                <option value="correction_requested">Request Correction</option>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
            <div class="mb-3"><label class="form-label">Note (optional)</label><textarea class="form-control" id="rvNote" rows="2"></textarea></div>
            <button class="btn btn-portal-primary w-100" id="rvSubmit">Save Decision</button>
          </div>
        </div></div>
      </div>

      <div class="modal fade" id="finalizeModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Finalize Admission</h5>
            <div class="auth-error" id="finMsg"></div>
            <div class="row g-2">
              <div class="col-md-6"><label class="form-label">Class</label>
                <select class="form-control" id="fnClass">${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
              </div>
              <div class="col-md-6"><label class="form-label">Section</label><select class="form-control" id="fnSection"></select></div>
              <div class="col-md-6"><label class="form-label">Academic Year</label>
                <select class="form-control" id="fnYear">${years.map(y => `<option value="${y.id}" ${y.isCurrent ? 'selected' : ''}>${y.name || y.id}</option>`).join('')}</select>
              </div>
              <div class="col-md-6">
                <label class="form-label d-block">Create Portal Account?</label>
                <div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="fnPortal" checked></div>
              </div>
            </div>
            <button class="btn btn-portal-primary w-100 mt-3" id="fnSubmit">Confirm & Enroll</button>
          </div>
        </div></div>
      </div>

      <div class="modal fade" id="resultModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4 text-center">
            <i class="fa-solid fa-circle-check" style="font-size:32px;color:var(--ok);margin-bottom:10px;"></i>
            <h5>Student Enrolled</h5>
            <p id="resultText" style="font-size:14px;"></p>
          </div>
        </div></div>
      </div>
    `;

    document.getElementById('filterStatus').addEventListener('change', () => { page = 1; loadApplications(); });
    document.getElementById('fnClass').addEventListener('change', (e) => {
      const cls = classes.find(c => String(c.id) === e.target.value);
      document.getElementById('fnSection').innerHTML = (cls?.sections || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    });
    document.getElementById('fnClass').dispatchEvent(new Event('change'));
  }

  function loadApplications() {
    const box = document.getElementById('tableBox');
    box.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;
    const status = document.getElementById('filterStatus').value;

    let qs = `page=${page}&limit=${limit}`;
    if (status) qs += `&status=${status}`;

    window.DAA_API.get(`/admissions?${qs}`)
      .then((apps) => {
        applications = apps;
        const meta = apps._meta;
        const totalPages = meta ? meta.totalPages : null;
        const hasNext = meta ? page < totalPages : apps.length >= limit;

        if (!apps.length) {
          box.innerHTML = `<div class="p-card">
            <div class="empty-state"><i class="fa-solid fa-file-signature"></i>No applications found.</div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadApplications(); });
          return;
        }
        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>App #</th><th>Applicant</th><th>Guardian</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
                <tbody>
                  ${apps.map(a => `
                    <tr>
                      <td>${a.applicationNumber}</td>
                      <td>${U.escapeHtml(a.applicantName)}</td>
                      <td>${U.escapeHtml(a.guardianName)}<br><span style="color:var(--muted);font-size:12px;">${a.guardianPhone}</span></td>
                      <td>${U.statusBadge(a.status)}</td>
                      <td>${U.fmtDate(a.submittedAt)}</td>
                      <td>
                        <button class="btn btn-portal-outline btn-sm review-btn" data-id="${a.id}">Review</button>
                        ${a.status === 'approved' && !a.resultingStudentId ? `<button class="btn btn-portal-primary btn-sm finalize-btn" data-id="${a.id}">Enroll</button>` : ''}
                        ${a.resultingStudentId ? `<span class="badge-status badge-ok">Enrolled</span>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <span style="font-size:12.5px;color:var(--muted);">${meta ? `Page ${page} of ${totalPages} &middot; ${meta.total} application(s)` : `Page ${page}`}</span>
              <div class="btn-group">
                <button class="btn btn-portal-outline btn-sm" id="prevPage" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <button class="btn btn-portal-outline btn-sm" id="nextPage" ${hasNext ? '' : 'disabled'}>Next</button>
              </div>
            </div>
          </div>
        `;
        wireRowActions();
        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.addEventListener('click', () => { page--; loadApplications(); });
        if (next) next.addEventListener('click', () => { page++; loadApplications(); });
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
  }

  function wireRowActions() {
    let activeId = null;
    const reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    const finalizeModal = new bootstrap.Modal(document.getElementById('finalizeModal'));
    const resultModal = new bootstrap.Modal(document.getElementById('resultModal'));

    document.querySelectorAll('.review-btn').forEach(btn => btn.addEventListener('click', () => {
      activeId = btn.dataset.id;
      const app = applications.find(a => String(a.id) === String(activeId));
      document.getElementById('reviewMsg').classList.remove('show');
      const detail = document.getElementById('reviewDetail');
      if (app) {
        detail.innerHTML = `
          <div><strong>${U.escapeHtml(app.applicantName)}</strong>${app.dateOfBirth ? ' &middot; DOB ' + U.fmtDate(app.dateOfBirth) : ''}</div>
          <div>Guardian: ${U.escapeHtml(app.guardianName)} (${app.guardianPhone})</div>
          ${app.previousSchool ? `<div>Previous school: ${U.escapeHtml(app.previousSchool)}</div>` : ''}
          ${app.address ? `<div style="white-space:pre-wrap;margin-top:6px;">${U.escapeHtml(app.address)}</div>` : ''}
        `;
      } else {
        detail.innerHTML = '';
      }
      reviewModal.show();
    }));

    document.getElementById('rvSubmit').onclick = async () => {
      const msg = document.getElementById('reviewMsg');
      const btn = document.getElementById('rvSubmit');
      btn.disabled = true;
      try {
        await window.DAA_API.patch(`/admissions/${activeId}/review`, {
          status: document.getElementById('rvStatus').value,
          reviewNote: document.getElementById('rvNote').value.trim() || undefined,
        });
        reviewModal.hide();
        loadApplications();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    };

    document.querySelectorAll('.finalize-btn').forEach(btn => btn.addEventListener('click', () => {
      activeId = btn.dataset.id;
      document.getElementById('finMsg').classList.remove('show');
      finalizeModal.show();
    }));

    document.getElementById('fnSubmit').onclick = async () => {
      const msg = document.getElementById('finMsg');
      const btn = document.getElementById('fnSubmit');
      btn.disabled = true;
      try {
        const result = await window.DAA_API.post(`/admissions/${activeId}/finalize`, {
          currentClassId: Number(document.getElementById('fnClass').value),
          currentSectionId: document.getElementById('fnSection').value ? Number(document.getElementById('fnSection').value) : undefined,
          academicYearId: Number(document.getElementById('fnYear').value),
          createPortalAccount: document.getElementById('fnPortal').checked,
        });
        finalizeModal.hide();
        if (result.portalCredentials) {
          document.getElementById('resultText').innerHTML = `Student Code: <strong>${result.portalCredentials.userCode}</strong><br>Temporary Password: <strong>${result.portalCredentials.temporaryPassword}</strong>`;
        } else {
          document.getElementById('resultText').textContent = 'Student record created (no portal account requested).';
        }
        resultModal.show();
        loadApplications();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    };
  }
})();
