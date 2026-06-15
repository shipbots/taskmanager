import { isAuthed, unauthorized, json, badRequest, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Rename a client — cascades to every task in the project that used the old name.
// If the new name already exists, the two clients are merged.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return notFound('Client not found');

    const newName = String((await request.json()).name ?? '').trim();
    if (!newName) return badRequest('Name is required');
    if (newName === client.name) return json({ id: client.id, name: client.name });

    await prisma.task.updateMany({
      where: { projectId: client.projectId, client: client.name },
      data: { client: newName },
    });

    const existing = await prisma.client.findUnique({
      where: { projectId_name: { projectId: client.projectId, name: newName } },
    });
    if (existing) {
      await prisma.client.delete({ where: { id } });
      return json({ id: existing.id, name: existing.name, merged: true });
    }
    const updated = await prisma.client.update({ where: { id }, data: { name: newName } });
    return json({ id: updated.id, name: updated.name });
  } catch (e) {
    console.error('PATCH /api/clients/[id]', e);
    return serverError();
  }
}
