import { MAX_AMOUNT_COP } from '@corte/domain';

// Decimal style plus a "$" prefix instead of `style: 'currency'`: the currency style adds a
// platform-dependent non-breaking space (research.md R4). Hermes supports Intl.NumberFormat on
// iOS and Android; the formatter is created once.
const copFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Pesos without decimals: 5000000 → "$5.000.000" (FR-024). */
export function formatCop(amount: number): string {
  return `$${copFormat.format(amount)}`;
}

/**
 * Reads an amount typed by the user. Thousands separators ("5.000.000"), spaces and a leading
 * "$" are ignored, so a value formatted on blur can be read back. Returns the integer, or null
 * when the text is empty, has any other character, or is too long to ever be a valid amount.
 */
export function parseAmountInput(text: string): number | null {
  const digits = text.replace(/[\s.$]/g, '');
  if (!/^[0-9]+$/.test(digits)) return null;
  // More digits than the maximum plus one can never be valid; keeps the number a safe integer.
  if (digits.length > String(MAX_AMOUNT_COP).length + 1) return null;
  return Number(digits);
}
