import { prisma } from '@/lib/prisma';
import type { Project } from '@prisma/client';
import { getProjects, getProjectBySlug } from '@/lib/projects';
import { serializeTask, serializeProject } from '@/lib/serialize';
import { TASK_LIST_INCLUDE } from '@/lib/task-service';
import { fetchShipbotsTasks } from '@/lib/shipbots';
import type { TaskView, ProjectView } from '@/lib/types';

export interface ProjectSection {
  project: ProjectView;
  tasks: TaskView[];
}

/** Native (DB) tasks for a project, plus mirrored ShipBots tasks when enabled. */
export async function loadProjectTasks(project: Project): Promise<TaskView[]> {
  const native = await prisma.task.findMany({
    where: { projectId: project.id },
    include: TASK_LIST_INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  const tasks = native.map(serializeTask);

  if (project.pullsFromOnboarding) {
    const mirrored = await fetchShipbotsTasks(serializeProject(project));
    return [...tasks, ...mirrored];
  }
  return tasks;
}

/** One section per project, in order — powers the home dashboard. */
export async function getHomeData(): Promise<ProjectSection[]> {
  const projects = await getProjects();
  return Promise.all(
    projects.map(async (p) => ({
      project: serializeProject(p),
      tasks: await loadProjectTasks(p),
    })),
  );
}

export async function getProjectPageData(slug: string): Promise<ProjectSection | null> {
  const project = await getProjectBySlug(slug);
  if (!project) return null;
  return { project: serializeProject(project), tasks: await loadProjectTasks(project) };
}

/** All native tasks across projects (for the global calendar). */
export async function getAllTasks(): Promise<TaskView[]> {
  const tasks = await prisma.task.findMany({
    include: TASK_LIST_INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  return tasks.map(serializeTask);
}
