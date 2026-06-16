import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/labels';
import { serializeLabel } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return json([]);
  const labels = await getLabels(projectId);
  return json(labels.map(serializeLabel));
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  try {
    const body = await request.json();
    const projectId = body.projectId;
    const name = String(body.name ?? '').trim();
    if (!projectId || !name) return badRequest('projectId and name are required');
    const color = typeof body.color === 'string' ? body.color : '#eab308';
    const label = await prisma.label.create({ data: { projectId, name, color } });
    return json(serializeLabel(label), { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002')
      return badRequest('A label with that name already exists');
    console.error('POST /api/labels', e);
    return serverError();
  }
}
