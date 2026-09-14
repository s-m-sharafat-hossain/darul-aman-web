(function () {
  const user = window.DAA_API.requireAuth(['guardian']);
  if (!user) return;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Guardian Dashboard',
    pageSubtitle: 'A quick look at all your children',
    activeKey: 'dash',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  window.DAA_API.get('/dashboard/guardian')
    .then((data) => {
      window.DAA_SHELL.setTopbarName(user.userCode);
      const children = data.children || [];

      if (!children.length) {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-children"></i>No children are linked to this account yet. Please contact the school office.</div></div>`;
        return;
      }

      content.innerHTML = `
        <div class="row g-3 mb-2">
          <div class="col-12">
            <div class="p-card" style="padding-bottom:8px;">
              <h5><i class="fa-solid fa-children"></i> Your Children</h5>
              <div class="row g-3" id="childrenGrid"></div>
            </div>
          </div>
        </div>
        <div class="row g-3">
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-bullhorn"></i> Latest Notices</h5>
              ${(data.latestNotices || []).length ? `<ul class="list-clean">
                ${data.latestNotices.map(n => `<li><span>${n.title}</span><strong>${fmtDate(n.publishedAt)}</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No notices yet.</div>`}
            </div>
          </div>
        </div>
      `;

      const grid = document.getElementById('childrenGrid');
      grid.innerHTML = children.map(c => `
        <div class="col-md-6 col-lg-4">
          <div class="p-card" style="border-left:4px solid var(--green);">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <strong style="font-family:var(--font-display);color:var(--green-deep);">${c.fullName}</strong>
                <div style="font-size:12px;color:var(--muted);">${c.studentCode} &middot; ${c.class || '—'}</div>
              </div>
              <span class="badge-status badge-muted">${c.relation || 'Guardian'}</span>
            </div>
            <ul class="list-clean" style="font-size:13px;">
              <li><span>Fee Due</span><strong style="color:${c.feeDue > 0 ? 'var(--danger)' : 'var(--ok)'};">৳${c.feeDue.toLocaleString()}</strong></li>
              <li><span>Hifz Progress</span><strong>${c.hifzProgress != null ? c.hifzProgress + '%' : 'N/A'}</strong></li>
            </ul>
          </div>
        </div>
      `).join('');
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
