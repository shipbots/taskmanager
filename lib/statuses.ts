import { prisma } from '@/lib/prisma';
import type { Status } from '@prisma/client';

// Columns every project starts with. "Done" is the special completion column.
export const DEFAULT_STATUSES = [
  { name: 'Pending', color: '#94a3b8', sortOrder: 0, isDone: false },
  { name: 'In Progress', color: '#3b82f6', sortOrder: 1, isDone: false },
  { name: 'Blocked', color: '#f59e0b', sortOrder: 2, isDone: false },
  { name: 'Done', color: '#22c55e', sortOrder: 3, isDone: true },
];

const STATUS_ORDER_BY = [
  { isDone: 'asc' as const },
  { sortOrder: 'asc' as const },
  { name: 'asc' as const },
];

export async function seedStatusesForProject(projectId: string): Promise<void> {
  await prisma.status.createMany({
    data: DEFAULT_STATUSES.map((s) => ({ ...s, projectId })),
    skipDuplicates: true,
  });
}

/** Project's statuses, seeding the defaults the first time (done column always last). */
export async function ensureStatuses(projectId: string): Promise<Status[]> {
  const existing = await prisma.status.findMany({ where: { projectId }, orderBy: STATUS_ORDER_BY });
  if (existing.length > 0) return existing;
  await seedStatusesForProject(projectId);
  return prisma.status.findMany({ where: { projectId }, orderBy: STATUS_ORDER_BY });
}

export function orderStatuses<T extends { isDone: boolean; sortOrder: number; name: string }>(
  statuses: T[],
): T[] {
  return [...statuses].sort(
    (a, b) =>
      Number(a.isDone) - Number(b.isDone) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
}

export function firstStatusName(statuses: { isDone: boolean; sortOrder: number; name: string }[]): string {
  return orderStatuses(statuses)[0]?.name ?? 'Pending';
}

export function doneStatusName(statuses: { isDone: boolean; name: string }[]): string | null {
  return statuses.find((s) => s.isDone)?.name ?? null;
}

const SHIPBOTS_PALETTE = ['#94a3b8', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e'];

/**
 * Make a project's status columns mirror an external set of option names
 * (the Monday subitem status options) so columns + writes line up 1:1.
 */
export async function syncStatusesToOptions(projectId: string, options: string[]): Promise<void> {
  if (!options.length) return; // couldn't discover — leave existing columns alone
  for (let i = 0; i < options.length; i++) {
    const name = options[i];
    const isDone = /done|complete|finished|delivered/i.test(name);
    await prisma.status.upsert({
      where: { projectId_name: { projectId, name } },
      update: { sortOrder: i, isDone },
      create: { projectId, name, sortOrder: i, isDone, color: SHIPBOTS_PALETTE[i % SHIPBOTS_PALETTE.length] },
    });
  }
  await prisma.status.deleteMany({ where: { projectId, name: { notIn: options } } });
}
