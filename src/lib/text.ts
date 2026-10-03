/** Pure text helpers (no React Native imports, so they run under plain Node tests). */

/** ~3.5-4k tokens of transcript per pass leaves room for instructions and output on an 8k context. */
export const CHUNK_CHARS = 14000;

/** Split on sentence boundaries into chunks a small model can read in one pass. */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  if (text.length <= size) return [text];
  const sentences = (text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [text]).flatMap((s) => {
    // Speech recognition can produce very long unpunctuated runs; hard-split those on spaces.
    const parts: string[] = [];
    let rest = s;
    while (rest.length > size) {
      const cut = rest.lastIndexOf(' ', size);
      const at = cut > size / 2 ? cut : size;
      parts.push(rest.slice(0, at) + ' ');
      rest = rest.slice(at).trimStart();
    }
    if (rest) parts.push(rest);
    return parts;
  });
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length + s.length > size && cur) {
      chunks.push(cur.trim());
      cur = '';
    }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as T;
}

export const uniq = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Parse the model's "YYYY-MM-DD HH:MM" (or date-only) into a timestamp; null if absent/invalid. */
export function parseDue(due: string): number | null {
  const m = due?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(+y, +mo - 1, +d, h ? +h : 9, mi ? +mi : 0);
  return isNaN(date.getTime()) ? null : date.getTime();
}
