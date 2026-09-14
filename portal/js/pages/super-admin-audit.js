(function () {
  const user = window.DAA_API.requireAuth(['super_admin', 'admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Audit Log',
    pageSubtitle: 'Sensitive actions across the system',
    activeKey: 'audit',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let page = 1;
  const limit = 30;

  function renderShell() {
    content.innerHTML = `
      <div class="p-card mb-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Action contains</label>
            <input type="text" class="form-control" id="filterAction" placeholder="e.g. fee, attendance, user">
          </div>
          <div class="col-md-4">
            <label class="form-label">Entity Type</label>
            <input type="text" class="form-control" id="filterEntity" placeholder="e.g. student, invoice, user">
          </div>
          <div class="col-md-4">
            <button class="btn btn-portal-primary w-100" id="applyFilter">Filter</button>
          </div>
        </div>
      </div>
      <div id="logBox"></div>
    `;
    document.getElementById('applyFilter').addEventListener('click', () => { page = 1; loadLogs(); });
  }

  function loadLogs() {
    const box = document.getElementById('logBox');
    box.innerHTML = `<div class="skeleton" style="height:220px;border-radius:14px;"></div>`;

    const action = document.getElementById('filterAction').value.trim();
    const entityType = document.getElementById('filterEntity').value.trim();
    let qs = `page=${page}&limit=${limit}`;
    if (action) qs += `&action=${encodeURIComponent(action)}`;
    if (entityType) qs += `&entityType=${encodeURIComponent(entityType)}`;

    window.DAA_API.get(`/users/audit-logs?${qs}`)
      .then((logs) => {
        const meta = logs._meta;
        const totalPages = meta ? meta.totalPages : null;
        const hasNext = meta ? page < totalPages : logs.length >= limit;

        if (!logs.length) {
          box.innerHTML = `<div class="p-card">
            <div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i>No audit entries found.</div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadLogs(); });
          return;
        }
        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13px;">
                <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
                <tbody>
                  ${logs.map(l => `
                    <tr>
                      <td>${U.fmtDateTime(l.createdAt)}</td>
                      <td>${l.user?.userCode || 'System'}<br><span style="color:var(--muted);font-size:11px;text-transform:capitalize;">${l.user?.role?.name?.replace('_', ' ') || ''}</span></td>
                      <td><span class="badge-status badge-muted">${l.action}</span></td>
                      <td>${l.entityType || '—'}${l.entityId ? ` #${String(l.entityId).slice(0, 8)}` : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
              <span style="font-size:12.5px;color:var(--muted);">${meta ? `Page ${page} of ${totalPages} &middot; ${meta.total} entries` : `Page ${page}`}</span>
              <div class="btn-group">
                <button class="btn btn-portal-outline btn-sm" id="prevPage" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <button class="btn btn-portal-outline btn-sm" id="nextPage" ${hasNext ? '' : 'disabled'}>Next</button>
              </div>
            </div>
          </div>
        `;
        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.addEventListener('click', () => { page--; loadLogs(); });
        if (next) next.addEventListener('click', () => { page++; loadLogs(); });
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
  }

  renderShell();
  loadLogs();
})();
