import { dodajDni, dzienTygodnia } from "@/lib/dates";
import { naMinuty } from "@/lib/plan";

export type Rodzaj = "autobus" | "samochod";
export type Kierunek = "odjazd" | "przyjazd";

export const EMOJI_DOJAZDU = (r: Rodzaj, k: Kierunek) => `${r === "autobus" ? "🚌" : "🚗"}${k === "odjazd" ? "↗" : "↙"}`;

/** Kolory dojazdów: odjazdy pomarańczowe, przyjazdy niebieskie (pełne nazwy klas, żeby Tailwind je wykrył). */
export const STYL_KIERUNKU: Record<
  Kierunek,
  { pulpit: string; lista: string; planer: string; druk: string; czas: string; ikona: string; hover: string }
> = {
  odjazd: {
    pulpit: "border-orange-300 bg-orange-50",
    lista: "border-orange-400 bg-orange-50 text-orange-950",
    planer: "border-orange-500 bg-orange-100 text-orange-950",
    druk: "border-orange-500 bg-orange-50 text-orange-900",
    czas: "text-orange-800",
    ikona: "text-orange-700",
    hover: "hover:bg-orange-100",
  },
  przyjazd: {
    pulpit: "border-sky-300 bg-sky-50",
    lista: "border-sky-400 bg-sky-50 text-sky-950",
    planer: "border-sky-500 bg-sky-100 text-sky-950",
    druk: "border-sky-500 bg-sky-50 text-sky-900",
    czas: "text-sky-800",
    ikona: "text-sky-700",
    hover: "hover:bg-sky-100",
  },
};

export const RODZAJE: { wartosc: Rodzaj; etykieta: string }[] = [
  { wartosc: "autobus", etykieta: "Autobus" },
  { wartosc: "samochod", etykieta: "Samochód (rodzic)" },
];

export const KIERUNKI: { wartosc: Kierunek; etykieta: string }[] = [
  { wartosc: "odjazd", etykieta: "Odjazd / dowóz (wyjeżdża)" },
  { wartosc: "przyjazd", etykieta: "Przyjazd / odbiór (przyjeżdża)" },
];

export type Dojazd = {
  id: string;
  rodzaj: Rodzaj;
  kierunek: Kierunek;
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
  notatka: string | null;
  rodzaj: Rodzaj | null;
  przypisano_id: string | null;
  tytul: string | null;
};

export const KOLUMNY_DOJAZDOW = "id, rodzaj, kierunek, tytul, opis, dni, godz_start, godz_koniec, przypisano_id, od, do_dnia";
export const KOLUMNY_WYJATKOW = "id, dojazd_id, data, odwolany, godz_start, godz_koniec, notatka, rodzaj, przypisano_id, tytul";

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
        // Zmiana jednego dnia może podmienić środek transportu i osobę.
        dojazd: w ? { ...d, rodzaj: w.rodzaj ?? d.rodzaj, przypisano_id: w.przypisano_id ?? d.przypisano_id, tytul: w.tytul ?? d.tytul } : d,
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
