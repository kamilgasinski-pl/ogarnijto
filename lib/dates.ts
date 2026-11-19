// Daty w aplikacji to napisy "YYYY-MM-DD" liczone w strefie Europe/Warsaw,
// niezależnie od strefy serwera (Vercel działa w UTC).

const STREFA = "Europe/Warsaw";
const DZIEN_MS = 86_400_000;

function naUTC(iso: string): number {
  const [r, m, d] = iso.split("-").map(Number);
  return Date.UTC(r, m - 1, d);
}

function zUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Dzisiejsza data w Polsce, np. "2026-11-19". */
export function dzisiaj(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STREFA }).format(
    new Date(),
  );
}

export function dodajDni(iso: string, dni: number): string {
  return zUTC(naUTC(iso) + dni * DZIEN_MS);
}

/** 1 = poniedziałek ... 7 = niedziela. */
export function dzienTygodnia(iso: string): number {
  const d = new Date(naUTC(iso)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Poniedziałek tygodnia, w którym leży data. */
export function poniedzialek(iso: string): string {
  return dodajDni(iso, 1 - dzienTygodnia(iso));
}

/** Numer tygodnia ISO 8601 oraz zakres dat (poniedziałek-niedziela). */
export function tydzienISO(iso: string): {
  numer: number;
  rok: number;
  start: string;
  koniec: string;
} {
  const start = poniedzialek(iso);
  // Czwartek tego tygodnia wyznacza rok ISO.
  const czwartek = dodajDni(start, 3);
  const rok = Number(czwartek.slice(0, 4));
  const pierwszyStycznia = `${rok}-01-01`;
  const poniedzialekTygodnia1 = poniedzialek(
    dzienTygodnia(pierwszyStycznia) <= 4
      ? pierwszyStycznia
      : dodajDni(pierwszyStycznia, 7),
  );
  const numer =
    Math.round((naUTC(start) - naUTC(poniedzialekTygodnia1)) / (7 * DZIEN_MS)) +
    1;
  return { numer, rok, start, koniec: dodajDni(start, 6) };
}

/** "16.11" z "2026-11-16". */
export function dzienMiesiac(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

const DNI = [
  "niedziela",
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
];
const MIESIACE = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

/** "czwartek, 19 listopada 2026". */
export function dataSlownie(iso: string): string {
  const dt = new Date(naUTC(iso));
  return `${DNI[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MIESIACE[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/**
 * Dzień, który pokazuje kafelek "Jutro": następny dzień kalendarzowy,
 * a w piątek, sobotę i niedzielę poniedziałek.
 */
export function jutroDlaWidoku(dzisiajIso: string): string {
  const d = dzienTygodnia(dzisiajIso);
  if (d >= 5) return dodajDni(dzisiajIso, 8 - d);
  return dodajDni(dzisiajIso, 1);
}

const DNI_WIELKIE = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
];

/** "Dziś", "Jutro" albo "Poniedziałek 23.11". */
export function etykietaDnia(iso: string, dzisiajIso: string): string {
  if (iso === dzisiajIso) return "Dziś";
  if (iso === dodajDni(dzisiajIso, 1)) return "Jutro";
  return `${DNI_WIELKIE[dzienTygodnia(iso) - 1]} ${dzienMiesiac(iso)}`;
}
