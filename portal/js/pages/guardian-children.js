(function () {
  const user = window.DAA_API.requireAuth(['guardian']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Children',
    pageSubtitle: 'Attendance, results and Hifz progress per child',
    activeKey: 'children',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let children = [];
  let activeId = null;

  function renderSwitcher() {
    return `<div class="child-switcher">
      ${children.map(c => `<div class="child-chip ${c.id === activeId ? 'active' : ''}" data-id="${c.id}">${U.escapeHtml(c.fullName)}</div>`).join('')}
    </div>`;
  }

  function loadChildDetail(id) {
    activeId = id;
    const child = children.find(c => c.id === id);
    const detailBox = document.getElementById('childDetail');
    detailBox.innerHTML = `<div class="skeleton" style="height:160px;border-radius:14px;"></div>`;

    Promise.allSettled([
      window.DAA_API.get(`/attendance/student/${id}`),
      window.DAA_API.get(`/exams/student/${id}/results`),
      window.DAA_API.get(`/hifz/student/${id}/overview`),
    ]).then(([attRes, examRes, hifzRes]) => {
      const att = attRes.status === 'fulfilled' ? attRes.value : null;
      const exams = examRes.status === 'fulfilled' ? examRes.value : [];
      const hifz = hifzRes.status === 'fulfilled' ? hifzRes.value : null;

      detailBox.innerHTML = `
        <div class="row g-3">
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-id-card"></i> ${U.escapeHtml(child.fullName)}</h5>
              <ul class="list-clean">
                <li><span>Student Code</span><strong>${child.studentCode}</strong></li>
                <li><span>Class</span><strong>${child.currentClass?.name || '—'}</strong></li>
                <li><span>Section</span><strong>${child.currentSection?.name || '—'}</strong></li>
                <li><span>Relation</span><strong>${child.relation || '—'}</strong></li>
              </ul>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-calendar-check"></i> Attendance</h5>
              ${att ? `<ul class="list-clean">
                <li><span>Present</span><strong>${att.summary.present}</strong></li>
                <li><span>Absent</span><strong>${att.summary.absent}</strong></li>
                <li><span>Rate</span><strong>${att.summary.percentage}%</strong></li>
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>Not available.</div>`}
            </div>
          </div>
          <div class="col-lg-4">
            <div class="p-card">
              <h5><i class="fa-solid fa-book-quran"></i> Hifz Progress</h5>
              ${hifz ? `<ul class="list-clean">
                <li><span>Completion</span><strong>${hifz.completionPercent ?? 0}%</strong></li>
                <li><span>Paras Done</span><strong>${hifz.parasCompleted ?? 0}</strong></li>
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>Not enrolled in Hifz.</div>`}
            </div>
          </div>
          <div class="col-12">
            <div class="p-card">
              <h5><i class="fa-solid fa-file-lines"></i> Exam Results</h5>
              ${exams.length ? `<ul class="list-clean">
                ${exams.map(r => `<li><span>${U.escapeHtml(r.exam?.name || 'Exam')}</span><strong>${r.grade || '—'} (${r.totalObtained ?? '—'}/${r.totalFull ?? '—'})</strong></li>`).join('')}
              </ul>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No published results yet.</div>`}
            </div>
          </div>
        </div>
      `;
    });
  }

  window.DAA_API.get('/guardians/my-children')
    .then((data) => {
      children = data;
      if (!children.length) {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-children"></i>No children linked to this account yet.</div></div>`;
        return;
      }
      content.innerHTML = `${renderSwitcher()}<div id="childDetail"></div>`;
      document.querySelectorAll('.child-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('.child-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          loadChildDetail(chip.dataset.id);
        });
      });
      loadChildDetail(children[0].id);
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
