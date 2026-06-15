import { notFound } from 'next/navigation';
import { getProjectPageData } from '@/lib/load';
import { getProjects } from '@/lib/projects';
import { serializeProject } from '@/lib/serialize';
import { ProjectBoard } from '@/components/project-board';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, projects] = await Promise.all([getProjectPageData(slug), getProjects()]);
  if (!data) notFound();

  return (
    <ProjectBoard
      project={data.project}
      statuses={data.statuses}
      tasks={data.tasks}
      projects={projects.map(serializeProject)}
    />
  );
}
