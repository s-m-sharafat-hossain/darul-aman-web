/*=========================================================
  DARUL AMAN ACADEMY — SITE HEADER (logo-pill navbar)
  Mobile menu toggle + submenu accordion + active link
=========================================================*/
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        var toggleBtn = document.getElementById('headerToggle');
        var menuWrap  = document.getElementById('headerMenuWrap');
        var header    = document.getElementById('siteHeader');

        if (!header) { return; }

        /* ---- Mobile menu open/close ---- */
        function closeMenu() {
            if (!menuWrap) { return; }
            menuWrap.classList.remove('show');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', 'false');
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        }

        function toggleMenu() {
            if (!menuWrap) { return; }
            var isOpen = menuWrap.classList.toggle('show');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                toggleBtn.innerHTML = isOpen
                    ? '<i class="fas fa-xmark"></i>'
                    : '<i class="fas fa-bars"></i>';
            }
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleMenu();
            });
        }

        /* Close the mobile panel when a plain link (not a submenu
           toggle) inside it is clicked */
        if (menuWrap) {
            menuWrap.querySelectorAll('a').forEach(function (link) {
                if (!link.classList.contains('submenu-toggle')) {
                    link.addEventListener('click', function () {
                        closeMenu();
                    });
                }
            });
        }

        /* Click outside closes the mobile menu */
        document.addEventListener('click', function (e) {
            if (!menuWrap || !menuWrap.classList.contains('show')) { return; }
            if (!header.contains(e.target)) {
                closeMenu();
            }
        });

        /* Nav collapses to the mobile-style dropdown (click-to-open
           accordion) up to 1279.98px — see css/style.css's header
           nav media queries — so this must match that breakpoint,
           not the 992px point where the topbar alone compacts. */
        var NAV_COLLAPSE_BREAKPOINT = 1280;

        /* Reset collapsed-nav-only state when resizing back to the
           full horizontal desktop nav */
        window.addEventListener('resize', function () {
            if (window.innerWidth >= NAV_COLLAPSE_BREAKPOINT) {
                closeMenu();
                document.querySelectorAll('.has-submenu.open').forEach(function (li) {
                    li.classList.remove('open');
                });
            }
        });

        /* ---- Submenu accordion while the nav is collapsed (click to
           open) — the full-width desktop nav (>=1280px) keeps CSS
           :hover instead ---- */
        document.querySelectorAll('.submenu-toggle').forEach(function (toggle) {
            toggle.addEventListener('click', function (e) {
                if (window.innerWidth >= NAV_COLLAPSE_BREAKPOINT) { return; } // desktop uses hover
                e.preventDefault();
                var li = toggle.closest('.has-submenu');
                if (!li) { return; }
                var wasOpen = li.classList.contains('open');
                document.querySelectorAll('.has-submenu.open').forEach(function (openLi) {
                    if (openLi !== li) { openLi.classList.remove('open'); }
                });
                li.classList.toggle('open', !wasOpen);
            });
        });

        /* ---- Mark the current page's link as active ---- */
        var path = window.location.pathname.split('/').pop();
        if (path === '' ) { path = 'index.html'; }

        header.querySelectorAll('a[data-page]').forEach(function (link) {
            if (link.getAttribute('data-page') === path) {
                link.classList.add('active');
                var parentSubmenu = link.closest('.has-submenu');
                if (parentSubmenu) {
                    var parentToggle = parentSubmenu.querySelector('.submenu-toggle');
                    if (parentToggle) { parentToggle.classList.add('active'); }
                }
            }
        });
        /* ---- Footer newsletter — no backend exists yet; be honest about it
           instead of faking a success message ---- */
        var newsletterForm = document.getElementById('footerNewsletterForm');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var note = document.getElementById('footerNewsletterNote');
                if (note) {
                    note.textContent = 'Newsletter sign-ups aren\'t available yet — please reach us directly via the contact details above.';
                }
            });
        }

    });
})();
