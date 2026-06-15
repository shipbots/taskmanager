import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { getClients, saveClient } from '@/lib/clients';

export const dynamic = 'force-dynamic';

// GET /api/clients?projectId=... — the saved client list for a project.
export async function GET(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return json([]);
  const clients = await getClients(projectId);
  return json(clients.map((c) => ({ id: c.id, name: c.name })));
}

// POST { projectId, name } — explicitly save a client to a project.
export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  try {
    const body = await request.json();
    if (!body.projectId || !String(body.name ?? '').trim())
      return badRequest('projectId and name are required');
    await saveClient(body.projectId, body.name);
    return json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error('POST /api/clients', e);
    return serverError();
  }
}
