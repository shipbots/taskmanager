import { getHomeData } from '@/lib/load';
import { HomeBoard } from '@/components/home-board';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const sections = await getHomeData();
  // Projects for the "new task" picker come straight from the loaded sections.
  const projects = sections.map((s) => s.project);
  return <HomeBoard sections={sections} projects={projects} />;
}
