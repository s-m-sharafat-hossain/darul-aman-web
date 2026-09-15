/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Permission catalogue: module.action pairs referenced across the codebase
// via requirePermission(). Keep this in sync when adding new checks.
// ---------------------------------------------------------------------------
const MODULES = [
  'student', 'guardian', 'teacher', 'academic', 'attendance', 'hifz', 'exam',
  'fee', 'finance', 'notice', 'admission', 'leave', 'service_request', 'user', 'role',
  'assignment', 'gallery',
];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'reject', 'export', 'print'];

// Narrow, student-specific verbs that don't belong on the generic ACTIONS
// list (a "guardian.transfer" or "fee.archive" permission would be
// meaningless noise in the catalogue) — seeded and granted explicitly
// instead of via the MODULES x ACTIONS cross product below.
const EXTRA_PERMISSIONS = [
  { code: 'student.transfer', module: 'student', action: 'transfer', description: 'Move a student to a different department/class/section' },
  { code: 'student.archive', module: 'student', action: 'archive', description: 'Archive a student record (soft-delete)' },
  // Separate from student.edit on purpose: a teacher holds student.edit
  // (ordinary profile fields) but should NOT automatically also be able to
  // upload documents to a student's file — see students.routes.js's
  // POST /:id/documents.
  { code: 'student.document.upload', module: 'student', action: 'document.upload', description: 'Upload a document to a student record' },
];

const ROLE_PERMISSION_MAP = {
  admin: MODULES.flatMap((m) => ACTIONS.map((a) => `${m}.${a}`)).concat(EXTRA_PERMISSIONS.map((p) => p.code)), // near-full access short of super_admin-only routes
  principal: MODULES.flatMap((m) => ACTIONS.filter((a) => a !== 'delete').map((a) => `${m}.${a}`)).concat(EXTRA_PERMISSIONS.map((p) => p.code)),
  hifz_coordinator: ['hifz', 'student', 'teacher', 'assignment'].flatMap((m) => ACTIONS.filter((a) => a !== 'delete').map((a) => `${m}.${a}`)),
  // student.create/student.edit granted so teachers can add/edit students
  // within their assigned scope (enforced server-side in scope.js and in
  // students.service.js's placement-field lock — see updateStudent).
  // Deliberately NOT granted: student.transfer, student.archive,
  // student.view_all, student.manage — those remain admin/principal-only.
  teacher: ['student.view', 'student.create', 'student.edit', 'attendance.create', 'attendance.view', 'exam.create', 'exam.edit', 'hifz.view', 'assignment.view', 'assignment.create', 'assignment.edit', 'assignment.delete'],
  hifz_teacher: ['student.view', 'student.create', 'student.edit', 'hifz.create', 'hifz.edit', 'hifz.view', 'attendance.view', 'attendance.create', 'assignment.view', 'assignment.create', 'assignment.edit', 'assignment.delete'],
  accountant: ['fee.view', 'fee.create', 'fee.edit', 'fee.approve', 'finance.view', 'finance.create', 'student.view'],
  receptionist: ['admission.view', 'admission.create', 'admission.approve', 'student.view', 'student.create'],
  librarian: ['student.view'],
  guardian: [],
  student: [],
};

async function seedRolesAndPermissions() {
  console.log('Seeding roles...');
  const roleNames = Object.keys(ROLE_PERMISSION_MAP).concat(['super_admin']);
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystemRole: true },
    });
  }

  console.log('Seeding permissions...');
  const permissionCodes = [];
  for (const m of MODULES) {
    for (const a of ACTIONS) {
      const code = `${m}.${a}`;
      permissionCodes.push(code);
      await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, module: m, action: a, description: `${a} access on ${m}` },
      });
    }
  }
  for (const p of EXTRA_PERMISSIONS) {
    permissionCodes.push(p.code);
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  console.log('Wiring role -> permission grants...');
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    const permissionRows = await prisma.permission.findMany({ where: { code: { in: perms } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionRows.length) {
      await prisma.rolePermission.createMany({
        data: permissionRows.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }
}

async function seedQuranReferenceData() {
  console.log('Seeding Quran Para reference data...');
  const paraNames = [
    'Alif Lam Meem', 'Sayaqul', 'Tilkal Rusul', 'Lan Tanalu', 'Wal Muhsanat',
    'La Yuhibbullah', 'Wa Iza Samiu', 'Wa Lau Annana', 'Qalal Malau', 'Wa A\'lamu',
    'Yatazirun', 'Wa Mamin Da\'abat', 'Wa Ma Ubrioo', 'Rubama', 'Subhanallazi',
    'Qal Alam', 'Aqtaraba', 'Qad Aflaha', 'Wa Qalallazina', 'A\'man Khalaq',
    'Utlu Ma Oohiya', 'Wa Manyaqnut', 'Wa Mali', 'Faman Azlam', 'Ilayhi Yuraddu',
    'Ha Meem', 'Qala Fama Khatbukum', 'Qad Sami Allah', 'Tabarakallazi', 'Amma',
  ];
  for (let i = 0; i < 30; i++) {
    await prisma.quranPara.upsert({
      where: { id: i + 1 },
      update: {},
      create: { id: i + 1, name: `Para ${i + 1} - ${paraNames[i]}` },
    });
  }
}

async function seedAcademicStructure() {
  console.log('Seeding departments, classes, sections, subjects, academic year...');

  const departments = [
    { name: 'Play Group', slug: 'play-group', displayOrder: 1 },
    { name: 'Primary', slug: 'primary', displayOrder: 2 },
    { name: 'Dakhil', slug: 'dakhil', displayOrder: 3 },
    { name: 'Alim', slug: 'alim', displayOrder: 4 },
    { name: 'Hifz-ul-Quran', slug: 'hifz', displayOrder: 5 },
    { name: 'Islamic Studies', slug: 'islamic-studies', displayOrder: 6 },
    { name: 'Arabic Studies', slug: 'arabic-studies', displayOrder: 7 },
  ];
  const deptRecords = {};
  for (const d of departments) {
    deptRecords[d.slug] = await prisma.department.upsert({ where: { slug: d.slug }, update: {}, create: d });
  }

  const year = await prisma.academicYear.upsert({
    where: { name: '2025-2026' },
    update: { isCurrent: true },
    create: { name: '2025-2026', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'), isCurrent: true },
  });

  const primaryClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
  const classRecords = [];
  for (const name of primaryClasses) {
    const cls = await prisma.class.upsert({
      where: { departmentId_name: { departmentId: deptRecords['primary'].id, name } },
      update: {},
      create: { departmentId: deptRecords['primary'].id, name },
    });
    classRecords.push(cls);
    for (const sectionName of ['A', 'B']) {
      await prisma.section.upsert({
        where: { classId_name: { classId: cls.id, name: sectionName } },
        update: {},
        create: { classId: cls.id, name: sectionName, capacity: 40 },
      });
    }
  }

  const dakhilClass = await prisma.class.upsert({
    where: { departmentId_name: { departmentId: deptRecords['dakhil'].id, name: 'Dakhil 1st Year' } },
    update: {},
    create: { departmentId: deptRecords['dakhil'].id, name: 'Dakhil 1st Year' },
  });
  await prisma.section.upsert({
    where: { classId_name: { classId: dakhilClass.id, name: 'A' } },
    update: {},
    create: { classId: dakhilClass.id, name: 'A', capacity: 35 },
  });

  const subjects = [
    { name: 'Bangla', code: 'BAN' },
    { name: 'English', code: 'ENG' },
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Science', code: 'SCI' },
    { name: 'Arabic', code: 'ARB' },
    { name: 'Quran & Tajweed', code: 'QRT' },
    { name: 'Hifz-ul-Quran', code: 'HIFZ', isHifzSubject: true },
    { name: 'Islamic Studies', code: 'ISL' },
    { name: 'Fiqh', code: 'FIQH' },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  const feeCategories = ['Admission', 'Tuition', 'Hifz', 'Exam', 'Hostel', 'Transport', 'Other'];
  for (const name of feeCategories) {
    await prisma.feeCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const expenseCategories = ['Salary', 'Utilities', 'Maintenance', 'Supplies', 'Other'];
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const designations = ['Principal', 'Vice Principal', 'Senior Teacher', 'Assistant Teacher', 'Hifz Teacher', 'Accountant', 'Receptionist', 'Librarian'];
  for (const title of designations) {
    await prisma.designation.upsert({ where: { title }, update: {}, create: { title } });
  }

  return { deptRecords, year, classRecords, dakhilClass };
}

async function seedDemoUsers({ deptRecords, year, classRecords }) {
  console.log('Seeding demo super admin + sample teacher/student/guardian (fictional data)...');
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  // Super admin
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });
  await prisma.user.upsert({
    where: { userCode: 'SUPERADMIN-0001' },
    update: {},
    create: {
      userCode: 'SUPERADMIN-0001',
      email: 'superadmin@darulamanacademy.example',
      passwordHash,
      roleId: superAdminRole.id,
      mustChangePassword: true,
    },
  });

  // Demo teacher (general)
  const teacherRole = await prisma.role.findUnique({ where: { name: 'teacher' } });
  const teacherUser = await prisma.user.upsert({
    where: { userCode: 'STF-DEMO-0001' },
    update: {},
    create: { userCode: 'STF-DEMO-0001', email: 'teacher.demo@darulamanacademy.example', passwordHash, roleId: teacherRole.id, mustChangePassword: true },
  });
  const teacherStaff = await prisma.staff.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id, staffCode: 'STF-DEMO-0001', fullName: 'Mohammad Rahman (Demo Teacher)',
      departmentId: deptRecords['primary'].id, employmentStatus: 'active',
    },
  });
  const teacher = await prisma.teacher.upsert({
    where: { staffId: teacherStaff.id },
    update: {},
    create: { staffId: teacherStaff.id, teacherType: 'general' },
  });

  // Demo Hifz teacher
  const hifzTeacherRole = await prisma.role.findUnique({ where: { name: 'hifz_teacher' } });
  const hifzTeacherUser = await prisma.user.upsert({
    where: { userCode: 'STF-DEMO-0002' },
    update: {},
    create: { userCode: 'STF-DEMO-0002', email: 'hifz.teacher.demo@darulamanacademy.example', passwordHash, roleId: hifzTeacherRole.id, mustChangePassword: true },
  });
  const hifzStaff = await prisma.staff.upsert({
    where: { userId: hifzTeacherUser.id },
    update: {},
    create: { userId: hifzTeacherUser.id, staffCode: 'STF-DEMO-0002', fullName: 'Hafez Abdul Karim (Demo Hifz Teacher)', departmentId: deptRecords['hifz'].id, employmentStatus: 'active' },
  });
  const hifzTeacher = await prisma.teacher.upsert({
    where: { staffId: hifzStaff.id },
    update: {},
    create: { staffId: hifzStaff.id, teacherType: 'hifz' },
  });

  // Demo guardian
  const guardianRole = await prisma.role.findUnique({ where: { name: 'guardian' } });
  const guardianUser = await prisma.user.upsert({
    where: { userCode: 'GRD-DEMO-0001' },
    update: {},
    create: { userCode: 'GRD-DEMO-0001', phone: '01700000000', passwordHash, roleId: guardianRole.id, mustChangePassword: true },
  });
  const guardian = await prisma.guardian.upsert({
    where: { userId: guardianUser.id },
    update: {},
    create: { userId: guardianUser.id, fullName: 'Abdullah Al Mamun (Demo Guardian)', phone: '01700000000', relationDefault: 'Father' },
  });

  // Demo student (Hifz-enrolled, so the module has visible data end-to-end)
  const studentRole = await prisma.role.findUnique({ where: { name: 'student' } });
  const studentUser = await prisma.user.upsert({
    where: { userCode: 'STU-DEMO-0001' },
    update: {},
    create: { userCode: 'STU-DEMO-0001', passwordHash, roleId: studentRole.id, mustChangePassword: true },
  });
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id, studentCode: 'STU-DEMO-0001', fullName: 'Yusuf Islam (Demo Student)',
      gender: 'male', currentClassId: classRecords[2].id, departmentId: deptRecords['primary'].id,
      academicYearId: year.id, rollNumber: '05', isHifzStudent: true, hifzTeacherId: hifzTeacher.id,
      admissionDate: new Date('2025-01-10'), status: 'active',
    },
  });

  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
    update: {},
    create: { studentId: student.id, guardianId: guardian.id, relation: 'Father', isPrimary: true },
  });

  await prisma.hifzEnrollment.upsert({
    where: { studentId: student.id },
    update: {},
    create: {
      studentId: student.id, assignedTeacherId: hifzTeacher.id, startDate: new Date('2025-01-15'),
      currentParaId: 3, parasCompleted: 2, completionPercent: 6.67, status: 'ongoing',
    },
  });

  console.log('\n--- DEMO LOGIN CREDENTIALS (fictional data — change before production) ---');
  console.log('Super Admin : SUPERADMIN-0001 / ChangeMe123!');
  console.log('Teacher     : STF-DEMO-0001 / ChangeMe123!');
  console.log('Hifz Teacher: STF-DEMO-0002 / ChangeMe123!');
  console.log('Guardian    : GRD-DEMO-0001 / ChangeMe123!');
  console.log('Student     : STU-DEMO-0001 / ChangeMe123!');
  console.log('----------------------------------------------------------------------------\n');
}

async function main() {
  await seedRolesAndPermissions();
  await seedQuranReferenceData();
  const structureRefs = await seedAcademicStructure();
  await seedDemoUsers(structureRefs);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
