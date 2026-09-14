(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;
  const U = window.DAA_UTIL;
  let studentId = null;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Profile',
    pageSubtitle: 'Your academic profile',
    activeKey: 'profile',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;

  window.DAA_API.get('/dashboard/student')
    .then((dash) => {
      const p = dash.profile;
      studentId = p?.id;
      window.DAA_SHELL.setTopbarName(p?.fullName);

      content.innerHTML = `
        <div class="row g-3">
          <div class="col-lg-6">
            <div class="p-card">
              <h5><i class="fa-solid fa-id-card"></i> Profile Information</h5>
              <ul class="list-clean">
                <li><span>Full Name</span><strong>${U.escapeHtml(p?.fullName)}</strong></li>
                <li><span>Student Code</span><strong>${p?.studentCode || '—'}</strong></li>
                <li><span>Roll Number</span><strong>${p?.rollNumber || '—'}</strong></li>
                <li><span>Class</span><strong>${p?.currentClass?.name || '—'}</strong></li>
                <li><span>Section</span><strong>${p?.currentSection?.name || '—'}</strong></li>
                <li><span>Department</span><strong>${p?.department?.name || '—'}</strong></li>
                <li><span>Status</span>${U.statusBadge(p?.status)}</li>
              </ul>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="p-card">
              <h5><i class="fa-solid fa-pen-to-square"></i> Request a Profile Update</h5>
              <p style="color:var(--muted);font-size:13px;">Changes to your official record need staff approval — submit a request and the office will review it.</p>
              <div class="auth-error" id="reqMsg"></div>
              <form id="reqForm">
                <div class="mb-2">
                  <label class="form-label">Field to change</label>
                  <select class="form-control" id="reqField">
                    <option value="phone">Phone Number</option>
                    <option value="email">Email</option>
                    <option value="address">Address</option>
                    <option value="photoUrl">Photo</option>
                  </select>
                </div>
                <div class="mb-2">
                  <label class="form-label">New Value</label>
                  <input type="text" class="form-control" id="reqValue" required>
                </div>
                <button type="submit" class="btn btn-portal-primary btn-sm mt-1" id="reqSubmit">Submit Request</button>
              </form>
            </div>
          </div>
        </div>
      `;

      document.getElementById('reqForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('reqMsg');
        const btn = document.getElementById('reqSubmit');
        msg.classList.remove('show');
        btn.disabled = true;
        try {
          await window.DAA_API.post(`/students/${studentId}/profile-update-requests`, {
            fieldName: document.getElementById('reqField').value,
            newValue: document.getElementById('reqValue').value.trim(),
          });
          msg.style.background = 'var(--ok-soft)';
          msg.style.color = 'var(--ok)';
          msg.textContent = 'Request submitted. The office will review it shortly.';
          msg.classList.add('show');
          document.getElementById('reqForm').reset();
        } catch (err) {
          msg.style.background = 'var(--danger-soft)';
          msg.style.color = 'var(--danger)';
          msg.textContent = err.message;
          msg.classList.add('show');
        } finally {
          btn.disabled = false;
        }
      });
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
