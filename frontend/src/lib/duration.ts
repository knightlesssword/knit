/** Duration helpers. Durations are plain integer seconds (AGENTS.md section 19).
 * Integer math only — no floats, no Date objects. */

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Parse an estimate-minutes field value into integer seconds. Null when invalid. */
export function minutesToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const seconds = Number(trimmed) * 60;
  if (!Number.isSafeInteger(seconds)) return null;
  return seconds;
}

/** Prefill helper: whole minutes contained in an integer-second duration. */
export function secondsToMinutes(totalSeconds: number): number {
  return Math.floor(Math.max(0, Math.floor(totalSeconds)) / 60);
}
