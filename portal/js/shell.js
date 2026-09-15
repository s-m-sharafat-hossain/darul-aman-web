/**
 * Darul Aman Academy Portal — shared app shell (sidebar + topbar).
 * Every dashboard page calls DAA_SHELL.render({...}) once on load.
 */
(function () {
  const ROLE_LABELS = {
    student: 'Student',
    guardian: 'Guardian',
    teacher: 'Teacher',
    hifz_teacher: 'Hifz Teacher',
    hifz_coordinator: 'Hifz Coordinator',
    admin: 'Admin',
    principal: 'Principal',
    accountant: 'Accountant',
    receptionist: 'Receptionist',
    librarian: 'Librarian',
    super_admin: 'Super Admin',
  };

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function render(opts) {
    const { rootPrefix, navItems, activeKey, pageTitle, pageSubtitle } = opts;
    const user = window.DAA_API.getUser() || {};
    const roleLabel = ROLE_LABELS[user.role] || user.role || '';

    const navHtml = navItems.map(item => `
      <li>
        <a href="${rootPrefix}${item.href}" class="${item.key === activeKey ? 'active' : ''}">
          <i class="${item.icon}"></i><span>${item.label}</span>
        </a>
      </li>`).join('');

    document.body.insertAdjacentHTML('afterbegin', `
      <div class="portal-app">
        <aside class="portal-sidebar" id="portalSidebar">
          <div class="side-brand">
            <img src="${rootPrefix}../Logo_icon/L-2.svg" alt="Darul Aman Academy">
            <div>
              <strong>DARUL AMAN</strong>
              <small>Academy Portal</small>
            </div>
          </div>
          <div class="side-role">${roleLabel} Portal</div>
          <ul class="side-nav">${navHtml}</ul>
          <div class="side-foot">
            <button class="logout-btn" id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>
          </div>
        </aside>
        <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

        <div class="portal-main">
          <header class="portal-topbar">
            <div style="display:flex;align-items:center;gap:14px;">
              <button class="sidebar-toggle" id="sidebarToggle"><i class="fa-solid fa-bars"></i></button>
              <div class="topbar-title">
                <h1>${pageTitle}</h1>
                ${pageSubtitle ? `<p>${pageSubtitle}</p>` : ''}
              </div>
            </div>
            <div class="topbar-user">
              <div class="who">
                <strong id="topbarUserName">${user.userCode || 'Welcome'}</strong>
                <span>${roleLabel}</span>
              </div>
              <div class="avatar" id="topbarAvatar">${initials(user.userCode)}</div>
            </div>
          </header>
          <main class="portal-content" id="portalContent"></main>
        </div>
      </div>
    `);

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await window.DAA_API.logout();
      location.href = rootPrefix + 'login.html';
    });

    const sidebar = document.getElementById('portalSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
      document.body.classList.toggle('sidebar-open', sidebar.classList.contains('open'));
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      document.body.classList.remove('sidebar-open');
    });
    // Closing via a nav link is a full page navigation on this multi-page site,
    // so no extra listener is needed there — the next page load starts fresh.

    return document.getElementById('portalContent');
  }

  function setTopbarName(fullName) {
    if (!fullName) return;
    const nameEl = document.getElementById('topbarUserName');
    const avEl = document.getElementById('topbarAvatar');
    if (nameEl) nameEl.textContent = fullName;
    if (avEl) avEl.textContent = initials(fullName);
  }

  window.DAA_SHELL = { render, setTopbarName, ROLE_LABELS };
})();
