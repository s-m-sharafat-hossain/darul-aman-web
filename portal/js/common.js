/**
 * Darul Aman Academy Portal — shared small helpers used across dashboard pages.
 */
window.DAA_UTIL = {
  fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  fmtMoney(n) {
    return '৳' + Number(n || 0).toLocaleString();
  },
  statusBadge(status) {
    const map = {
      present: ['badge-ok', 'Present'],
      paid: ['badge-ok', 'Paid'],
      approved: ['badge-ok', 'Approved'],
      active: ['badge-ok', 'Active'],
      resolved: ['badge-ok', 'Resolved'],
      absent: ['badge-danger', 'Absent'],
      rejected: ['badge-danger', 'Rejected'],
      overdue: ['badge-danger', 'Overdue'],
      inactive: ['badge-danger', 'Inactive'],
      archived: ['badge-muted', 'Archived'],
      transferred: ['badge-warn', 'Transferred'],
      graduated: ['badge-ok', 'Graduated'],
      late: ['badge-warn', 'Late'],
      partially_paid: ['badge-warn', 'Partially Paid'],
      pending: ['badge-warn', 'Pending'],
      unpaid: ['badge-warn', 'Unpaid'],
      leave: ['badge-muted', 'On Leave'],
      not_marked: ['badge-muted', 'Not marked yet'],
    };
    const [cls, label] = map[status] || ['badge-muted', status || '—'];
    return `<span class="badge-status ${cls}">${label}</span>`;
  },
  escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  /** Photo (if set) with graceful fallback to initials, or plain initials
   * circle otherwise. Shared by any page listing students (Admin Students,
   * Teacher My Students, ...) so the avatar look/behavior — and its escaping
   * — lives in exactly one place. `size` may be 'sm' for a smaller circle
   * (list rows) or omitted for the default (topbar-style) size. */
  avatarHtml(person, size) {
    const cls = size === 'sm' ? 'avatar avatar-sm' : 'avatar';
    const name = (person && person.fullName) || '?';
    // Strips anything that isn't a letter/digit so this can never break out
    // of the single-quoted onerror attribute value below.
    const fallbackInitials = name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '?').toUpperCase()).join('').replace(/[^\p{L}\p{N}]/gu, '') || '?';
    if (person && person.photoUrl) {
      return `<div class="${cls}"><img src="${this.escapeHtml(person.photoUrl)}" alt="" onerror="this.parentElement.textContent='${fallbackInitials}'"></div>`;
    }
    return `<div class="${cls}">${this.escapeHtml(fallbackInitials)}</div>`;
  },
};
