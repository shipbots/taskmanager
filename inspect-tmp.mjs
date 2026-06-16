import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const projects = await prisma.project.count();
  const tasks = await prisma.task.count();
  const byStatus = await prisma.task.groupBy({ by: ['status'], _count: true });
  console.log('projects:', projects, 'tasks:', tasks);
  console.log('status distribution:', JSON.stringify(byStatus));
} catch (e) {
  console.error('INSPECT_FAIL', e.message);
} finally {
  await prisma.$disconnect();
}
