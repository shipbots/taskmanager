import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/** True when a valid session exists. Use at the top of every route handler. */
export async function isAuthed(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
export function notFound(error = 'Not found') {
  return NextResponse.json({ error }, { status: 404 });
}
export function serverError(error = 'Server error') {
  return NextResponse.json({ error }, { status: 500 });
}
