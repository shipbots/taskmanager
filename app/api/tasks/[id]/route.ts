import { isAuthed, unauthorized, json, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { dueDateFromInput, formatDueDate } from '@/lib/dates';
import { effectiveDueDate } from '@/lib/task-derive';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, logActivity } from '@/lib/task-service';
import { saveClient } from '@/lib/clients';
import { ActivityType, Priority, type Prisma } from '@prisma/client';
import { PRIORITY_META } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_DETAIL_INCLUDE });
  if (!task) return notFound('Task not found');
  return json(serializeTask(task));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return notFound('Task not found');

    const body = await request.json();
    const data: Prisma.TaskUpdateInput = {};
    const logs: { type: ActivityType; message: string }[] = [];

    if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== existing.name) {
      data.name = body.name.trim();
      logs.push({ type: ActivityType.FIELD_CHANGED, message: `Renamed to "${body.name.trim()}"` });
    }
    if (body.description !== undefined && body.description !== existing.description) {
      data.description = body.description ? String(body.description) : null;
      logs.push({ type: ActivityType.FIELD_CHANGED, message: 'Updated description' });
    }
    if (body.client !== undefined && body.client !== existing.client) {
      data.client = body.client ? String(body.client) : null;
      logs.push({
        type: ActivityType.FIELD_CHANGED,
        message: body.client ? `Set client to ${body.client}` : 'Cleared client',
      });
    }
    if (
      typeof body.priority === 'string' &&
      (Object.values(Priority) as string[]).includes(body.priority) &&
      body.priority !== existing.priority
    ) {
      data.priority = body.priority as Priority;
      logs.push({
        type: ActivityType.FIELD_CHANGED,
        message: `Priority → ${PRIORITY_META[body.priority as Priority].label}`,
      });
    }

    // Manual status change (e.g. Kanban drag). Must match a column in this
    // project; completedAt tracks whether that column is the Done column.
    if (typeof body.status === 'string' && body.status && body.status !== existing.status) {
      const target = await prisma.status.findFirst({
        where: { projectId: existing.projectId, name: body.status },
      });
      if (target) {
        data.status = target.name;
        data.completedAt = target.isDone ? existing.completedAt ?? new Date() : null;
        logs.push({ type: ActivityType.STATUS_CHANGED, message: `Status → ${target.name}` });
      }
    }

    // Manual due date. When the task has subtasks, shift them to match:
    //  - Kanban drag (rescheduleMode 'kanban'): make the dropped date actually
    //    drive the card by moving the current / earlier unfinished subtasks onto
    //    it, so the effective (next-unfinished) date becomes the new date.
    //  - Manual edit: pull every subtask due BEFORE the new date up to it, and
    //    leave subtasks due on/after the new date untouched.
    if (body.dueDate !== undefined) {
      const manual = dueDateFromInput(body.dueDate);
      let subs = await prisma.subtask.findMany({ where: { taskId: id } });
      let shifted = 0;

      if (manual && subs.length) {
        if (body.rescheduleMode === 'kanban') {
          const unfinished = subs.filter((s) => !s.done && s.dueDate);
          const ids = new Set(unfinished.filter((s) => s.dueDate! < manual).map((s) => s.id));
          // If every unfinished subtask is after the new date, pull the earliest
          // one down so the new date wins as the effective date.
          if (!unfinished.some((s) => s.dueDate! <= manual)) {
            const earliest = [...unfinished].sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
            if (earliest) ids.add(earliest.id);
          }
          if (ids.size) {
            await prisma.subtask.updateMany({ where: { id: { in: [...ids] } }, data: { dueDate: manual } });
            shifted = ids.size;
          }
        } else {
          // Manual edit: clamp unfinished subtasks due before the new date up to it.
          const before = subs.filter((s) => !s.done && s.dueDate && s.dueDate < manual);
          if (before.length) {
            await prisma.subtask.updateMany({
              where: { id: { in: before.map((s) => s.id) } },
              data: { dueDate: manual },
            });
            shifted = before.length;
          }
        }
        if (shifted) subs = await prisma.subtask.findMany({ where: { taskId: id } });
      }

      data.manualDueDate = manual;
      data.dueDate = effectiveDueDate(subs, manual);
      logs.push({
        type: ActivityType.DUE_DATE_CHANGED,
        message: manual ? `Due date → ${formatDueDate(manual)}` : 'Cleared due date',
      });
      if (shifted) {
        logs.push({
          type: ActivityType.FIELD_CHANGED,
          message: `Shifted ${shifted} subtask date${shifted === 1 ? '' : 's'} to match`,
        });
      }
    }

    if (Array.isArray(body.labelIds)) {
      data.labels = { set: body.labelIds.map((lid: string) => ({ id: String(lid) })) };
      logs.push({ type: ActivityType.FIELD_CHANGED, message: 'Updated labels' });
    }

    await prisma.task.update({ where: { id }, data });
    if (typeof data.client === 'string' && data.client) await saveClient(existing.projectId, data.client);
    for (const l of logs) await logActivity(id, l.type, l.message);

    const full = await prisma.task.findUnique({ where: { id }, include: TASK_DETAIL_INCLUDE });
    return json(serializeTask(full!));
  } catch (e) {
    console.error('PATCH /api/tasks/[id]', e);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    await prisma.task.delete({ where: { id } });
    return json({ ok: true });
  } catch {
    return notFound('Task not found');
  }
}
