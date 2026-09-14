(function () {
  const user = window.DAA_API.requireAuth(['super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Users & Roles',
    pageSubtitle: 'Manage portal accounts and role assignments',
    activeKey: 'users',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  const ROLE_OPTIONS = ['student', 'guardian', 'teacher', 'hifz_teacher', 'hifz_coordinator', 'admin', 'principal', 'accountant', 'receptionist', 'librarian', 'super_admin'];

  let page = 1;
  const limit = 20;

  function renderShell() {
    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Search</label>
            <input type="text" class="form-control" id="searchInput" placeholder="User code, email or phone">
          </div>
          <div class="col-md-3">
            <label class="form-label">Role</label>
            <select class="form-control" id="filterRole">
              <option value="">All roles</option>
              ${ROLE_OPTIONS.map(r => `<option value="${r}">${r.replace('_', ' ')}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Status</label>
            <select class="form-control" id="filterStatus">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-portal-primary w-100" id="addUserBtn"><i class="fa-solid fa-plus me-1"></i>New</button>
          </div>
        </div>
      </div>
      <div id="userTableBox"></div>

      <div class="modal fade" id="addModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Create Portal Account</h5>
            <div class="auth-error" id="addMsg"></div>
            <form id="addForm">
              <div class="mb-2"><label class="form-label">Role</label>
                <select class="form-control" id="npRole">${ROLE_OPTIONS.map(r => `<option value="${r}">${r.replace('_', ' ')}</option>`).join('')}</select>
              </div>
              <div class="mb-2"><label class="form-label">Email (optional)</label><input type="email" class="form-control" id="npEmail"></div>
              <div class="mb-2"><label class="form-label">Phone (optional)</label><input class="form-control" id="npPhone"></div>
              <p style="font-size:12px;color:var(--muted);">A temporary password will be generated automatically.</p>
              <button type="submit" class="btn btn-portal-primary w-100" id="addSubmit">Create Account</button>
            </form>
          </div>
        </div></div>
      </div>

      <div class="modal fade" id="resultModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4 text-center">
            <i class="fa-solid fa-circle-check" style="font-size:32px;color:var(--ok);margin-bottom:10px;"></i>
            <h5>Account Created</h5>
            <p id="resultText" style="font-size:14px;"></p>
          </div>
        </div></div>
      </div>
    `;

    let debounce;
    document.getElementById('searchInput').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { page = 1; loadUsers(); }, 400); });
    document.getElementById('filterRole').addEventListener('change', () => { page = 1; loadUsers(); });
    document.getElementById('filterStatus').addEventListener('change', () => { page = 1; loadUsers(); });

    const addModal = new bootstrap.Modal(document.getElementById('addModal'));
    const resultModal = new bootstrap.Modal(document.getElementById('resultModal'));
    document.getElementById('addUserBtn').addEventListener('click', () => addModal.show());

    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('addMsg');
      const btn = document.getElementById('addSubmit');
      msg.classList.remove('show');
      btn.disabled = true;
      try {
        const result = await window.DAA_API.post('/users', {
          roleName: document.getElementById('npRole').value,
          email: document.getElementById('npEmail').value.trim() || undefined,
          phone: document.getElementById('npPhone').value.trim() || undefined,
        });
        addModal.hide();
        document.getElementById('addForm').reset();
        document.getElementById('resultText').innerHTML = `User Code: <strong>${result.userCode}</strong><br>Temporary Password: <strong>${result.temporaryPassword || '(kept as provided)'}</strong>`;
        resultModal.show();
        loadUsers();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });
  }

  function loadUsers() {
    const box = document.getElementById('userTableBox');
    box.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;

    const search = document.getElementById('searchInput').value.trim();
    const roleName = document.getElementById('filterRole').value;
    const isActive = document.getElementById('filterStatus').value;

    let qs = `page=${page}&limit=${limit}`;
    if (search) qs += `&search=${encodeURIComponent(search)}`;
    if (roleName) qs += `&roleName=${roleName}`;
    if (isActive) qs += `&isActive=${isActive}`;

    window.DAA_API.get(`/users?${qs}`)
      .then((users) => {
        const meta = users._meta;
        const totalPages = meta ? meta.totalPages : null;
        const hasNext = meta ? page < totalPages : users.length >= limit;

        if (!users.length) {
          box.innerHTML = `<div class="p-card">
            <div class="empty-state"><i class="fa-solid fa-users"></i>No users found.</div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadUsers(); });
          return;
        }
        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr><th>Code</th><th>Contact</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
                <tbody>
                  ${users.map(u => `
                    <tr>
                      <td>${u.userCode}</td>
                      <td>${u.email || u.phone || '—'}</td>
                      <td><span class="badge-status badge-muted">${u.role?.name?.replace('_', ' ')}</span></td>
                      <td>${U.statusBadge(u.isActive ? 'active' : 'inactive')}</td>
                      <td>${u.lastLoginAt ? U.fmtDate(u.lastLoginAt) : 'Never'}</td>
                      <td>
                        <div class="dropdown">
                          <button class="btn btn-portal-outline btn-sm dropdown-toggle" data-bs-toggle="dropdown">Actions</button>
                          <ul class="dropdown-menu">
                            ${u.isActive
                              ? `<li><a class="dropdown-item action-disable" href="#" data-id="${u.id}">Disable</a></li>`
                              : `<li><a class="dropdown-item action-activate" href="#" data-id="${u.id}">Activate</a></li>`}
                            <li><a class="dropdown-item action-reset" href="#" data-id="${u.id}">Reset Password</a></li>
                            <li><a class="dropdown-item action-role" href="#" data-id="${u.id}">Change Role</a></li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
              <span style="font-size:12.5px;color:var(--muted);">${meta ? `Page ${page} of ${totalPages} &middot; ${meta.total} user(s)` : `Page ${page}`}</span>
              <div class="btn-group">
                <button class="btn btn-portal-outline btn-sm" id="prevPage" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <button class="btn btn-portal-outline btn-sm" id="nextPage" ${hasNext ? '' : 'disabled'}>Next</button>
              </div>
            </div>
          </div>
        `;
        wireActions();
        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.addEventListener('click', () => { page--; loadUsers(); });
        if (next) next.addEventListener('click', () => { page++; loadUsers(); });
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
  }

  function wireActions() {
    document.querySelectorAll('.action-disable').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const el = e.currentTarget;
      if (el.classList.contains('disabled')) return;
      if (!confirm('Disable this user? They will be logged out immediately.')) return;
      el.classList.add('disabled');
      try { await window.DAA_API.patch(`/users/${a_id(e)}/disable`, {}); loadUsers(); }
      catch (err) { alert(err.message); el.classList.remove('disabled'); }
    }));
    document.querySelectorAll('.action-activate').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const el = e.currentTarget;
      if (el.classList.contains('disabled')) return;
      el.classList.add('disabled');
      try { await window.DAA_API.patch(`/users/${a_id(e)}/activate`, {}); loadUsers(); }
      catch (err) { alert(err.message); el.classList.remove('disabled'); }
    }));
    document.querySelectorAll('.action-reset').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const el = e.currentTarget;
      if (el.classList.contains('disabled')) return;
      if (!confirm('Reset this user\'s password? A new temporary password will be generated.')) return;
      el.classList.add('disabled');
      try {
        const result = await window.DAA_API.post(`/users/${a_id(e)}/reset-password`, {});
        alert('New temporary password: ' + result.temporaryPassword);
      } catch (err) { alert(err.message); }
      finally { el.classList.remove('disabled'); }
    }));
    document.querySelectorAll('.action-role').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const el = e.currentTarget;
      if (el.classList.contains('disabled')) return;
      const newRole = prompt('Enter new role name (e.g. teacher, admin, guardian):');
      if (!newRole) return;
      el.classList.add('disabled');
      try { await window.DAA_API.patch(`/users/${a_id(e)}/role`, { roleName: newRole.trim() }); loadUsers(); }
      catch (err) { alert(err.message); el.classList.remove('disabled'); }
    }));
  }
  function a_id(e) { return e.currentTarget.dataset.id; }

  renderShell();
  loadUsers();
})();
