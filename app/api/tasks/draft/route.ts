import Anthropic from '@anthropic-ai/sdk';
import { isAuthed, unauthorized, json, badRequest, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const TASK_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: 'Short imperative task title' },
    dueDate: {
      type: 'string',
      description: 'Due date as YYYY-MM-DD, or an empty string if no date is mentioned',
    },
    client: { type: 'string', description: 'Client/company name if mentioned, else empty string' },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    description: { type: 'string', description: 'Any remaining detail, else empty string' },
  },
  required: ['name', 'dueDate', 'client', 'priority', 'description'],
};

// POST { notes } — turn freeform notes into a structured task draft via Claude.
export async function POST(request: Request) {
  if (!(await isAuthed())) return unauthorized();

  const apiKey = process.env.SHIPBOTS_ANTHROPIC_KEY;
  if (!apiKey) return badRequest('Smart notes is not configured (missing SHIPBOTS_ANTHROPIC_KEY).');

  try {
    const notes = String((await request.json()).notes ?? '').trim();
    if (!notes) return badRequest('Notes are required');

    const anthropic = new Anthropic({ apiKey });
    const today = new Date().toISOString().slice(0, 10);

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system:
        `Convert the user's freeform notes into a single structured task. Today's date is ${today}. ` +
        'Resolve relative dates ("tomorrow", "next Tuesday", "in 3 days", "end of month") to an absolute YYYY-MM-DD; ' +
        'if no due date is mentioned, return an empty string. Write a concise imperative task name. ' +
        'Extract the client or company name if present, otherwise an empty string. ' +
        'Choose priority from urgency cues (urgent/asap → URGENT, important/soon → HIGH, default MEDIUM, someday → LOW). ' +
        'Put any remaining useful detail in description.',
      tools: [
        {
          name: 'create_task',
          description: 'Record the structured task extracted from the notes.',
          input_schema: TASK_SCHEMA,
          strict: true,
        },
      ],
      tool_choice: { type: 'tool', name: 'create_task' },
      messages: [{ role: 'user', content: notes }],
    });

    const block = message.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return serverError('No draft produced');
    return json(block.input);
  } catch (e) {
    console.error('POST /api/tasks/draft', e);
    return serverError('Could not draft a task from those notes.');
  }
}
