import { isAuthed, unauthorized, json, badRequest, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeStatus } from '@/lib/serialize';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Rename / recolor a column. Renaming re-points the project's tasks to the new name.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const status = await prisma.status.findUnique({ where: { id } });
    if (!status) return notFound('Status not found');

    const body = await request.json();
    const data: Prisma.StatusUpdateInput = {};
    let newName = '';
    if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== status.name) {
      newName = body.name.trim();
      data.name = newName;
    }
    if (typeof body.color === 'string') data.color = body.color;

    const updated = await prisma.status.update({ where: { id }, data });
    if (newName) {
      await prisma.task.updateMany({
        where: { projectId: status.projectId, status: status.name },
        data: { status: newName },
      });
    }
    return json(serializeStatus(updated));
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002')
      return badRequest('A column with that name already exists');
    console.error('PATCH /api/statuses/[id]', e);
    return serverError();
  }
}

// Delete a column (not the Done column, not the last remaining column). Tasks in
// it move to the first column.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const status = await prisma.status.findUnique({ where: { id } });
    if (!status) return notFound('Status not found');
    if (status.isDone) return badRequest("The Done column can't be deleted (rename it instead)");

    const nonDone = await prisma.status.count({
      where: { projectId: status.projectId, isDone: false },
    });
    if (nonDone <= 1) return badRequest('A project needs at least one column besides Done');

    const fallback = await prisma.status.findFirst({
      where: { projectId: status.projectId, isDone: false, NOT: { id } },
      orderBy: { sortOrder: 'asc' },
    });
    if (fallback) {
      await prisma.task.updateMany({
        where: { projectId: status.projectId, status: status.name },
        data: { status: fallback.name },
      });
    }
    await prisma.status.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/statuses/[id]', e);
    return serverError();
  }
}
