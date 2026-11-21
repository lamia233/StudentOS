import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type NotionObject = Record<string, any>;

/** Minimal Notion REST client (https://developers.notion.com/reference). Server-side only. */
export class NotionClient {
  constructor(private token: string) {}

  async request<T = NotionObject>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${config.notion.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': config.notion.version,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as NotionObject;
    if (!res.ok) {
      const msg = data?.message ?? `Notion API error (${res.status})`;
      throw new HttpError(res.status === 401 ? 400 : 502, `Notion: ${msg}`);
    }
    return data as T;
  }

  me() {
    return this.request('GET', '/users/me');
  }
  getDatabase(id: string) {
    return this.request('GET', `/databases/${id}`);
  }
  getPage(id: string) {
    return this.request('GET', `/pages/${id}`);
  }
  queryDatabase(id: string, pageSize = 50) {
    return this.request<{ results: NotionObject[] }>('POST', `/databases/${id}/query`, { page_size: pageSize });
  }
  createPage(body: NotionObject) {
    return this.request('POST', '/pages', body);
  }
  updatePage(id: string, body: NotionObject) {
    return this.request('PATCH', `/pages/${id}`, body);
  }
  getBlockChildren(id: string) {
    return this.request<{ results: NotionObject[] }>('GET', `/blocks/${id}/children?page_size=100`);
  }
}

/** Accepts a raw ID, a dashed UUID or a full Notion URL and returns the 32-char ID. */
export function normalizeNotionId(input: string): string | null {
  const cleaned = input.trim().replace(/-/g, '');
  const match = cleaned.match(/([0-9a-f]{32})(?:\?|$|#)/i) ?? cleaned.match(/([0-9a-f]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

/** Notion caps each text object at 2000 characters, so long content is split across several. */
export const richText = (content: string) => {
  const chunks = content.match(/[\s\S]{1,1900}/g) ?? [''];
  return chunks.slice(0, 100).map((c) => ({ type: 'text', text: { content: c } }));
};

export const plain = (rt: NotionObject[] | undefined) => (rt ?? []).map((t) => t.plain_text ?? t.text?.content ?? '').join('');

export function titleOf(obj: NotionObject): string {
  if (obj.object === 'database') return plain(obj.title) || 'Untitled database';
  const props = obj.properties ?? {};
  for (const key of Object.keys(props)) {
    if (props[key]?.type === 'title') return plain(props[key].title) || 'Untitled';
  }
  return 'Untitled';
}

const TEXT_BLOCKS = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'callout', 'code', 'toggle'];

export function blocksToText(blocks: NotionObject[]): string {
  return blocks
    .filter((b) => TEXT_BLOCKS.includes(b.type))
    .map((b) => {
      const text = plain(b[b.type]?.rich_text);
      if (b.type.startsWith('heading')) return `## ${text}`;
      if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item') return `- ${text}`;
      if (b.type === 'to_do') return `${b.to_do?.checked ? '[x]' : '[ ]'} ${text}`;
      return text;
    })
    .join('\n');
}
