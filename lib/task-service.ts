import { prisma } from '@/lib/prisma';
import { ActivityType, Prisma } from '@prisma/client';
import { effectiveDueDate, deriveStatus } from '@/lib/task-derive';

// Shared include shapes so routes return consistent data.
export const TASK_DETAIL_INCLUDE = {
  subtasks: { orderBy: { sortOrder: 'asc' } },
  attachments: { orderBy: { createdAt: 'desc' } },
  activities: { orderBy: { createdAt: 'desc' } },
  project: true,
} satisfies Prisma.TaskInclude;

export const TASK_LIST_INCLUDE = {
  subtasks: { orderBy: { sortOrder: 'asc' } },
  project: true,
} satisfies Prisma.TaskInclude;

/** A due date at noon UTC, `n` days after `base` (keeps the calendar day stable). */
export function addDaysNoonUTC(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export async function logActivity(
  taskId: string,
  type: ActivityType,
  message: string,
  meta?: Prisma.InputJsonValue,
) {
  await prisma.activity.create({ data: { taskId, type, message, meta } });
}

/**
 * Recompute a task's derived fields from its subtasks:
 *  - dueDate  = next unfinished subtask's date (falls back to manualDueDate)
 *  - status   = auto-advanced per subtask completion
 *  - completedAt set/cleared to match COMPLETED status
 * Safe to call even when there are no subtasks (leaves manual values intact).
 */
export async function recomputeTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { subtasks: true },
  });
  if (!task) return null;

  const dueDate = effectiveDueDate(task.subtasks, task.manualDueDate);
  const status = deriveStatus(task.status, task.subtasks);
  const completedAt = status === 'COMPLETED' ? task.completedAt ?? new Date() : null;

  return prisma.task.update({
    where: { id: taskId },
    data: { dueDate, status, completedAt },
  });
}

/** Generate a template's subtasks onto a task; due dates from offsetDays + baseDate. */
export async function applyTemplateToTask(taskId: string, templateId: string, baseDate: Date) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!template || template.items.length === 0) return;

  const existing = await prisma.subtask.count({ where: { taskId } });
  await prisma.$transaction(
    template.items.map((item, idx) =>
      prisma.subtask.create({
        data: {
          taskId,
          name: item.name,
          sortOrder: existing + idx,
          dueDate: item.offsetDays != null ? addDaysNoonUTC(baseDate, item.offsetDays) : null,
        },
      }),
    ),
  );
  await logActivity(taskId, ActivityType.TEMPLATE_APPLIED, `Applied template "${template.name}"`, {
    templateId,
  });
  await recomputeTask(taskId);
}
