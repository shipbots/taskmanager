import { isAuthed, unauthorized, json } from '@/lib/api';
import { fetchClientsList, hasMondayKey } from '@/lib/monday';

export const dynamic = 'force-dynamic';

// The ShipBots master client list, read directly from the Monday Clients board.
export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  if (!hasMondayKey()) return json([]);
  try {
    const clients = await fetchClientsList();
    return json(clients.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) {
    console.warn('GET /api/shipbots/clients failed:', e);
    return json([]);
  }
}
