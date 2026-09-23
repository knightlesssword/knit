/** Money helpers. Minor units are integers (e.g. 4250 = $42.50).
 * All parsing uses string manipulation only — never float arithmetic. */

export type Currency = "USD" | "GBP" | "INR";

/** Parse a major-unit display string like "42.50" into minor units.
 * Returns null for invalid input. */
export function majorToMinor(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fracRaw = ""] = trimmed.split(".");
  if (whole.length === 0) return null;
  if (whole.length > 12) return null;
  const frac = (fracRaw + "00").slice(0, 2);
  const minor = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  return minor;
}

/** Format minor units back to a major-unit display string like "42.50". */
export function minorToMajor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

const LOCALES: Record<Currency, string> = {
  USD: "en-US",
  GBP: "en-GB",
  INR: "en-IN",
};

/** Locale-aware formatting via Intl. No hardcoded currency symbols. */
export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
  }).format(minor / 100);
}
