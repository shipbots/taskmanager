import { isAuthed, unauthorized, json, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, logActivity } from '@/lib/task-service';
import { ActivityType } from '@prisma/client';
import { del } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) return notFound('Attachment not found');

    try {
      await del(attachment.url);
    } catch (e) {
      console.warn('Blob delete failed (continuing):', e);
    }
    await prisma.attachment.delete({ where: { id } });
    await logActivity(
      attachment.taskId,
      ActivityType.ATTACHMENT_REMOVED,
      `Removed "${attachment.fileName}"`,
    );

    const full = await prisma.task.findUnique({
      where: { id: attachment.taskId },
      include: TASK_DETAIL_INCLUDE,
    });
    return json(serializeTask(full!));
  } catch (e) {
    console.error('DELETE /api/attachments/[id]', e);
    return serverError();
  }
}
