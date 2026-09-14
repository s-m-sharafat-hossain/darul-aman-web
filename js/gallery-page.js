/**
 * Darul Aman Academy — public Gallery page (gallery.html).
 * Loads published photos from the backend (GET /api/gallery/public), no
 * hardcoded image cards. Same IIFE/vanilla-JS convention as the homepage's
 * notice-board script (see index.html) and the same API_BASE_URL config
 * (js/site-config.js).
 */
(function () {
  var base = (window.DAA_SITE_CONFIG && window.DAA_SITE_CONFIG.API_BASE_URL) || '/api';
  var FILE_BASE = base.replace(/\/api\/?$/, ''); // uploaded images are served outside the /api prefix — see backend app.js

  var CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'academic', label: 'Academic' },
    { value: 'events', label: 'Events' },
    { value: 'students', label: 'Students' },
    { value: 'teachers', label: 'Teachers' },
    { value: 'hifz', label: 'Hifz' },
    { value: 'sports', label: 'Sports' },
    { value: 'cultural', label: 'Cultural' },
    { value: 'campus', label: 'Campus' },
    { value: 'other', label: 'Other' },
  ];
  var CATEGORY_LABEL = {};
  CATEGORIES.forEach(function (c) { CATEGORY_LABEL[c.value] = c.label; });

  var filterBar = document.getElementById('galleryFilter');
  var grid = document.getElementById('galleryGrid');
  var activeCategory = 'all';
  var items = [];
  var currentIndex = -1;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function imgSrc(imageUrl) {
    return FILE_BASE + imageUrl;
  }

  function renderFilters() {
    filterBar.innerHTML = CATEGORIES.map(function (c) {
      return '<button type="button" class="gallery-filter-btn' + (c.value === activeCategory ? ' active' : '') +
        '" data-category="' + c.value + '" role="tab" aria-selected="' + (c.value === activeCategory) + '">' +
        escapeHtml(c.label) + '</button>';
    }).join('');

    Array.prototype.forEach.call(filterBar.querySelectorAll('.gallery-filter-btn'), function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.category === activeCategory) return;
        activeCategory = btn.dataset.category;
        renderFilters();
        loadGallery();
      });
    });
  }

  function renderSkeleton() {
    var html = '';
    for (var i = 0; i < 8; i++) html += '<div class="gallery-skel"></div>';
    grid.innerHTML = html;
  }

  function renderEmpty() {
    grid.innerHTML = '<div class="gallery-empty"><i class="fa-solid fa-images"></i>এখনও কোনো ছবি যুক্ত করা হয়নি।</div>';
  }

  function renderError() {
    grid.innerHTML = '<div class="gallery-error"><i class="fa-solid fa-triangle-exclamation"></i>ছবি লোড করা যায়নি। পরে আবার চেষ্টা করুন।</div>';
  }

  function renderGrid() {
    if (!items.length) { renderEmpty(); return; }
    grid.innerHTML = items.map(function (it, i) {
      return '' +
        '<div class="gallery-card" tabindex="0" role="button" data-index="' + i + '" aria-label="' + escapeHtml(it.title) + '">' +
          '<span class="gc-badge">' + escapeHtml(CATEGORY_LABEL[it.category] || it.category) + '</span>' +
          '<img src="' + imgSrc(it.imageUrl) + '" alt="' + escapeHtml(it.title) + '" loading="lazy" width="400" height="300">' +
          '<div class="gc-overlay">' +
            '<div>' +
              '<p class="gc-title">' + escapeHtml(it.title) + '</p>' +
              '<span class="gc-meta">' + fmtDate(it.eventDate || it.createdAt) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(grid.querySelectorAll('.gallery-card'), function (card) {
      card.addEventListener('click', function () { openLightbox(parseInt(card.dataset.index, 10)); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(parseInt(card.dataset.index, 10)); }
      });
    });
  }

  function loadGallery() {
    renderSkeleton();
    var qs = activeCategory && activeCategory !== 'all' ? '?category=' + encodeURIComponent(activeCategory) : '';
    fetch(base + '/gallery/public' + qs)
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || json.success === false) throw new Error('bad response');
        items = json.data || [];
        renderGrid();
      })
      .catch(function () {
        renderError();
      });
  }

  /* ---------------- Lightbox ---------------- */
  var lightbox = document.getElementById('glLightbox');
  var glImage = document.getElementById('glImage');
  var glTitle = document.getElementById('glTitle');
  var glDescription = document.getElementById('glDescription');
  var glCategory = document.getElementById('glCategory');
  var glDate = document.getElementById('glDate');
  var lastFocused = null;

  function showItemInLightbox(index) {
    var it = items[index];
    if (!it) return;
    currentIndex = index;
    glImage.src = imgSrc(it.imageUrl);
    glImage.alt = it.title;
    glTitle.textContent = it.title;
    glDescription.textContent = it.description || '';
    glDescription.style.display = it.description ? 'block' : 'none';
    glCategory.textContent = CATEGORY_LABEL[it.category] || it.category;
    glDate.textContent = fmtDate(it.eventDate || it.createdAt);
  }

  function openLightbox(index) {
    lastFocused = document.activeElement;
    showItemInLightbox(index);
    lightbox.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.getElementById('glClose').focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('show');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function showNext() { showItemInLightbox((currentIndex + 1) % items.length); }
  function showPrev() { showItemInLightbox((currentIndex - 1 + items.length) % items.length); }

  document.getElementById('glClose').addEventListener('click', closeLightbox);
  document.getElementById('glNext').addEventListener('click', showNext);
  document.getElementById('glPrev').addEventListener('click', showPrev);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox(); // click on backdrop only
  });
  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('show')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') showNext();
    else if (e.key === 'ArrowLeft') showPrev();
  });

  // Touch-friendly swipe navigation for mobile.
  var touchStartX = null;
  lightbox.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (touchStartX == null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) { dx < 0 ? showNext() : showPrev(); }
    touchStartX = null;
  }, { passive: true });

  renderFilters();
  loadGallery();
})();
