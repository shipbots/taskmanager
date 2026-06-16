import { isAuthed, unauthorized, json, badRequest, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeLabel } from '@/lib/serialize';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const body = await request.json();
    const data: Prisma.LabelUpdateInput = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.color === 'string') data.color = body.color;
    const label = await prisma.label.update({ where: { id }, data });
    return json(serializeLabel(label));
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002')
      return badRequest('A label with that name already exists');
    if ((e as { code?: string }).code === 'P2025') return notFound('Label not found');
    console.error('PATCH /api/labels/[id]', e);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    await prisma.label.delete({ where: { id } });
    return json({ ok: true });
  } catch {
    return notFound('Label not found');
  }
}
