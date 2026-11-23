/**
 * Annual effective rate typed and shown in Spanish (spec 003 FR-006, FR-028): the user may type a
 * comma or a point ("26,82" or "26.82") and the app shows "26,82% EA".
 */

/** Empty → null (no rate); a number with comma or point → that number; anything else → NaN. */
export function parseRateInput(text: string): number | null {
  const trimmed = text.trim().replace(/\s*%$/, '');
  if (trimmed === '') return null;
  if (!/^[0-9]{1,3}([.,][0-9]+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(',', '.'));
}

/** 26.82 → "26,82"; 24 → "24". Up to 2 decimals, comma as the decimal separator. */
export function formatRateNumber(rate: number): string {
  return String(Math.round(rate * 100) / 100).replace('.', ',');
}

/** 26.82 → "26,82% EA". */
export function formatRate(rate: number): string {
  return `${formatRateNumber(rate)}% EA`;
}
