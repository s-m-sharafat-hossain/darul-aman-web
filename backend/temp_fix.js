const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const items = await prisma.galleryItem.findMany();
  console.log(JSON.stringify(items, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
