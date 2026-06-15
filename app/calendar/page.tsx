import { getHomeData } from '@/lib/load';
import { getProjects } from '@/lib/projects';
import { serializeProject } from '@/lib/serialize';
import { CalendarBoard } from '@/components/calendar-board';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const [sections, projects] = await Promise.all([getHomeData(), getProjects()]);
  const tasks = sections.flatMap((s) => s.tasks);
  return <CalendarBoard tasks={tasks} projects={projects.map(serializeProject)} />;
}
