/**
 * Curated time zones for the picker (research.md R6). Hermes does not document
 * `Intl.supportedValuesOf`, so the app does not build the list at runtime. IDs are the ones
 * Node's ICU reports as canonical, which is what the API accepts.
 */
export interface TimeZoneOption {
  id: string;
  label: string;
}

export const TIME_ZONES: readonly TimeZoneOption[] = [
  { id: 'America/Buenos_Aires', label: 'Argentina' },
  { id: 'America/La_Paz', label: 'Bolivia' },
  { id: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { id: 'America/Manaus', label: 'Brasil (Manaos)' },
  { id: 'America/Halifax', label: 'Canadá (Atlántico)' },
  { id: 'America/Toronto', label: 'Canadá (Este)' },
  { id: 'America/Winnipeg', label: 'Canadá (Centro)' },
  { id: 'America/Edmonton', label: 'Canadá (Montaña)' },
  { id: 'America/Vancouver', label: 'Canadá (Pacífico)' },
  { id: 'America/Santiago', label: 'Chile' },
  { id: 'America/Bogota', label: 'Colombia' },
  { id: 'America/Costa_Rica', label: 'Costa Rica' },
  { id: 'America/Havana', label: 'Cuba' },
  { id: 'America/Guayaquil', label: 'Ecuador' },
  { id: 'America/El_Salvador', label: 'El Salvador' },
  { id: 'Europe/Madrid', label: 'España (península y Baleares)' },
  { id: 'Atlantic/Canary', label: 'España (Canarias)' },
  { id: 'America/New_York', label: 'Estados Unidos (Este)' },
  { id: 'America/Chicago', label: 'Estados Unidos (Centro)' },
  { id: 'America/Denver', label: 'Estados Unidos (Montaña)' },
  { id: 'America/Phoenix', label: 'Estados Unidos (Arizona)' },
  { id: 'America/Los_Angeles', label: 'Estados Unidos (Pacífico)' },
  { id: 'America/Anchorage', label: 'Estados Unidos (Alaska)' },
  { id: 'Pacific/Honolulu', label: 'Estados Unidos (Hawái)' },
  { id: 'America/Guatemala', label: 'Guatemala' },
  { id: 'America/Tegucigalpa', label: 'Honduras' },
  { id: 'America/Mexico_City', label: 'México (centro)' },
  { id: 'America/Cancun', label: 'México (Quintana Roo)' },
  { id: 'America/Tijuana', label: 'México (Baja California)' },
  { id: 'America/Managua', label: 'Nicaragua' },
  { id: 'America/Panama', label: 'Panamá' },
  { id: 'America/Asuncion', label: 'Paraguay' },
  { id: 'America/Lima', label: 'Perú' },
  { id: 'America/Puerto_Rico', label: 'Puerto Rico' },
  { id: 'America/Santo_Domingo', label: 'República Dominicana' },
  { id: 'America/Montevideo', label: 'Uruguay' },
  { id: 'America/Caracas', label: 'Venezuela' },
];

/** Label for a stored zone; zones outside the list show their IANA id. */
export function timeZoneLabel(id: string): string {
  return TIME_ZONES.find((zone) => zone.id === id)?.label ?? id;
}

/** Case- and accent-insensitive search over label and id. */
export function filterTimeZones(query: string): readonly TimeZoneOption[] {
  const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = normalize(query.trim());
  if (needle.length === 0) return TIME_ZONES;
  return TIME_ZONES.filter(
    (zone) => normalize(zone.label).includes(needle) || normalize(zone.id).includes(needle),
  );
}
