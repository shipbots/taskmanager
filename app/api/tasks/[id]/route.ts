import { isAuthed, unauthorized, json, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { dueDateFromInput, formatDueDate } from '@/lib/dates';
import { effectiveDueDate } from '@/lib/task-derive';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, logActivity } from '@/lib/task-service';
import { saveClient } from '@/lib/clients';
import { ActivityType, Priority, TaskStatus, type Prisma } from '@prisma/client';
import { STATUS_META, PRIORITY_META } from '@/lib/types';

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

    // Manual status change (e.g. Kanban drag). Overrides auto-advance until the
    // next subtask change re-derives it.
    if (
      typeof body.status === 'string' &&
      (Object.values(TaskStatus) as string[]).includes(body.status) &&
      body.status !== existing.status
    ) {
      const status = body.status as TaskStatus;
      data.status = status;
      data.completedAt = status === TaskStatus.COMPLETED ? existing.completedAt ?? new Date() : null;
      logs.push({
        type: ActivityType.STATUS_CHANGED,
        message: `Status → ${STATUS_META[status].label}`,
      });
    }

    // Manual due date — recompute effective date against subtasks (status untouched).
    if (body.dueDate !== undefined) {
      const manual = dueDateFromInput(body.dueDate);
      const subs = await prisma.subtask.findMany({ where: { taskId: id } });
      data.manualDueDate = manual;
      data.dueDate = effectiveDueDate(subs, manual);
      logs.push({
        type: ActivityType.DUE_DATE_CHANGED,
        message: manual ? `Due date → ${formatDueDate(manual)}` : 'Cleared due date',
      });
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
