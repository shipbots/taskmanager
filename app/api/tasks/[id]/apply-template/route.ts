import { isAuthed, unauthorized, json, badRequest, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, applyTemplateToTask } from '@/lib/task-service';

export const dynamic = 'force-dynamic';

// POST { templateId } — append a template's subtasks to an existing task.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const body = await request.json();
    if (!body.templateId) return badRequest('templateId is required');

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return notFound('Task not found');

    await applyTemplateToTask(id, body.templateId, task.createdAt);

    const full = await prisma.task.findUnique({ where: { id }, include: TASK_DETAIL_INCLUDE });
    return json(serializeTask(full!));
  } catch (e) {
    console.error('POST /api/tasks/[id]/apply-template', e);
    return serverError();
  }
}
