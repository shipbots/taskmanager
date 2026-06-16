// Direct Monday.com client for the ShipBots integration — read onboarding
// subitems + the Clients board, and write task edits back. Ported from the
// Onboarding Dashboard's lib/monday.ts so the mutation format matches exactly.
// Server-only (uses MONDAY_API_KEY).

const MONDAY_API_URL = 'https://api.monday.com/v2';
export const ONBOARDING_BOARD_ID = '6004116565';
export const CLIENTS_BOARD_ID = '7846251224';

export interface MondaySubItem {
  id: string;
  name: string;
  status: string;
  assignee: string;
  assigneeEmails: string[];
  dueDate: string; // YYYY-MM-DD or ''
  parentItemId: string;
  parentItemName: string;
}

export interface SubitemBoardInfo {
  boardId: string | null;
  statusColumnId: string | null;
  statusOptions: string[];
  dateColumnId: string | null;
  assigneeColumnId: string | null;
  assigneeOptions: string[];
}

function getApiKey(): string {
  const key = process.env.MONDAY_API_KEY;
  if (!key) throw new Error('MONDAY_API_KEY not set');
  return key;
}

export function hasMondayKey(): boolean {
  return !!process.env.MONDAY_API_KEY;
}

async function mondayQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getApiKey(),
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (data.errors) {
    console.error('Monday API error:', data.errors);
    throw new Error(data.errors[0]?.message || 'Monday API error');
  }
  return data.data;
}

function parseAssigneeEmails(cv: { type: string; text: string | null }): string[] {
  if (cv.type !== 'dropdown' || !cv.text) return [];
  return cv.text
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Discover the subitem board's status/date/assignee columns + status options. */
export async function fetchSubitemBoardInfo(): Promise<SubitemBoardInfo> {
  const query = `query {
    boards(ids: [${ONBOARDING_BOARD_ID}]) {
      items_page(limit: 50) {
        items { subitems { board { id columns { id title type settings_str } } } }
      }
    }
  }`;
  const data = await mondayQuery(query);
  const pageItems: {
    subitems?: { board: { id: string; columns: { id: string; title: string; type: string; settings_str: string }[] } }[];
  }[] = data.boards[0].items_page.items;

  for (const item of pageItems) {
    if (!item.subitems?.length) continue;
    const { id: boardId, columns: cols } = item.subitems[0].board;
    let statusColumnId: string | null = null;
    let statusOptions: string[] = [];
    let dateColumnId: string | null = null;
    let assigneeColumnId: string | null = null;
    let assigneeOptions: string[] = [];

    for (const col of cols) {
      if ((col.type === 'color' || col.type === 'status') && !statusColumnId) {
        statusColumnId = col.id;
        try {
          const labels: Record<string, string> = JSON.parse(col.settings_str).labels || {};
          statusOptions = Object.values(labels).filter(Boolean) as string[];
        } catch {
          /* ignore */
        }
      }
      if (col.type === 'date' && !dateColumnId) dateColumnId = col.id;
      if (col.type === 'dropdown') {
        const t = col.title.toLowerCase();
        if (t.includes('assign') || t.includes('owner') || !assigneeColumnId) {
          assigneeColumnId = col.id;
          try {
            const labels: Array<{ name?: string }> = JSON.parse(col.settings_str).labels || [];
            assigneeOptions = labels.map((l) => (l?.name ?? '').trim().toLowerCase()).filter(Boolean);
          } catch {
            /* ignore */
          }
        }
      }
    }
    return { boardId, statusColumnId, statusOptions, dateColumnId, assigneeColumnId, assigneeOptions };
  }
  return {
    boardId: null,
    statusColumnId: null,
    statusOptions: [],
    dateColumnId: null,
    assigneeColumnId: null,
    assigneeOptions: [],
  };
}

/** All onboarding subitems (paginated) with status, assignee emails, due date. */
export async function fetchAllSubitems(): Promise<MondaySubItem[]> {
  const all: MondaySubItem[] = [];
  let cursor: string | null = null;

  do {
    const query: string = cursor
      ? `query ($cursor: String!) {
          next_items_page(cursor: $cursor, limit: 100) {
            cursor
            items { id name subitems { id name column_values { id text value type } } }
          }
        }`
      : `query {
          boards(ids: [${ONBOARDING_BOARD_ID}]) {
            items_page(limit: 100) {
              cursor
              items { id name subitems { id name column_values { id text value type } } }
            }
          }
        }`;
    const data = await mondayQuery(query, cursor ? { cursor } : undefined);
    type SubRaw = { id: string; name: string; column_values: { id: string; text: string | null; value: string | null; type: string }[] };
    type ParentRaw = { id: string; name: string; subitems: SubRaw[] };
    const page: { cursor: string | null; items: ParentRaw[] } = cursor
      ? data.next_items_page
      : data.boards[0].items_page;

    for (const parent of page.items) {
      for (const sub of parent.subitems ?? []) {
        let status = '';
        let assignee = '';
        let assigneeEmails: string[] = [];
        let dueDate = '';
        for (const cv of sub.column_values) {
          if ((cv.type === 'color' || cv.type === 'status') && !status && cv.text) status = cv.text;
          if ((cv.type === 'multiple-person' || cv.type === 'people' || cv.id === 'person') && !assignee && cv.text)
            assignee = cv.text;
          if (cv.type === 'dropdown') {
            assigneeEmails = parseAssigneeEmails(cv);
            if (!assignee && cv.text) assignee = cv.text;
          }
          if ((cv.type === 'date' || cv.id.startsWith('date')) && !dueDate && cv.value) {
            try {
              dueDate = JSON.parse(cv.value).date || '';
            } catch {
              /* ignore */
            }
          }
        }
        all.push({
          id: sub.id,
          name: sub.name,
          status,
          assignee,
          assigneeEmails,
          dueDate,
          parentItemId: parent.id,
          parentItemName: parent.name,
        });
      }
    }
    cursor = page.cursor;
  } while (cursor);

  return all;
}

/** Clients board items (id + name) — the ShipBots master client list. */
export async function fetchClientsList(): Promise<{ id: string; name: string }[]> {
  const all: { id: string; name: string }[] = [];
  let cursor: string | null = null;
  do {
    const query: string = cursor
      ? `query ($cursor: String!) { next_items_page(cursor: $cursor, limit: 200) { cursor items { id name } } }`
      : `query { boards(ids: [${CLIENTS_BOARD_ID}]) { items_page(limit: 200) { cursor items { id name } } } }`;
    const data = await mondayQuery(query, cursor ? { cursor } : undefined);
    const page: { cursor: string | null; items: { id: string; name: string }[] } = cursor
      ? data.next_items_page
      : data.boards[0].items_page;
    for (const it of page.items) all.push({ id: it.id, name: (it.name ?? '').trim() });
    cursor = page.cursor;
  } while (cursor);
  return all.filter((c) => c.name);
}

/** Write a subitem edit back to Monday (name / status / due date). */
export async function updateSubitem(
  subitemId: string,
  boardId: string,
  opts: {
    name?: string;
    statusColumnId?: string | null;
    status?: string;
    dateColumnId?: string | null;
    dueDate?: string;
  },
): Promise<void> {
  if (opts.name?.trim()) {
    const safeName = opts.name.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await mondayQuery(
      `mutation { change_item_name(board_id: ${boardId}, item_id: ${subitemId}, value: "${safeName}") { id } }`,
    );
  }
  const colObj: Record<string, unknown> = {};
  if (opts.statusColumnId) colObj[opts.statusColumnId] = opts.status ? { label: opts.status } : '';
  if (opts.dateColumnId) colObj[opts.dateColumnId] = opts.dueDate ? { date: opts.dueDate } : '';
  if (Object.keys(colObj).length) {
    const colValuesStr = JSON.stringify(JSON.stringify(colObj));
    await mondayQuery(
      `mutation { change_multiple_column_values(board_id: ${boardId}, item_id: ${subitemId}, column_values: ${colValuesStr}, create_labels_if_missing: true) { id } }`,
    );
  }
}
