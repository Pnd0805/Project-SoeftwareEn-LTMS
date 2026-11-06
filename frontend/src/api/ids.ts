/**
 * Backend routes accept positive database IDs only. Keep this parser outside
 * the legacy mock bridge so API-backed screens never coerce prototype strings.
 */
export function parseBackendId(value: string | null | undefined): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}
