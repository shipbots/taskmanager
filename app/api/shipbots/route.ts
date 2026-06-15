import { isAuthed, unauthorized, json } from '@/lib/api';
import { getProjectBySlug } from '@/lib/projects';
import { fetchShipbotsTasks } from '@/lib/shipbots';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  const project = await getProjectBySlug('shipbots');
  if (!project) return json([]);
  const tasks = await fetchShipbotsTasks(project);
  return json(tasks);
}
