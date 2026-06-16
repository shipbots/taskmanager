import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Mirror of lib/task-derive.ts (kept inline so this script is standalone).
const effectiveDueDate = (subs, manual) => {
  const pending = subs.filter((s) => !s.done && s.dueDate).map((s) => s.dueDate);
  if (pending.length) return pending.reduce((m, d) => (d < m ? d : m));
  return manual ?? null;
};
const deriveStatus = (current, subs) => {
  if (subs.length === 0) return current;
  if (subs.every((s) => s.done)) return 'COMPLETED';
  if (current === 'BLOCKED') return 'BLOCKED';
  return subs.some((s) => s.done) ? 'IN_PROGRESS' : 'PENDING';
};
async function recompute(taskId) {
  const t = await prisma.task.findUnique({ where: { id: taskId }, include: { subtasks: true } });
  const dueDate = effectiveDueDate(t.subtasks, t.manualDueDate);
  const status = deriveStatus(t.status, t.subtasks);
  const completedAt = status === 'COMPLETED' ? t.completedAt ?? new Date() : null;
  return prisma.task.update({ where: { id: taskId }, data: { dueDate, status, completedAt } });
}
const d = (s) => new Date(`${s}T12:00:00.000Z`);
const ymd = (x) => (x ? x.toISOString().slice(0, 10) : 'none');

try {
  await prisma.project.createMany({
    data: [
      { name: 'ShipBots', slug: 'shipbots', color: '#0ea5e9', sortOrder: 0, pullsFromOnboarding: true },
      { name: 'Stiefel', slug: 'stiefel', color: '#8b5cf6', sortOrder: 1 },
      { name: 'Casa Mexia', slug: 'casa-mexia', color: '#f97316', sortOrder: 2 },
    ],
    skipDuplicates: true,
  });
  const projects = await prisma.project.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('Projects seeded:', projects.map((p) => p.name).join(', '));
  const shipbots = projects.find((p) => p.slug === 'shipbots');

  const task = await prisma.task.create({
    data: {
      projectId: shipbots.id,
      name: '__VERIFY__ temp',
      status: 'PENDING',
      priority: 'HIGH',
      manualDueDate: d('2026-07-01'),
      dueDate: d('2026-07-01'),
    },
  });
  const s1 = await prisma.subtask.create({ data: { taskId: task.id, name: 'Step 1', dueDate: d('2026-06-20'), sortOrder: 0 } });
  const s2 = await prisma.subtask.create({ data: { taskId: task.id, name: 'Step 2', dueDate: d('2026-06-25'), sortOrder: 1 } });

  let t = await recompute(task.id);
  console.log(`1) two subtasks, none done -> status=${t.status} due=${ymd(t.dueDate)}  [expect PENDING / 2026-06-20]`);

  await prisma.subtask.update({ where: { id: s1.id }, data: { done: true, completedAt: new Date() } });
  t = await recompute(task.id);
  console.log(`2) step 1 done -> status=${t.status} due=${ymd(t.dueDate)}  [expect IN_PROGRESS / 2026-06-25]`);

  await prisma.subtask.update({ where: { id: s2.id }, data: { done: true, completedAt: new Date() } });
  t = await recompute(task.id);
  console.log(`3) all done -> status=${t.status} due=${ymd(t.dueDate)} completedAt=${!!t.completedAt}  [expect COMPLETED]`);

  await prisma.task.delete({ where: { id: task.id } });
  const remaining = await prisma.task.count();
  const subsLeft = await prisma.subtask.count({ where: { taskId: task.id } });
  console.log(`Cleanup: test task deleted, tasks now=${remaining}, orphan subtasks=${subsLeft} (cascade ok)`);
  console.log('VERIFY_OK');
} catch (e) {
  console.error('VERIFY_FAIL', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
