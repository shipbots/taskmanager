import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { ensureStatuses } from '@/lib/statuses';
import { serializeStatus } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

// GET /api/statuses?projectId=... — a project's columns (seeded on first use).
export async function GET(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return json([]);
  const statuses = await ensureStatuses(projectId);
  return json(statuses.map(serializeStatus));
}

// POST { projectId, name, color? } — add a normal column (Done stays rightmost).
export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  try {
    const body = await request.json();
    const projectId = body.projectId;
    const name = String(body.name ?? '').trim();
    if (!projectId || !name) return badRequest('projectId and name are required');

    const max = await prisma.status.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    const status = await prisma.status.create({
      data: {
        projectId,
        name,
        color: typeof body.color === 'string' ? body.color : '#94a3b8',
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        isDone: false,
      },
    });
    return json(serializeStatus(status), { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002')
      return badRequest('A column with that name already exists');
    console.error('POST /api/statuses', e);
    return serverError();
  }
}
