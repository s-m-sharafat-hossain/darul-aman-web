(function () {
  const user = window.DAA_API.requireAuth(['student']);
  if (!user) return;
  const U = window.DAA_UTIL;
  let studentId = null;

  const content = window.DAA_SHELL.render({
    rootPrefix: '../',
    pageTitle: 'My Fees',
    pageSubtitle: 'Invoices and payment history',
    activeKey: 'fees',
    navItems: window.DAA_NAV.itemsFor(user.role),
  });

  content.innerHTML = `<div class="skeleton" style="height:120px;border-radius:14px;"></div>`;

  function render(data) {
    const t = data.totals;
    content.innerHTML = `
      <div class="row g-3 mb-1">
        <div class="col-6 col-lg-4">
          <div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-file-invoice"></i></div>
            <div><div class="stat-value">${U.fmtMoney(t.totalDue)}</div><div class="stat-label">Total Due</div></div></div>
        </div>
        <div class="col-6 col-lg-4">
          <div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-coins"></i></div>
            <div><div class="stat-value">${U.fmtMoney(t.totalPaid)}</div><div class="stat-label">Total Paid</div></div></div>
        </div>
        <div class="col-6 col-lg-4">
          <div class="stat-card danger"><div class="stat-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div><div class="stat-value">${U.fmtMoney(t.outstanding)}</div><div class="stat-label">Outstanding</div></div></div>
        </div>
      </div>

      <div class="p-card mt-1">
        <h5><i class="fa-solid fa-file-invoice-dollar"></i> Invoices</h5>
        ${data.invoices.length ? `<div class="table-responsive"><table class="table align-middle" style="font-size:13.5px;">
          <thead><tr><th>Invoice #</th><th>Category</th><th>Amount Due</th><th>Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${data.invoices.map(inv => {
              const net = Number(inv.amountDue) - Number(inv.discountAmount) - Number(inv.scholarshipAmount);
              const remaining = Math.max(0, net - Number(inv.amountPaid));
              return `<tr>
                <td>${inv.invoiceNumber}</td>
                <td>${inv.feeCategory?.name || '—'}</td>
                <td>${U.fmtMoney(net)}</td>
                <td>${U.fmtMoney(inv.amountPaid)}</td>
                <td>${U.statusBadge(inv.status)}</td>
                <td>${remaining > 0 ? `<button class="btn btn-portal-outline btn-sm pay-btn" data-id="${inv.id}" data-remaining="${remaining}">Pay</button>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>` : `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i>No invoices yet.</div>`}
      </div>

      <div class="modal fade" id="payModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content" style="border-radius:16px;">
          <div class="modal-body p-4">
            <h5 class="mb-3">Make a Payment</h5>
            <div class="auth-error" id="payMsg"></div>
            <div class="mb-3">
              <label class="form-label">Amount (Remaining: <span id="payRemaining"></span>)</label>
              <input type="number" step="0.01" class="form-control" id="payAmount">
            </div>
            <div class="mb-3">
              <label class="form-label">Payment Method</label>
              <select class="form-control" id="payMethod">
                <option value="online_gateway">Online Gateway</option>
                <option value="mobile_banking">Mobile Banking</option>
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <button class="btn btn-portal-primary w-100" id="payConfirm">Confirm Payment</button>
          </div>
        </div></div>
      </div>
    `;

    let activeInvoiceId = null;
    const modalEl = document.getElementById('payModal');
    const modal = new bootstrap.Modal(modalEl);

    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeInvoiceId = btn.dataset.id;
        document.getElementById('payRemaining').textContent = U.fmtMoney(btn.dataset.remaining);
        document.getElementById('payAmount').value = btn.dataset.remaining;
        document.getElementById('payMsg').classList.remove('show');
        modal.show();
      });
    });

    document.getElementById('payConfirm').addEventListener('click', async () => {
      const msg = document.getElementById('payMsg');
      const amount = parseFloat(document.getElementById('payAmount').value);
      const method = document.getElementById('payMethod').value;
      if (!amount || amount <= 0) {
        msg.textContent = 'Enter a valid amount.'; msg.classList.add('show'); return;
      }
      const btn = document.getElementById('payConfirm');
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Processing…';
      try {
        await window.DAA_API.post(`/finance/invoices/${activeInvoiceId}/payments`, { amount, paymentMethod: method });
        modal.hide();
        load();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  function load() {
    window.DAA_API.get(`/finance/student/${studentId}/invoices`)
      .then(render)
      .catch((err) => {
        content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
      });
  }

  window.DAA_API.get('/dashboard/student')
    .then((dash) => {
      studentId = dash.profile?.id;
      window.DAA_SHELL.setTopbarName(dash.profile?.fullName);
      if (!studentId) throw new Error('Student profile not found.');
      load();
    })
    .catch((err) => {
      content.innerHTML = `<div class="p-card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>${err.message}</div></div>`;
    });
})();
