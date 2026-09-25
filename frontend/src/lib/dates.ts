/** Calendar-date helpers. Dates are YYYY-MM-DD strings (AGENTS.md section 21).
 * All construction uses local calendar fields — no locale tricks, no timestamps. */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as local-calendar YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a YYYY-MM-DD string into a local-calendar Date. Throws on bad input. */
export function parseISODate(s: string): Date {
  const match = ISO_RE.exec(s);
  if (!match) throw new Error(`bad date: ${s}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new Error(`bad date: ${s}`);
  }
  return d;
}

/** Snap a date back to its Monday (same day when already Monday). */
export function weekStart(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

/** Shift a date by n calendar days (negative allowed). */
export function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

const DAY_LABELS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Short lowercase label like "mon 22" for a YYYY-MM-DD string. */
export function formatDayLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
}
