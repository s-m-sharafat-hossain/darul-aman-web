/**
 * Darul Aman Academy Portal — Admin Gallery Management.
 * Content Management > Gallery. Admin/Principal manage photos here; the
 * public website's gallery.html and Home Page "Recent Photos" section read
 * only the published items this page creates, via GET /api/gallery/public
 * and /api/gallery/recent (no auth on those two — see gallery.routes.js).
 */
(function () {
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const CATEGORIES = [
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
  const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
  // API base is ".../api" — uploaded files are served from the API's own
  // origin but outside the /api prefix (see backend app.js's
  // /uploads/gallery static route), so strip the trailing /api to get the
  // file host.
  const FILE_BASE = (window.DAA_CONFIG.API_BASE_URL || '').replace(/\/api\/?$/, '');

  function imgSrc(imageUrl) {
    return FILE_BASE + imageUrl;
  }

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Gallery',
    pageSubtitle: 'Manage photos, events and memories',
    activeKey: 'gallery',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });
  window.DAA_SHELL.setTopbarName(user.userCode);

  let page = 1;
  const limit = 20;
  let editingId = null; // null while the Add modal is open; item id while Edit modal is open

  content.innerHTML = `
    <div class="p-card mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div class="row g-2 flex-grow-1">
          <div class="col-md-3">
            <input type="text" class="form-control" id="gSearch" placeholder="Search by title...">
          </div>
          <div class="col-md-3">
            <select class="form-control" id="gCategory">
              <option value="">All Categories</option>
              ${CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-control" id="gStatus">
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft / Unpublished</option>
            </select>
          </div>
        </div>
        <button class="btn btn-portal-primary btn-sm" id="addPhotoBtn"><i class="fa-solid fa-plus"></i> Add Photo</button>
      </div>
    </div>

    <div id="tableBox"><div class="skeleton" style="height:260px;border-radius:14px;"></div></div>

    <!-- Add/Edit modal -->
    <div class="modal fade" id="itemModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable"><div class="modal-content" style="border-radius:16px;">
        <div class="modal-body p-4">
          <h5 class="mb-3" id="itemModalTitle"><i class="fa-solid fa-image"></i> Add Photo</h5>
          <div class="auth-error" id="itemMsg"></div>
          <form id="itemForm">
            <div class="mb-3">
              <label class="form-label">Image <span id="imageRequiredMark">*</span></label>
              <input type="file" class="form-control" id="itImage" accept="image/jpeg,image/png,image/webp">
              <div class="form-text">JPG, PNG or WEBP. Leave empty when editing to keep the current image.</div>
              <div id="itPreviewBox" class="mt-2" style="display:none;">
                <img id="itPreview" alt="Preview" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;border:1px solid #E6E2D5;">
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" id="itTitle" required maxlength="160">
            </div>
            <div class="mb-3">
              <label class="form-label">Description</label>
              <textarea class="form-control" id="itDescription" rows="3" maxlength="1000"></textarea>
            </div>
            <div class="row g-2">
              <div class="col-md-6">
                <label class="form-label">Category</label>
                <select class="form-control" id="itCategory">
                  ${CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Gallery Date</label>
                <input type="date" class="form-control" id="itEventDate">
              </div>
            </div>
            <div class="d-flex gap-4 mt-3">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="itFeatured">
                <label class="form-check-label" for="itFeatured">Featured (Recent Photos)</label>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="itPublished">
                <label class="form-check-label" for="itPublished">Publish immediately</label>
              </div>
            </div>
            <button type="submit" class="btn btn-portal-primary w-100 mt-4" id="itSubmit">Save Photo</button>
          </form>
        </div>
      </div></div>
    </div>

    <!-- Preview modal -->
    <div class="modal fade" id="previewModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content" style="border-radius:16px;overflow:hidden;">
        <img id="pvImage" alt="" style="width:100%;max-height:70vh;object-fit:contain;background:#000;">
        <div class="modal-body">
          <h5 id="pvTitle" class="mb-1"></h5>
          <p id="pvDescription" class="mb-2" style="color:var(--muted);font-size:14px;"></p>
          <div style="font-size:12.5px;color:var(--muted);">
            <span id="pvCategory"></span> &middot; <span id="pvDate"></span>
          </div>
        </div>
      </div></div>
    </div>
  `;

  const itemModalEl = document.getElementById('itemModal');
  const itemModal = new bootstrap.Modal(itemModalEl);
  const previewModalEl = document.getElementById('previewModal');
  const previewModal = new bootstrap.Modal(previewModalEl);

  document.getElementById('gSearch').addEventListener('input', debounce(() => { page = 1; loadItems(); }, 350));
  document.getElementById('gCategory').addEventListener('change', () => { page = 1; loadItems(); });
  document.getElementById('gStatus').addEventListener('change', () => { page = 1; loadItems(); });
  document.getElementById('addPhotoBtn').addEventListener('click', openAddModal);
  document.getElementById('itImage').addEventListener('change', handlePreview);
  document.getElementById('itemForm').addEventListener('submit', submitItem);

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function handlePreview() {
    const file = document.getElementById('itImage').files[0];
    const box = document.getElementById('itPreviewBox');
    const img = document.getElementById('itPreview');
    if (!file) { box.style.display = 'none'; return; }
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; box.style.display = 'block'; };
    reader.readAsDataURL(file);
  }

  function openAddModal() {
    editingId = null;
    document.getElementById('itemModalTitle').innerHTML = '<i class="fa-solid fa-image"></i> Add Photo';
    document.getElementById('itemForm').reset();
    document.getElementById('itPreviewBox').style.display = 'none';
    document.getElementById('imageRequiredMark').style.display = 'inline';
    document.getElementById('itImage').required = true;
    document.getElementById('itPublished').checked = false;
    document.getElementById('itemMsg').classList.remove('show');
    itemModal.show();
  }

  function openEditModal(item) {
    editingId = item.id;
    document.getElementById('itemModalTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Edit Photo';
    document.getElementById('itemForm').reset();
    document.getElementById('itImage').required = false;
    document.getElementById('imageRequiredMark').style.display = 'none';
    document.getElementById('itTitle').value = item.title;
    document.getElementById('itDescription').value = item.description || '';
    document.getElementById('itCategory').value = item.category;
    document.getElementById('itEventDate').value = item.eventDate ? item.eventDate.slice(0, 10) : '';
    document.getElementById('itFeatured').checked = !!item.isFeatured;
    document.getElementById('itPublished').checked = !!item.isPublished;
    document.getElementById('itPreview').src = imgSrc(item.imageUrl);
    document.getElementById('itPreviewBox').style.display = 'block';
    document.getElementById('itemMsg').classList.remove('show');
    itemModal.show();
  }

  function openPreview(item) {
    document.getElementById('pvImage').src = imgSrc(item.imageUrl);
    document.getElementById('pvTitle').textContent = item.title;
    document.getElementById('pvDescription').textContent = item.description || '';
    document.getElementById('pvCategory').textContent = CATEGORY_LABEL[item.category] || item.category;
    document.getElementById('pvDate').textContent = U.fmtDate(item.eventDate || item.createdAt);
    previewModal.show();
  }

  async function submitItem(e) {
    e.preventDefault();
    const msg = document.getElementById('itemMsg');
    const btn = document.getElementById('itSubmit');
    msg.classList.remove('show');

    const file = document.getElementById('itImage').files[0];
    if (!editingId && !file) {
      msg.style.background = 'var(--danger-soft)'; msg.style.color = 'var(--danger)';
      msg.textContent = 'Please choose an image.';
      msg.classList.add('show');
      return;
    }

    const fd = new FormData();
    fd.append('title', document.getElementById('itTitle').value.trim());
    fd.append('description', document.getElementById('itDescription').value.trim());
    fd.append('category', document.getElementById('itCategory').value);
    const eventDate = document.getElementById('itEventDate').value;
    if (eventDate) fd.append('eventDate', eventDate);
    fd.append('isFeatured', document.getElementById('itFeatured').checked ? 'true' : 'false');
    fd.append('isPublished', document.getElementById('itPublished').checked ? 'true' : 'false');
    if (file) fd.append('image', file);

    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      if (editingId) {
        await window.DAA_API.uploadFormPut(`/gallery/${editingId}`, fd);
      } else {
        await window.DAA_API.uploadForm('/gallery', fd);
      }
      itemModal.hide();
      loadItems();
    } catch (err) {
      msg.style.background = 'var(--danger-soft)'; msg.style.color = 'var(--danger)';
      msg.textContent = err.message;
      msg.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Photo';
    }
  }

  async function togglePublish(item) {
    try {
      await window.DAA_API.patch(`/gallery/${item.id}/${item.isPublished ? 'unpublish' : 'publish'}`, {});
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.title}"? This permanently removes the photo from the gallery and the server. This cannot be undone.`)) return;
    try {
      await window.DAA_API.del(`/gallery/${item.id}`);
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  }

  function loadItems() {
    const box = document.getElementById('tableBox');
    box.innerHTML = `<div class="skeleton" style="height:260px;border-radius:14px;"></div>`;

    const search = document.getElementById('gSearch').value.trim();
    const category = document.getElementById('gCategory').value;
    const status = document.getElementById('gStatus').value;

    let qs = `page=${page}&limit=${limit}`;
    if (search) qs += `&search=${encodeURIComponent(search)}`;
    if (category) qs += `&category=${category}`;
    if (status) qs += `&status=${status}`;

    window.DAA_API.get(`/gallery?${qs}`)
      .then((items) => {
        const meta = items._meta;
        const totalPages = meta ? meta.totalPages : null;
        const hasNext = meta ? page < totalPages : items.length >= limit;

        if (!items.length) {
          box.innerHTML = `<div class="p-card">
            <div class="empty-state"><i class="fa-solid fa-images"></i>No gallery photos found.${page > 1 ? '' : ' Click "+ Add Photo" to upload the first one.'}</div>
            ${page > 1 ? `<div class="d-flex justify-content-end mt-2"><button class="btn btn-portal-outline btn-sm" id="prevPage">Previous</button></div>` : ''}
          </div>`;
          const prevOnly = document.getElementById('prevPage');
          if (prevOnly) prevOnly.addEventListener('click', () => { page--; loadItems(); });
          return;
        }

        box.innerHTML = `
          <div class="p-card">
            <div class="table-responsive">
              <table class="table align-middle" style="font-size:13.5px;">
                <thead><tr>
                  <th>Thumbnail</th><th>Title</th><th>Category</th><th>Date</th>
                  <th>Status</th><th>Featured</th><th>Created</th><th></th>
                </tr></thead>
                <tbody>
                  ${items.map((it) => `
                    <tr>
                      <td><img src="${imgSrc(it.imageUrl)}" alt="${U.escapeHtml(it.title)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;" loading="lazy"></td>
                      <td style="max-width:220px;">${U.escapeHtml(it.title)}</td>
                      <td>${CATEGORY_LABEL[it.category] || it.category}</td>
                      <td>${U.fmtDate(it.eventDate)}</td>
                      <td>${it.isPublished ? `<span class="badge-status badge-ok">Published</span>` : `<span class="badge-status badge-warn">Draft</span>`}</td>
                      <td>${it.isFeatured ? '<i class="fa-solid fa-star" style="color:var(--gold);"></i>' : '<span style="color:var(--muted);">—</span>'}</td>
                      <td>${U.fmtDate(it.createdAt)}</td>
                      <td class="text-nowrap">
                        <button class="btn btn-portal-outline btn-sm preview-btn" data-id="${it.id}" title="Preview"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-portal-outline btn-sm edit-btn" data-id="${it.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-portal-outline btn-sm publish-btn" data-id="${it.id}" title="${it.isPublished ? 'Unpublish' : 'Publish'}"><i class="fa-solid ${it.isPublished ? 'fa-eye-slash' : 'fa-check'}"></i></button>
                        <button class="btn btn-portal-outline btn-sm delete-btn" data-id="${it.id}" title="Delete" style="color:var(--danger);border-color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <span style="font-size:12.5px;color:var(--muted);">${meta ? `${meta.total} total` : ''}</span>
              <div class="d-flex gap-2">
                <button class="btn btn-portal-outline btn-sm" id="prevPage" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <button class="btn btn-portal-outline btn-sm" id="nextPage" ${hasNext ? '' : 'disabled'}>Next</button>
              </div>
            </div>
          </div>
        `;

        const byId = Object.fromEntries(items.map((it) => [it.id, it]));
        document.getElementById('prevPage').addEventListener('click', () => { if (page > 1) { page--; loadItems(); } });
        document.getElementById('nextPage').addEventListener('click', () => { if (hasNext) { page++; loadItems(); } });
        box.querySelectorAll('.preview-btn').forEach((b) => b.addEventListener('click', () => openPreview(byId[b.dataset.id])));
        box.querySelectorAll('.edit-btn').forEach((b) => b.addEventListener('click', () => openEditModal(byId[b.dataset.id])));
        box.querySelectorAll('.publish-btn').forEach((b) => b.addEventListener('click', () => togglePublish(byId[b.dataset.id])));
        box.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => deleteItem(byId[b.dataset.id])));
      })
      .catch((err) => {
        box.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
  }

  loadItems();
})();
