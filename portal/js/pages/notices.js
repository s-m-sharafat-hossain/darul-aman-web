/**
 * Darul Aman Academy Portal — Notices page.
 * Shared across all roles. Staff-type roles additionally see a composer
 * (the backend still enforces notice.create permission — this just hides
 * the form for roles that would get a 403).
 */
(function () {
  const CAN_COMPOSE = new Set(['admin', 'principal', 'super_admin']);
  const DEFAULT_AUDIENCE = {
    student: 'students', guardian: 'guardians', teacher: 'teachers', hifz_teacher: 'teachers', hifz_coordinator: 'teachers',
  };

  const user = window.DAA_API.requireAuth();
  if (!user) return;

  const nav = window.DAA_NAV.itemsFor(user.role);
  const canCompose = CAN_COMPOSE.has(user.role);

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Notices',
    pageSubtitle: canCompose ? 'Publish and browse notices' : 'Latest announcements for you',
    activeKey: 'notice',
    navItems: nav,
  });
  window.DAA_SHELL.setTopbarName(user.userCode);

  const U = window.DAA_UTIL;

  content.innerHTML = `
    ${canCompose ? `
    <div class="p-card mb-3">
      <h5><i class="fa-solid fa-pen"></i> Publish a Notice</h5>
      <form id="noticeForm">
        <div class="row g-2">
          <div class="col-md-8">
            <input type="text" class="form-control" id="ntTitle" placeholder="Title" required>
          </div>
          <div class="col-md-4">
            <select class="form-control" id="ntAudience">
              <option value="all">Everyone</option>
              <option value="students">Students</option>
              <option value="guardians">Guardians</option>
              <option value="teachers">Teachers</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div class="col-12">
            <textarea class="form-control" id="ntBody" rows="3" placeholder="Notice details..." required></textarea>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
          <span class="auth-error" id="ntMsg" style="margin:0;"></span>
          <button type="submit" class="btn btn-portal-primary btn-sm" id="ntSubmit">Create & Publish</button>
        </div>
      </form>
    </div>` : ''}
    <div class="p-card">
      <h5><i class="fa-solid fa-bullhorn"></i> All Notices</h5>
      <div id="noticeList"><div class="skeleton" style="height:60px;border-radius:10px;"></div></div>
    </div>
  `;

  function loadNotices() {
    const list = document.getElementById('noticeList');
    window.DAA_API.get('/notices' + (DEFAULT_AUDIENCE[user.role] ? '' : ''))
      .then((notices) => {
        if (!notices.length) {
          list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No notices published yet.</div>`;
          return;
        }
        list.innerHTML = `<ul class="list-clean">
          ${notices.map(n => `
            <li style="align-items:flex-start;flex-direction:column;gap:4px;">
              <div style="display:flex;justify-content:space-between;width:100%;">
                <strong>${U.escapeHtml(n.title)}</strong>
                <span style="color:var(--muted);font-size:12px;">${U.fmtDate(n.publishedAt || n.createdAt)}</span>
              </div>
              <div style="color:var(--muted);font-size:13.5px;">${U.escapeHtml(n.body)}</div>
              ${!n.isPublished ? `<span class="badge-status badge-warn">Draft — not published</span>` : ''}
            </li>`).join('')}
        </ul>`;
      })
      .catch((err) => {
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div>`;
      });
  }
  loadNotices();

  if (canCompose) {
    document.getElementById('noticeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('ntMsg');
      const btn = document.getElementById('ntSubmit');
      msg.classList.remove('show');
      btn.disabled = true;
      let notice;
      try {
        notice = await window.DAA_API.post('/notices', {
          title: document.getElementById('ntTitle').value.trim(),
          body: document.getElementById('ntBody').value.trim(),
          audience: document.getElementById('ntAudience').value,
        });
      } catch (err) {
        // Creation itself failed — nothing was saved, safe to let the user retry as-is.
        msg.style.background = 'var(--danger-soft)';
        msg.style.color = 'var(--danger)';
        msg.textContent = err.message;
        msg.classList.add('show');
        btn.disabled = false;
        return;
      }
      try {
        await window.DAA_API.post(`/notices/${notice.id}/publish`, {});
        document.getElementById('noticeForm').reset();
        loadNotices();
        btn.disabled = false;
      } catch (err) {
        // The notice itself was already created (as an unpublished draft) — clear the
        // form so resubmitting the same title/body can't create a second, duplicate
        // notice. Refresh the list so the draft is visible, and explain what happened.
        document.getElementById('noticeForm').reset();
        loadNotices();
        msg.style.background = 'var(--danger-soft)';
        msg.style.color = 'var(--danger)';
        msg.textContent = `Notice was saved as a draft, but publishing failed: ${err.message}. It is not yet visible to its audience.`;
        msg.classList.add('show');
        btn.disabled = false;
      }
    });
  }
})();
