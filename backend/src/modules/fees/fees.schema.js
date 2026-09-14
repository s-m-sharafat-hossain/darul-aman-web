const { z } = require('zod');

const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  feeCategoryId: z.number().int(),
  academicYearId: z.number().int(),
  billingPeriod: z.string().optional(),
  amountDue: z.number().positive(),
  dueDate: z.string().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['cash', 'bank', 'mobile_banking', 'card', 'online_gateway']).default('cash'),
  gatewayReference: z.string().optional(),
});

const applyDiscountSchema = z.object({
  discountType: z.enum(['discount', 'scholarship']),
  amount: z.number().positive(),
  reason: z.string().min(2),
});

const recordExpenseSchema = z.object({
  expenseCategoryId: z.number().int(),
  description: z.string().min(2),
  amount: z.number().positive(),
  expenseDate: z.string(),
  paidTo: z.string().optional(),
});

module.exports = { createInvoiceSchema, recordPaymentSchema, applyDiscountSchema, recordExpenseSchema };
