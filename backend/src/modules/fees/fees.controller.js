const service = require('./fees.service');
const { createInvoiceSchema, recordPaymentSchema, applyDiscountSchema, recordExpenseSchema } = require('./fees.schema');
const { ok, created, ApiError } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { assertCanAccessStudent } = require('../../utils/scope');
const { hasPermission } = require('../../middleware/rbac');
const { recordAudit } = require('../../middleware/audit');

const createInvoice = asyncHandler(async (req, res) => {
  const data = createInvoiceSchema.parse(req.body);
  const invoice = await service.createInvoice(data);
  await recordAudit({ req, action: 'fee.invoice_created', entityType: 'invoice', entityId: invoice.id });
  return created(res, invoice);
});

const studentInvoices = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const result = await service.getStudentInvoices(req.params.studentId);
  return ok(res, result);
});

const recordPayment = asyncHandler(async (req, res) => {
  const data = recordPaymentSchema.parse(req.body);
  const isSelfPay = ['guardian', 'student'].includes(req.user.role);

  if (isSelfPay) {
    // Never trust the invoiceId in the URL on its own for these roles —
    // resolve which student it actually belongs to and confirm the caller
    // is allowed to touch that student's records (own child / own self).
    const invoiceStudentId = await service.getInvoiceStudentId(req.params.invoiceId);
    if (!invoiceStudentId) throw new ApiError(404, 'Invoice not found.');
    await assertCanAccessStudent(req.user, invoiceStudentId);
  } else {
    // Route has no requirePermission gate (it must stay open to guardians/
    // students, who hold no permissions at all, for the self-pay path
    // above). For every other role — staff recording a cash/manual payment —
    // require the same permission invoice creation already requires, so a
    // role with no financial responsibility (teacher, librarian, etc.)
    // can't write payment records just by being logged in.
    const allowed = await hasPermission(req.user, 'fee.create');
    if (!allowed) throw new ApiError(403, 'Missing required permission: fee.create');
  }

  const payment = await service.recordPayment(req.params.invoiceId, data, {
    paidBy: isSelfPay ? req.user.id : undefined,
    receivedBy: isSelfPay ? undefined : req.user.id,
  });
  await recordAudit({ req, action: 'fee.payment_recorded', entityType: 'invoice', entityId: req.params.invoiceId, after: { amount: data.amount } });
  return created(res, payment);
});

const applyDiscount = asyncHandler(async (req, res) => {
  const data = applyDiscountSchema.parse(req.body);
  const result = await service.applyDiscount(req.params.invoiceId, data, req.user.id);
  await recordAudit({ req, action: 'fee.discount_applied', entityType: 'invoice', entityId: req.params.invoiceId, after: data });
  return ok(res, result);
});

const recordExpense = asyncHandler(async (req, res) => {
  const data = recordExpenseSchema.parse(req.body);
  const expense = await service.recordExpense(data, req.user.id);
  await recordAudit({ req, action: 'expense.recorded', entityType: 'expense', entityId: expense.id });
  return created(res, expense);
});

const financeSummary = asyncHandler(async (req, res) => {
  const result = await service.getFinanceSummary(req.query);
  return ok(res, result);
});

const feeCategories = asyncHandler(async (req, res) => {
  const result = await service.listFeeCategories();
  return ok(res, result);
});

const expenseCategories = asyncHandler(async (req, res) => {
  const result = await service.listExpenseCategories();
  return ok(res, result);
});

module.exports = {
  createInvoice, studentInvoices, recordPayment, applyDiscount, recordExpense, financeSummary,
  feeCategories, expenseCategories,
};
