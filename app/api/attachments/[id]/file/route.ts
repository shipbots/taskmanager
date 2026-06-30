import { isAuthed, unauthorized, notFound, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { get } from '@vercel/blob';

export const dynamic = 'force-dynamic';

// Stream a private attachment back to the logged-in user. The Blob store is
// private, so files are never exposed via a public URL — only through here,
// behind the auth gate. Add ?download=1 to force a download instead of inline.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return unauthorized();
  const { id } = await params;

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return notFound('Attachment not found');

  try {
    const result = await get(att.pathname, { access: 'private' });
    if (!result || !result.stream) return serverError('Could not load the file.');

    const download = new URL(request.url).searchParams.get('download');
    const safeName = att.fileName.replace(/[\r\n"]/g, '_');

    const headers = new Headers();
    headers.set('Content-Type', att.contentType || 'application/octet-stream');
    if (att.size) headers.set('Content-Length', String(att.size));
    headers.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
    );
    headers.set('Cache-Control', 'private, max-age=0, must-revalidate');

    return new Response(result.stream, { headers });
  } catch (e) {
    console.error('GET /api/attachments/[id]/file', e);
    return serverError('Could not load the file.');
  }
}
