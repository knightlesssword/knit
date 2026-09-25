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

/** Parse a minutes text field into integer seconds.
 * Accepts whole minutes ("90") or up-to-2-decimal values that resolve to
 * whole seconds via string math ("1.5" -> 90, "0.05" -> 3). No floats.
 * Returns null for blank, negative, garbage, >2 decimals, or values that
 * don't land on whole seconds ("1.01"). Zero parses as 0 — callers that
 * require a positive duration reject it with a field error. */
export function minutesInputToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = Number(match[1]);
  if (!Number.isSafeInteger(whole)) return null;
  let seconds = whole * 60;
  if (!Number.isSafeInteger(seconds)) return null;
  const frac = match[2] ?? "";
  if (frac) {
    const hundredths = Number((frac + "00").slice(0, 2));
    const extra = hundredths * 60;
    if (extra % 100 !== 0) return null;
    seconds += extra / 100;
    if (!Number.isSafeInteger(seconds)) return null;
  }
  return seconds;
}

/** Format integer seconds as a short minutes string for form prefill.
 * Returns the exact value ("1.5" for 90s, "0.05" for 3s) when it fits in
 * whole minutes or up-to-2 decimals, else null — in which case callers
 * prefill secondsToMinutes() and note that saving rounds to whole minutes. */
export function secondsToMinutesInput(totalSeconds: number): string | null {
  if (!Number.isFinite(totalSeconds)) return null;
  const s = Math.floor(totalSeconds);
  if (s < 0 || !Number.isSafeInteger(s)) return null;
  if (s % 60 === 0) return String(s / 60);
  if (s % 3 !== 0) return null;
  const hundredths = (s * 5) / 3;
  if (!Number.isSafeInteger(hundredths)) return null;
  const whole = Math.floor(hundredths / 100);
  const fracText = String(hundredths % 100)
    .padStart(2, "0")
    .replace(/0$/, "");
  return `${whole}.${fracText}`;
}
