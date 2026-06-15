import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getProjects, slugify } from '@/lib/projects';
import { seedStatusesForProject } from '@/lib/statuses';
import { serializeProject } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthed())) return unauthorized();
  const projects = await getProjects();
  return json(projects.map(serializeProject));
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    if (!name) return badRequest('Name is required');
    const color = typeof body.color === 'string' ? body.color : '#4f46e5';

    let base = slugify(name);
    let slug = base;
    let n = 1;
    while (await prisma.project.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }

    const max = await prisma.project.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const project = await prisma.project.create({ data: { name, slug, color, sortOrder } });
    await seedStatusesForProject(project.id);
    return json(serializeProject(project), { status: 201 });
  } catch (e) {
    console.error('POST /api/projects', e);
    return serverError();
  }
}
