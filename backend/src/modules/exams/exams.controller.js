const service = require('./exams.service');
const { createExamSchema, createScheduleSchema, enterMarksSchema } = require('./exams.schema');
const { ok, created } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/helpers');
const { assertCanAccessStudent } = require('../../utils/scope');
const { recordAudit } = require('../../middleware/audit');

const createExam = asyncHandler(async (req, res) => {
  const data = createExamSchema.parse(req.body);
  const exam = await service.createExam(data);
  await recordAudit({ req, action: 'exam.create', entityType: 'exam', entityId: exam.id });
  return created(res, exam);
});

const addSchedule = asyncHandler(async (req, res) => {
  const data = createScheduleSchema.parse(req.body);
  const schedule = await service.addSchedule(req.params.examId, data);
  return created(res, schedule);
});

const enterMarks = asyncHandler(async (req, res) => {
  const { entries } = enterMarksSchema.parse(req.body);
  const result = await service.enterMarks(req.params.scheduleId, entries, req.user.id, req.user);
  await recordAudit({ req, action: 'exam.marks_entered', entityType: 'exam_schedule', entityId: req.params.scheduleId, after: { count: entries.length } });
  return ok(res, result);
});

const publishResults = asyncHandler(async (req, res) => {
  const result = await service.publishResults(req.params.examId, req.user.id);
  await recordAudit({ req, action: 'exam.result_published', entityType: 'exam', entityId: req.params.examId });
  return ok(res, result);
});

const studentResults = asyncHandler(async (req, res) => {
  await assertCanAccessStudent(req.user, req.params.studentId);
  const results = await service.getStudentResults(req.params.studentId);
  return ok(res, results);
});

const listExams = asyncHandler(async (req, res) => {
  const exams = await service.listExams(req.query);
  return ok(res, exams);
});

const getScheduleMarks = asyncHandler(async (req, res) => {
  const result = await service.getScheduleMarks(req.params.scheduleId);
  return ok(res, result);
});

module.exports = { createExam, addSchedule, enterMarks, publishResults, studentResults, listExams, getScheduleMarks };
