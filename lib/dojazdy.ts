import { dodajDni, dzienTygodnia } from "@/lib/dates";
import { naMinuty } from "@/lib/plan";

export type Rodzaj = "autobus" | "dowoz" | "odwoz";

export const EMOJI_RODZAJU: Record<Rodzaj, string> = { autobus: "🚌", dowoz: "🛫", odwoz: "🛬" };

export const RODZAJE: { wartosc: Rodzaj; etykieta: string }[] = [
  { wartosc: "autobus", etykieta: "Autobus" },
  { wartosc: "dowoz", etykieta: "Dowóz (zawiezienie)" },
  { wartosc: "odwoz", etykieta: "Odwóz (odebranie)" },
];

export type Dojazd = {
  id: string;
  rodzaj: Rodzaj;
  tytul: string;
  opis: string | null;
  dni: number[];
  godz_start: string;
  godz_koniec: string | null;
  przypisano_id: string | null;
  od: string;
  do_dnia: string | null;
};

export type Wyjatek = {
  id: string;
  dojazd_id: string;
  data: string;
  odwolany: boolean;
  godz_start: string | null;
  godz_koniec: string | null;
};

export const KOLUMNY_DOJAZDOW = "id, rodzaj, tytul, opis, dni, godz_start, godz_koniec, przypisano_id, od, do_dnia";
export const KOLUMNY_WYJATKOW = "id, dojazd_id, data, odwolany, godz_start, godz_koniec";

/** Konkretny dojazd w konkretnym dniu, po uwzględnieniu wyjątków. */
export type Wystapienie = {
  dojazd: Dojazd;
  data: string;
  dzien: number;
  start: number; // minuty od północy
  koniec: number | null;
  odwolany: boolean;
  zmieniony: boolean;
  wyjatek: Wyjatek | null;
};

/** Rozwija stały rozkład na dni z zakresu [od, do] (włącznie). */
export function wystapienia(dojazdy: Dojazd[], wyjatki: Wyjatek[], od: string, do_: string): Wystapienie[] {
  const wyj = new Map(wyjatki.map((w) => [`${w.dojazd_id}|${w.data}`, w]));
  const wynik: Wystapienie[] = [];
  for (let data = od; data <= do_; data = dodajDni(data, 1)) {
    const dzien = dzienTygodnia(data);
    for (const d of dojazdy) {
      if (!d.dni.includes(dzien) || d.od > data || (d.do_dnia && d.do_dnia < data)) continue;
      const w = wyj.get(`${d.id}|${data}`) ?? null;
      const gs = w?.godz_start ?? d.godz_start;
      const gk = w?.godz_start ? w.godz_koniec : (w?.godz_koniec ?? d.godz_koniec);
      wynik.push({
        dojazd: d,
        data,
        dzien,
        start: naMinuty(gs),
        koniec: gk ? naMinuty(gk) : null,
        odwolany: w?.odwolany ?? false,
        zmieniony: !!w && !w.odwolany,
        wyjatek: w,
      });
    }
  }
  return wynik.sort((a, b) => a.data.localeCompare(b.data) || a.start - b.start);
}

/** Czas trwania bloku na planerze: bez godziny końca przyjmujemy 30 minut. */
export const koniecNaPlanie = (w: Wystapienie) => w.koniec ?? w.start + 30;
