import { isAuthed, unauthorized, json, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeTemplate } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

function cleanItems(items: unknown): { name: string; offsetDays: number | null; sortOrder: number }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it: { name?: unknown; offsetDays?: unknown }, i) => {
      const raw = it?.offsetDays;
      const num = raw === null || raw === undefined || raw === '' ? null : Number(raw);
      return {
        name: String(it?.name ?? '').trim(),
        offsetDays: num !== null && Number.isFinite(num) ? num : null,
        sortOrder: i,
      };
    })
    .filter((it) => it.name);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!template) return notFound('Template not found');
  return json(serializeTemplate(template));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.description !== undefined)
      data.description = body.description ? String(body.description) : null;
    if (body.projectId !== undefined) data.projectId = body.projectId || null;

    await prisma.template.update({ where: { id }, data });

    // Replace items wholesale when provided.
    if (body.items !== undefined) {
      await prisma.templateSubtask.deleteMany({ where: { templateId: id } });
      const items = cleanItems(body.items);
      if (items.length) {
        await prisma.templateSubtask.createMany({
          data: items.map((it) => ({ ...it, templateId: id })),
        });
      }
    }

    const full = await prisma.template.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return json(serializeTemplate(full!));
  } catch (e) {
    console.error('PATCH /api/templates/[id]', e);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    await prisma.template.delete({ where: { id } });
    return json({ ok: true });
  } catch {
    return notFound('Template not found');
  }
}
