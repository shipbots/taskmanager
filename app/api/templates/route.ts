import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeTemplate } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

interface ItemInput {
  name?: unknown;
  offsetDays?: unknown;
}

function cleanItems(items: unknown): { name: string; offsetDays: number | null; sortOrder: number }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it: ItemInput, i) => ({
      name: String(it?.name ?? '').trim(),
      offsetDays:
        it?.offsetDays === null || it?.offsetDays === undefined || it?.offsetDays === ''
          ? null
          : Number(it.offsetDays),
      sortOrder: i,
    }))
    .filter((it) => it.name)
    .map((it) => ({
      ...it,
      offsetDays: it.offsetDays !== null && Number.isFinite(it.offsetDays) ? it.offsetDays : null,
    }));
}

export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  const templates = await prisma.template.findMany({
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  return json(templates.map(serializeTemplate));
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    if (!name) return badRequest('Template name is required');

    const template = await prisma.template.create({
      data: {
        name,
        description: body.description ? String(body.description) : null,
        projectId: body.projectId || null,
        items: { create: cleanItems(body.items) },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return json(serializeTemplate(template), { status: 201 });
  } catch (e) {
    console.error('POST /api/templates', e);
    return serverError();
  }
}
