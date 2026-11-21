import { daysFromToday, formatMinutes, fromLocalInput, relativeDay, splitTags, toLocalInput } from './format';

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d; };

describe('format helpers', () => {
  it('formats minutes as human durations', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(205)).toBe('3h 25m');
  });

  it('describes relative days', () => {
    expect(relativeDay(inDays(0))).toBe('Today');
    expect(relativeDay(inDays(1))).toBe('Tomorrow');
    expect(relativeDay(inDays(-1))).toBe('Yesterday');
    expect(relativeDay(inDays(4))).toBe('In 4 days');
    expect(relativeDay(inDays(-3))).toBe('3 days ago');
    expect(daysFromToday(inDays(10))).toBe(10);
  });

  it('round-trips datetime-local values', () => {
    const iso = new Date(2026, 10, 21, 18, 30).toISOString();
    const local = toLocalInput(iso);
    expect(local).toBe('2026-11-21T18:30');
    expect(fromLocalInput(local)).toBe(iso);
    expect(fromLocalInput('')).toBeNull();
  });

  it('splits comma separated tags', () => {
    expect(splitTags(' exam, reading ,,dsa ')).toEqual(['exam', 'reading', 'dsa']);
    expect(splitTags(null)).toEqual([]);
  });
});
