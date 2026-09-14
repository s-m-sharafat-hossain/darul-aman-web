const express = require('express');
const controller = require('./fees.controller');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

router.post('/invoices', requirePermission('fee.create'), controller.createInvoice);
router.get('/fee-categories', requirePermission('fee.create'), controller.feeCategories);
router.get('/expense-categories', requirePermission('finance.create'), controller.expenseCategories);
router.get('/student/:studentId/invoices', controller.studentInvoices);
router.post('/invoices/:invoiceId/payments', controller.recordPayment); // guardians/students self-pay (ownership-checked); staff path requires fee.create (checked in controller — see comment there)
router.post('/invoices/:invoiceId/discount', requirePermission('fee.approve'), controller.applyDiscount);
router.post('/expenses', requirePermission('finance.create'), controller.recordExpense);
router.get('/summary', requirePermission('finance.view'), controller.financeSummary);

module.exports = router;
