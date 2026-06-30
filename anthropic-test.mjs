import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.SHIPBOTS_ANTHROPIC_KEY });
const today = new Date().toISOString().slice(0, 10);
const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    dueDate: { type: 'string' },
    client: { type: 'string' },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    description: { type: 'string' },
  },
  required: ['name', 'dueDate', 'client', 'priority', 'description'],
};
try {
  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    system: `Convert notes into a task. Today is ${today}. Resolve relative dates to YYYY-MM-DD.`,
    tools: [{ name: 'create_task', description: 'Record the task.', input_schema: schema, strict: true }],
    tool_choice: { type: 'tool', name: 'create_task' },
    messages: [{ role: 'user', content: 'Call Acme about the renewal next Tuesday, high priority' }],
  });
  const b = msg.content.find((x) => x.type === 'tool_use');
  console.log('model:', msg.model);
  console.log('draft:', JSON.stringify(b?.input));
  console.log('ANTHROPIC_OK');
} catch (e) {
  console.error('ANTHROPIC_FAIL', e.status || '', e.message);
  process.exitCode = 1;
}
