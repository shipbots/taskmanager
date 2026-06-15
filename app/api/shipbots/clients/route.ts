import { isAuthed, unauthorized, json } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface OnboardingClient {
  id: string;
  name: string;
}

// The ShipBots master client list, sourced from the Monday Clients board via the
// Onboarding Dashboard's search-index endpoint. Read-only.
export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  const base = process.env.ONBOARDING_API_BASE?.replace(/\/$/, '');
  if (!base) return json([]);
  try {
    const res = await fetch(`${base}/api/clients/search-index`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return json([]);
    const data = (await res.json()) as OnboardingClient[];
    if (!Array.isArray(data)) return json([]);
    const clients = data
      .map((c) => ({ id: c.id, name: (c.name ?? '').trim() }))
      .filter((c) => c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(clients);
  } catch (e) {
    console.warn('GET /api/shipbots/clients failed:', e);
    return json([]);
  }
}
