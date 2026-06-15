import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeTask } from '@/lib/serialize';
import { TASK_DETAIL_INCLUDE, logActivity } from '@/lib/task-service';
import { ActivityType } from '@prisma/client';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';

// POST multipart/form-data with a "file" field. Server-side upload is capped at
// ~4.5MB on Vercel; larger files would need client-direct Blob uploads.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;
  try {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return badRequest('Task not found');

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('No file provided');

    const blob = await put(`tasks/${id}/${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    await prisma.attachment.create({
      data: {
        taskId: id,
        fileName: file.name,
        url: blob.url,
        pathname: blob.pathname,
        size: file.size,
        contentType: file.type || null,
      },
    });
    await logActivity(id, ActivityType.ATTACHMENT_ADDED, `Attached "${file.name}"`);

    const full = await prisma.task.findUnique({ where: { id }, include: TASK_DETAIL_INCLUDE });
    return json(serializeTask(full!), { status: 201 });
  } catch (e) {
    console.error('POST /api/tasks/[id]/attachments', e);
    return serverError('Upload failed — is BLOB_READ_WRITE_TOKEN set?');
  }
}
