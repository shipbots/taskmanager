import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { dueDateFromInput } from '@/lib/dates';
import { serializeTask } from '@/lib/serialize';
import { TASK_LIST_INCLUDE, TASK_DETAIL_INCLUDE, applyTemplateToTask, logActivity, addDaysNoonUTC } from '@/lib/task-service';
import { saveClient } from '@/lib/clients';
import { ActivityType, Prisma, Priority, TaskStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/tasks?projectId=... | ?slug=...   (omit both for all tasks)
export async function GET(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const slug = searchParams.get('slug');

  const where: Prisma.TaskWhereInput = {};
  if (projectId) where.projectId = projectId;
  if (slug) where.project = { slug };

  const tasks = await prisma.task.findMany({
    where,
    include: TASK_LIST_INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  return json(tasks.map(serializeTask));
}

// POST /api/tasks  — create a task (status defaults to PENDING)
export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    if (!name) return badRequest('Task name is required');

    // resolve project by id or slug
    let projectId: string | undefined = body.projectId;
    if (!projectId && body.slug) {
      const p = await prisma.project.findUnique({ where: { slug: body.slug } });
      projectId = p?.id;
    }
    if (!projectId) return badRequest('A project is required');

    const priority: Priority = (Object.values(Priority) as string[]).includes(body.priority)
      ? body.priority
      : Priority.MEDIUM;
    // Default to the next day when no due date is provided.
    const manualDueDate = dueDateFromInput(body.dueDate) ?? addDaysNoonUTC(new Date(), 1);

    const max = await prisma.task.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const created = await prisma.task.create({
      data: {
        projectId,
        name,
        description: body.description ? String(body.description) : null,
        client: body.client ? String(body.client) : null,
        priority,
        status: TaskStatus.PENDING,
        manualDueDate,
        dueDate: manualDueDate,
        sortOrder,
        templateId: body.templateId || null,
      },
    });

    await logActivity(created.id, ActivityType.CREATED, 'Task created');
    if (created.client) await saveClient(projectId, created.client);

    if (body.templateId) {
      await applyTemplateToTask(created.id, body.templateId, created.createdAt);
    }

    const full = await prisma.task.findUnique({
      where: { id: created.id },
      include: TASK_DETAIL_INCLUDE,
    });
    return json(serializeTask(full!), { status: 201 });
  } catch (e) {
    console.error('POST /api/tasks', e);
    return serverError();
  }
}
