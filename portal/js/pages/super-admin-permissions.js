(function () {
  const user = window.DAA_API.requireAuth(['super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Role Permissions',
    pageSubtitle: 'Set which permissions each role has',
    activeKey: 'perms',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  Promise.all([
    window.DAA_API.get('/users/roles'),
    window.DAA_API.get('/users/permissions'),
  ]).then(([roles, permissions]) => {
    const grouped = {};
    permissions.forEach(p => {
      grouped[p.module] = grouped[p.module] || [];
      grouped[p.module].push(p);
    });

    content.innerHTML = `
      <div class="p-card mb-3">
        <label class="form-label">Select Role to Edit</label>
        <select class="form-control" id="roleSelect" style="max-width:320px;">
          <option value="">Choose a role...</option>
          ${roles.map(r => `<option value="${r.id}">${r.name.replace('_', ' ')}</option>`).join('')}
        </select>
      </div>
      <div id="matrixBox"></div>
    `;

    document.getElementById('roleSelect').addEventListener('change', (e) => {
      const roleId = e.target.value;
      const box = document.getElementById('matrixBox');
      if (!roleId) { box.innerHTML = ''; return; }

      box.innerHTML = `
        <div class="p-card">
          <div class="auth-error show" style="background:var(--warn-soft);color:var(--warn);">
            <i class="fa-solid fa-triangle-exclamation me-1"></i>
            The system doesn't expose a role's currently-assigned permissions yet, so all boxes start unchecked.
            Check everything this role should have, then Save — saving <strong>replaces</strong> the role's entire permission set with your selection.
          </div>
          <form id="permForm">
            ${Object.entries(grouped).map(([module, perms]) => `
              <div class="mb-3">
                <h6 style="font-family:var(--font-display);color:var(--green-deep);text-transform:capitalize;">${module}</h6>
                <div class="row g-1">
                  ${perms.map(p => `
                    <div class="col-md-4">
                      <div class="form-check">
                        <input class="form-check-input perm-check" type="checkbox" value="${p.code}" id="perm-${p.code}">
                        <label class="form-check-label" for="perm-${p.code}" style="font-size:13px;">${p.action}${p.description ? ` <span style="color:var(--muted);">(${U.escapeHtml(p.description)})</span>` : ''}</label>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
            <div class="auth-error" id="permMsg"></div>
            <button type="submit" class="btn btn-portal-primary" id="permSubmit"><i class="fa-solid fa-floppy-disk me-2"></i>Save Permissions for This Role</button>
          </form>
        </div>
      `;

      document.getElementById('permForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('permMsg');
        const btn = document.getElementById('permSubmit');
        msg.classList.remove('show');
        btn.disabled = true;
        const permissionCodes = Array.from(document.querySelectorAll('.perm-check:checked')).map(c => c.value);
        try {
          await window.DAA_API.put(`/users/roles/${roleId}/permissions`, { permissionCodes });
          msg.style.background = 'var(--ok-soft)';
          msg.style.color = 'var(--ok)';
          msg.textContent = `Saved ${permissionCodes.length} permission(s) for this role.`;
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
    });
  }).catch((err) => {
    content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
  });
})();
