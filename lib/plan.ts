export type Status =
  | "normalna"
  | "odwolana"
  | "zastepstwo"
  | "przesunieta"
  | "dodatkowa";

export const STATUSY: { wartosc: Status; etykieta: string }[] = [
  { wartosc: "normalna", etykieta: "Normalna" },
  { wartosc: "odwolana", etykieta: "Odwołana" },
  { wartosc: "zastepstwo", etykieta: "Zastępstwo" },
  { wartosc: "przesunieta", etykieta: "Przesunięta" },
  { wartosc: "dodatkowa", etykieta: "Dodatkowa" },
];

export type Przedmiot = { id: string; nazwa: string; kolor: string };

/** Wiersz z bazy (czasy jako "HH:MM:SS"). */
export type WierszBloku = {
  id: string;
  dzien: number;
  godz_start: string;
  godz_koniec: string;
  przedmiot_id: string | null;
  sala: string | null;
  nauczyciel: string | null;
  nr_lekcji: number | null;
  status?: Status;
  uwagi?: string | null;
};

/** Blok w pamięci aplikacji (czasy jako minuty od północy). */
export type Blok = {
  id: string;
  dzien: number;
  start: number;
  koniec: number;
  przedmiot_id: string | null;
  sala: string;
  nauczyciel: string;
  nr_lekcji: number | null;
  status: Status;
  uwagi: string;
};

export const KOLUMNY_SZABLONU =
  "id, dzien, godz_start, godz_koniec, przedmiot_id, sala, nauczyciel, nr_lekcji";
export const KOLUMNY_TYGODNIA = `${KOLUMNY_SZABLONU}, status, uwagi`;

export const DNI = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
];
export const DNI_KROTKO = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

export const KOLORY = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export function naMinuty(czas: string): number {
  const [g, m] = czas.split(":");
  return Number(g) * 60 + Number(m);
}

export function naCzas(minuty: number): string {
  const g = Math.floor(minuty / 60);
  const m = minuty % 60;
  return `${String(g).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function zWiersza(w: WierszBloku): Blok {
  return {
    id: w.id,
    dzien: w.dzien,
    start: naMinuty(w.godz_start),
    koniec: naMinuty(w.godz_koniec),
    przedmiot_id: w.przedmiot_id,
    sala: w.sala ?? "",
    nauczyciel: w.nauczyciel ?? "",
    nr_lekcji: w.nr_lekcji,
    status: w.status ?? "normalna",
    uwagi: w.uwagi ?? "",
  };
}

/** Dojazd pokazywany na planerze (tylko do odczytu). */
export type DojazdNaPlanie = {
  id: string;
  rodzaj: "autobus" | "samochod";
  kierunek: "odjazd" | "przyjazd";
  tytul: string;
  dzien: number;
  start: number;
  koniec: number;
  odwolany: boolean;
};
