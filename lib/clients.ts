import { prisma } from '@/lib/prisma';

/** Remember a client name under a project (idempotent). */
export async function saveClient(projectId: string, name: string | null | undefined) {
  const clean = (name ?? '').trim();
  if (!clean) return;
  await prisma.client.upsert({
    where: { projectId_name: { projectId, name: clean } },
    update: {},
    create: { projectId, name: clean },
  });
}

export async function getClients(projectId: string) {
  return prisma.client.findMany({ where: { projectId }, orderBy: { name: 'asc' } });
}
