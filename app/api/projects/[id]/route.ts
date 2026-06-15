import { isAuthed, unauthorized, json, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeProject } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.color === 'string') data.color = body.color;
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
    if (typeof body.pullsFromOnboarding === 'boolean')
      data.pullsFromOnboarding = body.pullsFromOnboarding;

    const project = await prisma.project.update({ where: { id }, data });
    return json(serializeProject(project));
  } catch (e) {
    console.error('PATCH /api/projects/[id]', e);
    return serverError();
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    await prisma.project.delete({ where: { id } });
    return json({ ok: true });
  } catch {
    return notFound('Project not found');
  }
}
