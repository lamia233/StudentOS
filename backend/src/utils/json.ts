export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const splitTags = (s: string | null | undefined) =>
  (s ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
