import { prisma } from '@/lib/prisma';
import type { Label } from '@prisma/client';

export async function getLabels(projectId: string): Promise<Label[]> {
  return prisma.label.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
}

/** Ensure a ShipBots/Monday project has its auto "onboarding" label (yellow). */
export async function ensureAutoLabel(projectId: string): Promise<Label[]> {
  const existing = await prisma.label.findMany({ where: { projectId, auto: true } });
  if (existing.length > 0) return existing;
  try {
    const created = await prisma.label.create({
      data: { projectId, name: 'onboarding', color: '#eab308', auto: true },
    });
    return [created];
  } catch {
    // A non-auto "onboarding" label may already exist — promote it.
    const found = await prisma.label.findUnique({
      where: { projectId_name: { projectId, name: 'onboarding' } },
    });
    if (found) return [await prisma.label.update({ where: { id: found.id }, data: { auto: true } })];
    return [];
  }
}
