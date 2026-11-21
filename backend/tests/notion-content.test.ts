import { describe, expect, it } from 'vitest';
import { buildChildren } from '../src/services/notion.js';
import { blocksToText } from '../src/services/notionClient.js';

describe('notion export content', () => {
  it('keeps long notes intact within Notion request limits', () => {
    const lines = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}`);
    const body = ['x'.repeat(5000), ...lines].join('\n');
    const blocks = buildChildren({ type: 'notes', id: 'n1', title: 'Long note', kindLabel: 'Note', body, todos: ['[x] done', '[ ] todo'] });
    expect(blocks.length).toBeLessThanOrEqual(100);
    for (const b of blocks) for (const t of b[b.type].rich_text) expect(t.text.content.length).toBeLessThanOrEqual(2000);
    const roundTrip = blocksToText(blocks.slice(0, -1).map((b) => ({ ...b, [b.type]: { ...b[b.type], rich_text: b[b.type].rich_text.map((t: { text: { content: string } }) => ({ plain_text: t.text.content })) } })));
    expect(roundTrip).toBe(`${body}\n[x] done\n[ ] todo`);
  });
});
