import { prisma } from '@/lib/prisma';
import type { Project } from '@prisma/client';
import { getProjects, getProjectBySlug } from '@/lib/projects';
import { serializeTask, serializeProject, serializeStatus } from '@/lib/serialize';
import { TASK_LIST_INCLUDE } from '@/lib/task-service';
import { ensureStatuses, syncStatusesToOptions } from '@/lib/statuses';
import { fetchShipbotsTasks } from '@/lib/shipbots';
import { fetchSubitemBoardInfo, hasMondayKey } from '@/lib/monday';
import type { TaskView, ProjectView, StatusView } from '@/lib/types';

export interface ProjectSection {
  project: ProjectView;
  statuses: StatusView[];
  tasks: TaskView[];
}

/** A project's columns + tasks (native, plus mirrored ShipBots tasks when enabled). */
export async function loadProjectSection(project: Project): Promise<ProjectSection> {
  // ShipBots columns mirror the Monday subitem status options so edits map 1:1.
  if (project.pullsFromOnboarding && hasMondayKey()) {
    try {
      const info = await fetchSubitemBoardInfo();
      await syncStatusesToOptions(project.id, info.statusOptions);
    } catch {
      /* keep existing columns if discovery fails */
    }
  }
  const statuses = (await ensureStatuses(project.id)).map(serializeStatus);
  const native = await prisma.task.findMany({
    where: { projectId: project.id },
    include: TASK_LIST_INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  let tasks = native.map(serializeTask);
  if (project.pullsFromOnboarding) {
    const mirrored = await fetchShipbotsTasks(serializeProject(project), statuses);
    tasks = [...tasks, ...mirrored];
  }
  return { project: serializeProject(project), statuses, tasks };
}

/** One section per project, in order — powers the home dashboard. */
export async function getHomeData(): Promise<ProjectSection[]> {
  const projects = await getProjects();
  return Promise.all(projects.map((p) => loadProjectSection(p)));
}

export async function getProjectPageData(slug: string): Promise<ProjectSection | null> {
  const project = await getProjectBySlug(slug);
  if (!project) return null;
  return loadProjectSection(project);
}

/** All native tasks across projects (for the global calendar). */
export async function getAllTasks(): Promise<TaskView[]> {
  const tasks = await prisma.task.findMany({
    include: TASK_LIST_INCLUDE,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  return tasks.map(serializeTask);
}
