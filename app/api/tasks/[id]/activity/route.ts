import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeActivity } from '@/lib/serialize';
import { ActivityType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  const activities = await prisma.activity.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'desc' },
  });
  return json(activities.map(serializeActivity));
}

// POST a free-text comment to the timeline.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const body = await request.json();
    const message = String(body.message ?? '').trim();
    if (!message) return badRequest('Comment is required');

    const activity = await prisma.activity.create({
      data: { taskId: id, type: ActivityType.COMMENT, message },
    });
    return json(serializeActivity(activity), { status: 201 });
  } catch (e) {
    console.error('POST /api/tasks/[id]/activity', e);
    return serverError();
  }
}
