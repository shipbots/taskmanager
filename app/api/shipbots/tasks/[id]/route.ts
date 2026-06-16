import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { fetchSubitemBoardInfo, updateSubitem, hasMondayKey } from '@/lib/monday';

export const dynamic = 'force-dynamic';

// PATCH a ShipBots task — writes the edit straight back to the Monday subitem.
// `id` is the Monday subitem id. Only the fields present in the body are written,
// so a name edit won't clear the status or date.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  if (!hasMondayKey()) return badRequest('Monday is not configured (missing MONDAY_API_KEY).');

  const { id } = await params;
  try {
    const body = await request.json();
    const hasName = typeof body.name === 'string' && body.name.trim();
    const hasStatus = typeof body.status === 'string' && body.status;
    const hasDue = body.dueDate !== undefined; // string (YYYY-MM-DD) or null to clear

    if (!hasName && !hasStatus && !hasDue) return badRequest('Nothing to update');

    const info = await fetchSubitemBoardInfo();
    if (!info.boardId) return serverError('Could not resolve the Monday subitem board.');

    await updateSubitem(id, info.boardId, {
      name: hasName ? body.name.trim() : undefined,
      statusColumnId: hasStatus ? info.statusColumnId : null,
      status: hasStatus ? body.status : undefined,
      dateColumnId: hasDue ? info.dateColumnId : null,
      dueDate: hasDue ? (body.dueDate ? String(body.dueDate).slice(0, 10) : '') : undefined,
    });

    return json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/shipbots/tasks/[id]', e);
    return serverError('Could not update the task in Monday.');
  }
}
