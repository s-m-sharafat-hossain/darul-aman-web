(function () {
  const user = window.DAA_API.requireAuth(['admin', 'principal', 'accountant', 'super_admin']);
  if (!user) return;
  const U = window.DAA_UTIL;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'Finance',
    pageSubtitle: 'Income, expenses, invoices and outstanding dues',
    activeKey: 'finance',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  window.DAA_SHELL.setTopbarName(user.userCode);

  let feeCategories = [];
  let expenseCategories = [];
  let years = [];
  let selectedStudent = null;

  Promise.all([
    window.DAA_API.get('/finance/fee-categories'),
    window.DAA_API.get('/finance/expense-categories'),
    window.DAA_API.get('/academic/years'),
  ])
    .then(([fc, ec, y]) => {
      feeCategories = fc; expenseCategories = ec; years = y;
      renderShell();
      loadSummary();
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });

  function renderShell() {
    const currentYear = years.find(y => y.isCurrent) || years[0];

    content.innerHTML = `
      <div class="row g-3 mb-1" id="summaryCards">
        ${Array(4).fill('<div class="col-6 col-lg-3"><div class="skeleton" style="height:88px;border-radius:14px;"></div></div>').join('')}
      </div>

      <div class="p-card mt-2">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 style="margin:0;"><i class="fa-solid fa-calendar"></i> Filter by Date</h5>
        </div>
        <div class="row g-2">
          <div class="col-md-4"><label class="form-label">From</label><input type="date" class="form-control" id="fromDate"></div>
          <div class="col-md-4"><label class="form-label">To</label><input type="date" class="form-control" id="toDate"></div>
          <div class="col-md-4 d-flex align-items-end"><button class="btn btn-portal-outline w-100" id="applyFilter">Apply</button></div>
        </div>
      </div>

      <div class="p-card mt-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 style="margin:0;"><i class="fa-solid fa-file-invoice-dollar"></i> Create a Fee Invoice</h5>
        </div>
        <div class="auth-error" id="invMsg"></div>
        <div class="mb-2">
          <label class="form-label">Student</label>
          <div class="input-group">
            <input class="form-control" id="invStudentSearch" placeholder="Search by name, roll or student code">
            <button class="btn btn-portal-outline" type="button" id="invStudentSearchBtn">Search</button>
          </div>
          <div id="invStudentResults" class="mt-1"></div>
          <div id="invStudentSelected" class="mt-1" style="font-size:13px;"></div>
        </div>
        <form id="invForm">
          <div class="row g-2">
            ${feeCategories.length ? `
            <div class="col-md-4"><label class="form-label">Fee Category</label>
              <select class="form-control" id="invCategory" required>${feeCategories.map(c => `<option value="${c.id}">${U.escapeHtml(c.name)}</option>`).join('')}</select>
            </div>` : `
            <div class="col-md-4"><div class="empty-state" style="padding:6px 0;font-size:12.5px;">No fee categories set up yet — add one via the database/seed before creating invoices.</div></div>`}
            <div class="col-md-4"><label class="form-label">Academic Year</label>
              <select class="form-control" id="invYear">${years.map(y => `<option value="${y.id}" ${currentYear && y.id === currentYear.id ? 'selected' : ''}>${U.escapeHtml(y.name)}</option>`).join('')}</select>
            </div>
            <div class="col-md-4"><label class="form-label">Billing Period</label><input class="form-control" id="invPeriod" placeholder="e.g. January 2027"></div>
            <div class="col-md-4"><label class="form-label">Amount Due</label><input type="number" step="0.01" class="form-control" id="invAmount" required></div>
            <div class="col-md-4"><label class="form-label">Due Date</label><input type="date" class="form-control" id="invDue"></div>
          </div>
          <button type="submit" class="btn btn-portal-primary mt-3" id="invSubmit" ${feeCategories.length ? '' : 'disabled'}>Create Invoice</button>
        </form>
      </div>

      <div class="p-card mt-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 style="margin:0;"><i class="fa-solid fa-sack-dollar"></i> Record an Expense</h5>
        </div>
        <div class="auth-error" id="expMsg"></div>
        <form id="expForm">
          <div class="row g-2">
            ${expenseCategories.length ? `
            <div class="col-md-3"><label class="form-label">Category</label>
              <select class="form-control" id="expCatId" required>${expenseCategories.map(c => `<option value="${c.id}">${U.escapeHtml(c.name)}</option>`).join('')}</select>
            </div>` : `
            <div class="col-md-3"><div class="empty-state" style="padding:6px 0;font-size:12.5px;">No expense categories yet.</div></div>`}
            <div class="col-md-5"><label class="form-label">Description</label><input class="form-control" id="expDesc" required></div>
            <div class="col-md-2"><label class="form-label">Amount</label><input type="number" step="0.01" class="form-control" id="expAmount" required></div>
            <div class="col-md-2"><label class="form-label">Date</label><input type="date" class="form-control" id="expDate" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="col-md-6"><label class="form-label">Paid To (optional)</label><input class="form-control" id="expPaidTo"></div>
          </div>
          <button type="submit" class="btn btn-portal-primary mt-2" id="expSubmit" ${expenseCategories.length ? '' : 'disabled'}>Save Expense</button>
        </form>
      </div>
    `;

    document.getElementById('applyFilter').addEventListener('click', loadSummary);

    function runStudentSearch() {
      const q = document.getElementById('invStudentSearch').value.trim();
      const resultsBox = document.getElementById('invStudentResults');
      if (!q) { resultsBox.innerHTML = ''; return; }
      resultsBox.innerHTML = `<div style="font-size:12.5px;color:var(--muted);">Searching…</div>`;
      window.DAA_API.get(`/students?search=${encodeURIComponent(q)}&limit=8`)
        .then((students) => {
          if (!students.length) {
            resultsBox.innerHTML = `<div style="font-size:12.5px;color:var(--muted);">No matching students.</div>`;
            return;
          }
          resultsBox.innerHTML = students.map(s => `
            <button type="button" class="btn btn-portal-outline btn-sm me-1 mb-1 pick-student-btn" data-id="${s.id}" data-name="${U.escapeHtml(s.fullName)}" data-code="${s.studentCode}">
              ${U.escapeHtml(s.fullName)} (${s.studentCode}${s.currentClass?.name ? ' — ' + s.currentClass.name : ''})
            </button>
          `).join('');
          resultsBox.querySelectorAll('.pick-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              selectedStudent = { id: btn.dataset.id, name: btn.dataset.name, code: btn.dataset.code };
              document.getElementById('invStudentSelected').innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--ok);"></i> Selected: <strong>${U.escapeHtml(selectedStudent.name)}</strong> (${selectedStudent.code})`;
              resultsBox.innerHTML = '';
              document.getElementById('invStudentSearch').value = '';
            });
          });
        })
        .catch((err) => {
          resultsBox.innerHTML = `<div style="font-size:12.5px;color:var(--danger);">${err.message}</div>`;
        });
    }
    document.getElementById('invStudentSearchBtn').addEventListener('click', runStudentSearch);
    document.getElementById('invStudentSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runStudentSearch(); }
    });

    if (feeCategories.length) {
      document.getElementById('invForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('invMsg');
        const btn = document.getElementById('invSubmit');
        msg.classList.remove('show');
        if (!selectedStudent) {
          msg.textContent = 'Search for and select a student first.';
          msg.classList.add('show');
          return;
        }
        btn.disabled = true;
        try {
          await window.DAA_API.post('/finance/invoices', {
            studentId: selectedStudent.id,
            feeCategoryId: Number(document.getElementById('invCategory').value),
            academicYearId: Number(document.getElementById('invYear').value),
            billingPeriod: document.getElementById('invPeriod').value.trim() || undefined,
            amountDue: parseFloat(document.getElementById('invAmount').value),
            dueDate: document.getElementById('invDue').value || undefined,
          });
          document.getElementById('invForm').reset();
          selectedStudent = null;
          document.getElementById('invStudentSelected').innerHTML = '';
          loadSummary();
        } catch (err) {
          msg.textContent = err.message;
          msg.classList.add('show');
        } finally {
          btn.disabled = false;
        }
      });
    }

    if (expenseCategories.length) {
      document.getElementById('expForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('expMsg');
        const btn = document.getElementById('expSubmit');
        msg.classList.remove('show');
        btn.disabled = true;
        try {
          await window.DAA_API.post('/finance/expenses', {
            expenseCategoryId: Number(document.getElementById('expCatId').value),
            description: document.getElementById('expDesc').value.trim(),
            amount: parseFloat(document.getElementById('expAmount').value),
            expenseDate: document.getElementById('expDate').value,
            paidTo: document.getElementById('expPaidTo').value.trim() || undefined,
          });
          document.getElementById('expForm').reset();
          document.getElementById('expDate').value = new Date().toISOString().slice(0, 10);
          loadSummary();
        } catch (err) {
          msg.textContent = err.message;
          msg.classList.add('show');
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  function loadSummary() {
    const from = document.getElementById('fromDate')?.value;
    const to = document.getElementById('toDate')?.value;
    let qs = '';
    if (from) qs += `from=${from}&`;
    if (to) qs += `to=${to}`;

    window.DAA_API.get(`/finance/summary${qs ? '?' + qs : ''}`)
      .then((data) => {
        document.getElementById('summaryCards').innerHTML = `
          <div class="col-6 col-lg-3">
            <div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
              <div><div class="stat-value">${U.fmtMoney(data.income)}</div><div class="stat-label">Income</div></div></div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card danger"><div class="stat-icon"><i class="fa-solid fa-arrow-trend-down"></i></div>
              <div><div class="stat-value">${U.fmtMoney(data.expense)}</div><div class="stat-label">Expense</div></div></div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card ${data.netIncome >= 0 ? '' : 'danger'}"><div class="stat-icon"><i class="fa-solid fa-scale-balanced"></i></div>
              <div><div class="stat-value">${U.fmtMoney(data.netIncome)}</div><div class="stat-label">Net Income</div></div></div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="stat-card gold"><div class="stat-icon"><i class="fa-solid fa-hourglass-half"></i></div>
              <div><div class="stat-value">${U.fmtMoney(data.totalDue)}</div><div class="stat-label">Outstanding Dues</div></div></div>
          </div>
        `;
      })
      .catch((err) => {
        document.getElementById('summaryCards').innerHTML = `<div class="col-12"><div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div></div>`;
      });
  }
})();
