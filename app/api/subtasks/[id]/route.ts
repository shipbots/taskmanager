import { isAuthed, unauthorized, json, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { dueDateFromInput } from '@/lib/dates';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, recomputeTask, logActivity } from '@/lib/task-service';
import { ActivityType, type Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const sub = await prisma.subtask.findUnique({ where: { id } });
    if (!sub) return notFound('Subtask not found');

    const body = await request.json();
    const data: Prisma.SubtaskUpdateInput = {};
    let toggleLog: { type: ActivityType; message: string } | null = null;

    if (typeof body.done === 'boolean' && body.done !== sub.done) {
      data.done = body.done;
      data.completedAt = body.done ? new Date() : null;
      toggleLog = {
        type: body.done ? ActivityType.SUBTASK_COMPLETED : ActivityType.SUBTASK_REOPENED,
        message: `${body.done ? 'Completed' : 'Reopened'} subtask "${sub.name}"`,
      };
    }
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.dueDate !== undefined) data.dueDate = dueDateFromInput(body.dueDate);
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;

    await prisma.subtask.update({ where: { id }, data });
    if (toggleLog) await logActivity(sub.taskId, toggleLog.type, toggleLog.message);
    await recomputeTask(sub.taskId);

    const full = await prisma.task.findUnique({
      where: { id: sub.taskId },
      include: TASK_DETAIL_INCLUDE,
    });
    return json(serializeTask(full!));
  } catch (e) {
    console.error('PATCH /api/subtasks/[id]', e);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const sub = await prisma.subtask.findUnique({ where: { id } });
    if (!sub) return notFound('Subtask not found');

    await prisma.subtask.delete({ where: { id } });
    await logActivity(sub.taskId, ActivityType.SUBTASK_REMOVED, `Removed subtask "${sub.name}"`);
    await recomputeTask(sub.taskId);

    const full = await prisma.task.findUnique({
      where: { id: sub.taskId },
      include: TASK_DETAIL_INCLUDE,
    });
    return json(serializeTask(full!));
  } catch (e) {
    console.error('DELETE /api/subtasks/[id]', e);
    return serverError();
  }
}
