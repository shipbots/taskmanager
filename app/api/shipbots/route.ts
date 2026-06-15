import { isAuthed, unauthorized, json } from '@/lib/api';
import { getProjectBySlug } from '@/lib/projects';
import { ensureStatuses } from '@/lib/statuses';
import { serializeProject, serializeStatus } from '@/lib/serialize';
import { fetchShipbotsTasks } from '@/lib/shipbots';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  const project = await getProjectBySlug('shipbots');
  if (!project) return json([]);
  const statuses = (await ensureStatuses(project.id)).map(serializeStatus);
  const tasks = await fetchShipbotsTasks(serializeProject(project), statuses);
  return json(tasks);
}
