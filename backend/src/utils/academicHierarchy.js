const prisma = require('../config/db');
const { ApiError } = require('./apiResponse');

/**
 * Validates that a proposed student academic placement forms a real,
 * connected Department -> Class -> Section chain — never trusting that
 * departmentId/classId/sectionId sent together from the client actually
 * belong to one another (spec: "a student cannot belong to Department: Hifz,
 * Class: Alim 2nd Year if that class belongs to another department").
 *
 * Any of the three may be omitted/undefined (e.g. a student not yet
 * assigned a section); only the combinations that ARE provided are
 * cross-checked against each other. Throws ApiError(422) on the first
 * inconsistency found, ApiError(404) if a referenced id doesn't exist.
 *
 * Returns the resolved class/section rows so callers that need them
 * (e.g. to log old/new placement) don't have to re-query.
 */
async function assertValidPlacement({ departmentId, classId, sectionId }) {
  let classRow = null;
  let sectionRow = null;

  if (classId !== undefined && classId !== null) {
    classRow = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRow) throw new ApiError(404, 'Selected class does not exist.');
    if (departmentId !== undefined && departmentId !== null && classRow.departmentId !== departmentId) {
      throw new ApiError(422, 'Selected class does not belong to the selected department.');
    }
  }

  if (sectionId !== undefined && sectionId !== null) {
    sectionRow = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!sectionRow) throw new ApiError(404, 'Selected section does not exist.');
    if (classId !== undefined && classId !== null && sectionRow.classId !== classId) {
      throw new ApiError(422, 'Selected section does not belong to the selected class.');
    }
  }

  if (departmentId !== undefined && departmentId !== null) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new ApiError(404, 'Selected department does not exist.');
  }

  return { classRow, sectionRow };
}

module.exports = { assertValidPlacement };
