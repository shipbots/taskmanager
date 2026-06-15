import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { dueDateFromInput } from '@/lib/dates';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, recomputeTask, logActivity } from '@/lib/task-service';
import { ActivityType } from '@prisma/client';

export const dynamic = 'force-dynamic';

// POST /api/tasks/[id]/subtasks — add a subtask, then re-derive the task.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    if (!name) return badRequest('Subtask name is required');

    const count = await prisma.subtask.count({ where: { taskId: id } });
    await prisma.subtask.create({
      data: {
        taskId: id,
        name,
        dueDate: dueDateFromInput(body.dueDate),
        sortOrder: count,
      },
    });
    await logActivity(id, ActivityType.SUBTASK_ADDED, `Added subtask "${name}"`);
    await recomputeTask(id);

    const full = await prisma.task.findUnique({ where: { id }, include: TASK_DETAIL_INCLUDE });
    return json(serializeTask(full!), { status: 201 });
  } catch (e) {
    console.error('POST /api/tasks/[id]/subtasks', e);
    return serverError();
  }
}
