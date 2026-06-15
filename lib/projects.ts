import { prisma } from '@/lib/prisma';
import type { Project } from '@prisma/client';

// The three projects the app ships with. ShipBots mirrors the Onboarding
// Dashboard. Users can add/edit/reorder projects after this.
const DEFAULT_PROJECTS = [
  { name: 'ShipBots', slug: 'shipbots', color: '#0ea5e9', sortOrder: 0, pullsFromOnboarding: true },
  { name: 'Stifel', slug: 'stifel', color: '#8b5cf6', sortOrder: 1, pullsFromOnboarding: false },
  { name: 'Casa Mexia', slug: 'casa-mexia', color: '#f97316', sortOrder: 2, pullsFromOnboarding: false },
];

let seeded = false;

/** Create the default projects once if the table is empty (idempotent). */
export async function ensureDefaultProjects(): Promise<void> {
  if (seeded) return;
  const count = await prisma.project.count();
  if (count === 0) {
    // skipDuplicates (ON CONFLICT DO NOTHING) makes this safe if two requests
    // race to seed on first load.
    await prisma.project.createMany({ data: DEFAULT_PROJECTS, skipDuplicates: true });
  }
  seeded = true;
}

export async function getProjects(): Promise<Project[]> {
  await ensureDefaultProjects();
  return prisma.project.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  await ensureDefaultProjects();
  return prisma.project.findUnique({ where: { slug } });
}

/** URL-safe slug from a project name, with a short suffix to avoid collisions. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'project';
}
