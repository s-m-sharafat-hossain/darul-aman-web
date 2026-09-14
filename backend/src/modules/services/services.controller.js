const { z } = require('zod');
const prisma = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ok, created } = require('../../utils/apiResponse');
const { asyncHandler, getPagination, paginationMeta } = require('../../utils/helpers');
const { assertCanAccessStudent } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');

// ---- Schemas ----
const leaveApplicationSchema = z.object({
  studentId: z.string().uuid().optional(), // omitted when a staff member applies for themself
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().min(3),
  attachmentUrl: z.string().optional(),
});

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'processing']),
  reviewNote: z.string().optional(),
});

const serviceRequestSchema = z.object({
  studentId: z.string().uuid().optional(),
  requestType: z.enum(['certificate', 'id_card', 'transfer_certificate', 'document', 'complaint', 'general_application']),
  subject: z.string().min(2),
  details: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

const resolveRequestSchema = z.object({
  status: z.enum(['approved', 'rejected', 'processing']),
  handlerNote: z.string().optional(),
  resolvedFileUrl: z.string().optional(),
});

// ---- Leave applications ----
const applyLeave = asyncHandler(async (req, res) => {
  const data = leaveApplicationSchema.parse(req.body);
  const applicantType = data.studentId ? 'student' : 'staff';
  if (data.studentId) await assertCanAccessStudent(req.user, data.studentId);

  let staffId;
  if (applicantType === 'staff') {
    const staff = await prisma.staff.findUnique({ where: { userId: req.user.id } });
    if (!staff) throw new ApiError(422, 'No staff profile is associated with this account.');
    staffId = staff.id;
  }

  const application = await prisma.leaveApplication.create({
    data: {
      applicantUserId: req.user.id,
      applicantType,
      studentId: data.studentId,
      staffId,
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
    },
  });
  return created(res, application);
});

const reviewLeave = asyncHandler(async (req, res) => {
  const data = reviewSchema.parse(req.body);
  const application = await prisma.leaveApplication.update({
    where: { id: req.params.id },
    data: { ...data, reviewedBy: req.user.id, reviewedAt: new Date() },
  }).catch(() => { throw new ApiError(404, 'Leave application not found.'); });

  await recordAudit({ req, action: 'leave.reviewed', entityType: 'leave_application', entityId: req.params.id, after: data });
  return ok(res, application);
});

const myLeaveApplications = asyncHandler(async (req, res) => {
  const applications = await prisma.leaveApplication.findMany({
    where: { applicantUserId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, applications);
});

const listLeaveApplications = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const pagination = getPagination(req);
  const [applications, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.leaveApplication.count({ where }),
  ]);
  return ok(res, applications, paginationMeta(total, pagination.page, pagination.limit));
});

// ---- General service requests (certificate/ID/TC/document/complaint) ----
const createRequest = asyncHandler(async (req, res) => {
  const data = serviceRequestSchema.parse(req.body);
  if (data.studentId) await assertCanAccessStudent(req.user, data.studentId);

  const request = await prisma.serviceRequest.create({
    data: { ...data, requestedBy: req.user.id },
  });
  return created(res, request);
});

const myRequests = asyncHandler(async (req, res) => {
  const requests = await prisma.serviceRequest.findMany({
    where: { requestedBy: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, requests);
});

const listRequests = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.requestType) where.requestType = req.query.requestType;
  const pagination = getPagination(req);
  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.serviceRequest.count({ where }),
  ]);
  return ok(res, requests, paginationMeta(total, pagination.page, pagination.limit));
});

const resolveRequest = asyncHandler(async (req, res) => {
  const data = resolveRequestSchema.parse(req.body);
  const request = await prisma.serviceRequest.update({
    where: { id: req.params.id },
    data: { ...data, handledBy: req.user.id, resolvedAt: new Date() },
  }).catch(() => { throw new ApiError(404, 'Service request not found.'); });

  await recordAudit({ req, action: 'service_request.resolved', entityType: 'service_request', entityId: req.params.id, after: data });
  return ok(res, request);
});

module.exports = {
  applyLeave, reviewLeave, myLeaveApplications, listLeaveApplications,
  createRequest, myRequests, listRequests, resolveRequest,
};
