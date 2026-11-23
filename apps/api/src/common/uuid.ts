const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are checked before querying so a malformed id gives the same 404 as a missing or foreign one
 * instead of a database error (principle III; specs 002 and 003).
 */
export function isUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}
