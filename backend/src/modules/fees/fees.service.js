const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { generateCode, withCodeRetry } = require('../../utils/helpers');

async function createInvoice(data) {
  // Validate the business relationships rather than relying solely on a
  // Prisma FK constraint error (which would surface as an opaque 500).
  // findUnique already resolves to null (doesn't throw) for a genuinely
  // missing record — no .catch() needed, and adding one would turn a real
  // DB/connection error into a misleading "not found" response instead of
  // surfacing as the 500 it actually is.
  const [student, feeCategory, academicYear] = await Promise.all([
    prisma.student.findUnique({ where: { id: data.studentId }, select: { id: true } }),
    prisma.feeCategory.findUnique({ where: { id: data.feeCategoryId }, select: { id: true } }),
    prisma.academicYear.findUnique({ where: { id: data.academicYearId }, select: { id: true } }),
  ]);
  if (!student) throw new ApiError(422, 'Student not found.');
  if (!feeCategory) throw new ApiError(422, 'Fee category not found.');
  if (!academicYear) throw new ApiError(422, 'Academic year not found.');

  return withCodeRetry(
    () =>
      prisma.studentFeeInvoice.create({
        data: {
          ...data,
          invoiceNumber: generateCode('INV'),
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
      }),
    'invoice_number'
  );
}

async function getStudentInvoices(studentId) {
  const invoices = await prisma.studentFeeInvoice.findMany({
    where: { studentId },
    include: { feeCategory: true, payments: { orderBy: { paidAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
  const totals = invoices.reduce(
    (acc, inv) => {
      acc.totalDue += Number(inv.amountDue) - Number(inv.discountAmount) - Number(inv.scholarshipAmount);
      acc.totalPaid += Number(inv.amountPaid);
      return acc;
    },
    { totalDue: 0, totalPaid: 0 }
  );
  totals.outstanding = Math.max(0, totals.totalDue - totals.totalPaid);
  return { invoices, totals };
}

/** Resolves the studentId an invoice belongs to, for ownership checks — never trust a client-supplied studentId instead. */
async function getInvoiceStudentId(invoiceId) {
  const invoice = await prisma.studentFeeInvoice.findUnique({
    where: { id: invoiceId },
    select: { studentId: true },
  });
  return invoice ? invoice.studentId : null;
}

/**
 * Records a payment against an invoice and updates invoice status/paid
 * amount. The read-check-write is done inside a single Serializable
 * transaction so two concurrent payments against the same invoice can't
 * both pass the "does this exceed the balance" check before either one
 * writes (which would otherwise allow double-payment/overpayment). On a
 * serialization conflict Prisma throws P2034; the caller should treat
 * that as "please retry."
 */
async function recordPayment(invoiceId, data, actorIds) {
  try {
    return await withCodeRetry(
      () =>
        prisma.$transaction(
          async (tx) => {
            const invoice = await tx.studentFeeInvoice.findUnique({ where: { id: invoiceId } });
            if (!invoice) throw new ApiError(404, 'Invoice not found.');

            const netDue = Number(invoice.amountDue) - Number(invoice.discountAmount) - Number(invoice.scholarshipAmount);
            const alreadyPaid = Number(invoice.amountPaid);
            const newPaidTotal = alreadyPaid + data.amount;
            const remaining = Math.max(0, netDue - alreadyPaid);

            if (newPaidTotal > netDue + 0.01) {
              throw new ApiError(422, `Payment exceeds the remaining due amount (${remaining.toFixed(2)}).`);
            }

            const status = newPaidTotal >= netDue - 0.01 ? 'paid' : 'partially_paid';

            const payment = await tx.payment.create({
              data: {
                invoiceId,
                receiptNumber: generateCode('RCP'),
                amount: data.amount,
                paymentMethod: data.paymentMethod,
                gatewayReference: data.gatewayReference,
                paidBy: actorIds.paidBy,
                receivedBy: actorIds.receivedBy,
              },
            });
            await tx.studentFeeInvoice.update({
              where: { id: invoiceId },
              data: { amountPaid: newPaidTotal, status },
            });
            return payment;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        ),
      'receipt_number'
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Postgres serialization failure — another payment for this invoice
    // committed concurrently. Ask the caller to retry rather than silently
    // dropping or double-applying the payment.
    if (err.code === 'P2034') {
      throw new ApiError(409, 'This invoice was just updated by another payment. Please retry.');
    }
    throw err;
  }
}

async function applyDiscount(invoiceId, data, approvedBy) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.studentFeeInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new ApiError(404, 'Invoice not found.');

        const field = data.discountType === 'scholarship' ? 'scholarshipAmount' : 'discountAmount';
        const otherField = field === 'scholarshipAmount' ? 'discountAmount' : 'scholarshipAmount';
        const newFieldTotal = Number(invoice[field]) + data.amount;
        const netDueAfter = Number(invoice.amountDue) - newFieldTotal - Number(invoice[otherField]);
        const alreadyPaid = Number(invoice.amountPaid);

        // A discount/scholarship can never push the invoice's remaining
        // balance below zero, and never below what's already been paid
        // (that would mean the invoice owes a refund, which this endpoint
        // doesn't handle).
        if (netDueAfter < 0) {
          throw new ApiError(422, 'This discount would exceed the invoice amount.');
        }
        if (netDueAfter < alreadyPaid - 0.01) {
          throw new ApiError(422, 'This discount would make the invoice balance less than what has already been paid.');
        }

        // If this write fails, the transaction must abort — silently
        // proceeding would change the invoice's discount/scholarship
        // amount and status with no audit record explaining why.
        const discount = await tx.feeDiscount.create({
          data: { invoiceId, ...data, approvedBy, status: 'approved' },
        });

        const status = netDueAfter - alreadyPaid <= 0.01 ? 'paid' : invoice.status;
        const updated = await tx.studentFeeInvoice.update({
          where: { id: invoiceId },
          data: { [field]: { increment: data.amount }, status },
        });
        return { discount, invoice: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.code === 'P2034') {
      throw new ApiError(409, 'This invoice was just updated elsewhere. Please retry.');
    }
    throw err;
  }
}

async function recordExpense(data, recordedBy) {
  return prisma.expense.create({
    data: { ...data, expenseDate: new Date(data.expenseDate), recordedBy },
  });
}

async function getFinanceSummary({ from, to }) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const [payments, expenses, outstandingInvoices] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: Object.keys(dateFilter).length ? { paidAt: dateFilter } : undefined,
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: Object.keys(dateFilter).length ? { expenseDate: dateFilter } : undefined,
    }),
    prisma.studentFeeInvoice.aggregate({
      _sum: { amountDue: true, amountPaid: true, discountAmount: true, scholarshipAmount: true },
      where: { status: { in: ['unpaid', 'partially_paid', 'overdue'] } },
    }),
  ]);

  const income = Number(payments._sum.amount || 0);
  const expense = Number(expenses._sum.amount || 0);
  const netDueOutstanding =
    Number(outstandingInvoices._sum.amountDue || 0) -
    Number(outstandingInvoices._sum.discountAmount || 0) -
    Number(outstandingInvoices._sum.scholarshipAmount || 0) -
    Number(outstandingInvoices._sum.amountPaid || 0);

  return {
    income,
    expense,
    netIncome: income - expense,
    totalDue: Math.max(0, netDueOutstanding),
  };
}

async function listFeeCategories() {
  return prisma.feeCategory.findMany({ orderBy: { name: 'asc' } });
}

async function listExpenseCategories() {
  return prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
}

module.exports = {
  createInvoice,
  getStudentInvoices,
  getInvoiceStudentId,
  recordPayment,
  applyDiscount,
  recordExpense,
  getFinanceSummary,
  listFeeCategories,
  listExpenseCategories,
};
