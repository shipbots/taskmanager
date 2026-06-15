import { prisma } from '@/lib/prisma';
import { getProjects } from '@/lib/projects';
import { serializeTemplate, serializeProject } from '@/lib/serialize';
import { TemplatesManager } from '@/components/templates-manager';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const [templates, projects] = await Promise.all([
    prisma.template.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    getProjects(),
  ]);

  return (
    <TemplatesManager
      initialTemplates={templates.map(serializeTemplate)}
      projects={projects.map(serializeProject)}
    />
  );
}
