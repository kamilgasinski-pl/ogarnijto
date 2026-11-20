import { dodajDni, dzienTygodnia } from "@/lib/dates";

export type Typ = "zwykle" | "sprawdzian" | "kartkowka";
export type Kategoria = "lekcje" | "do_szkoly" | "platnosc" | "transport" | "inne" | "zakupy";
export type Wykonawca = "dziecko" | "rodzic" | "oba";
export type StatusZadania = "do_zrobienia" | "zrobione";

export type Zadanie = {
  id: string;
  tytul: string;
  typ: Typ;
  termin: string;
  przedmiot: string | null;
  kategoria: Kategoria;
  wykonawca: Wykonawca;
  opis: string | null;
  status: StatusZadania;
  godz_start: string | null; // "HH:MM:SS"
  godz_koniec: string | null;
  przypisano_id: string | null;
  powtarzalne_id: string | null;
  na_dzien: string | null; // kiedy zrobić (przed terminem); puste = domyślnie
};

export type OsobaMini = { id: string; imie: string; rola: "uczen" | "rodzic" };

export type Podzadanie = {
  id: string;
  zadanie_id: string;
  tresc: string;
  kolejnosc: number;
  wykonane: boolean;
  ilosc: string | null; // zakupy: np. "2 l"
  dodal: string | null; // zakupy: kto dopisał pozycję
};

export const KOLUMNY_ZADAN =
  "id, tytul, typ, termin, przedmiot, kategoria, wykonawca, opis, status, godz_start, godz_koniec, przypisano_id, powtarzalne_id, na_dzien";
export const KOLUMNY_PODZADAN = "id, zadanie_id, tresc, kolejnosc, wykonane, ilosc, dodal";

export const TYPY: { wartosc: Typ; etykieta: string }[] = [
  { wartosc: "zwykle", etykieta: "Zwykłe zadanie" },
  { wartosc: "sprawdzian", etykieta: "Sprawdzian" },
  { wartosc: "kartkowka", etykieta: "Kartkówka" },
];

export const KATEGORIE: { wartosc: Kategoria; etykieta: string }[] = [
  { wartosc: "lekcje", etykieta: "Lekcje" },
  { wartosc: "do_szkoly", etykieta: "Do szkoły" },
  { wartosc: "platnosc", etykieta: "Płatność" },
  { wartosc: "transport", etykieta: "Odwiezienie" },
  { wartosc: "zakupy", etykieta: "Zakupy" },
  { wartosc: "inne", etykieta: "Inne" },
];

export const WYKONAWCY: { wartosc: Wykonawca; etykieta: string }[] = [
  { wartosc: "dziecko", etykieta: "Dziecko" },
  { wartosc: "rodzic", etykieta: "Rodzic" },
  { wartosc: "oba", etykieta: "Oboje" },
];

/**
 * Zaległe: niewykonane zadanie ze starym terminem. Sprawdziany i kartkówki
 * po terminie uznajemy za zamknięte (nie wiszą w zaległych).
 */
export function jestZalegle(z: Zadanie, dzis: string): boolean {
  return z.status === "do_zrobienia" && z.termin < dzis && z.typ === "zwykle";
}

/** "15:30:00" -> "15:30" */
export const krotkaGodzina = (g: string | null) => (g ? g.slice(0, 5) : null);

/** Wartość listy wyboru osoby: id osoby albo "oba". */
export function wartoscOsoby(z: Pick<Zadanie, "przypisano_id" | "wykonawca">): string {
  return z.przypisano_id ?? "oba";
}

/** Pola wykonawcy zapisywane do bazy dla wybranej wartości listy. */
export function polaWykonawcy(
  wartosc: string,
  osoby: OsobaMini[],
): { przypisano_id: string | null; wykonawca: Wykonawca } {
  const o = osoby.find((x) => x.id === wartosc);
  if (!o) return { przypisano_id: null, wykonawca: "oba" };
  return { przypisano_id: o.id, wykonawca: o.rola === "rodzic" ? "rodzic" : "dziecko" };
}

export function nazwaWykonawcy(
  z: Pick<Zadanie, "przypisano_id" | "wykonawca">,
  osoby: OsobaMini[],
): string {
  const o = osoby.find((x) => x.id === z.przypisano_id);
  if (o) return o.imie;
  return WYKONAWCY.find((w) => w.wartosc === z.wykonawca)?.etykieta ?? "";
}

/** Reguła zadania powtarzalnego (tabela zadania_powtarzalne). */
export type Regula = {
  id: string;
  tytul: string;
  opis: string | null;
  kategoria: Kategoria;
  wykonawca: Wykonawca;
  przypisano_id: string | null;
  dni: number[];
  godz_start: string | null;
  godz_koniec: string | null;
  od: string;
  do_dnia: string | null;
};

export const KOLUMNY_REGUL =
  "id, tytul, opis, kategoria, wykonawca, przypisano_id, dni, godz_start, godz_koniec, od, do_dnia";

export const DNI_KROTKO = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const DNI_BIERNIK = ["poniedziałek", "wtorek", "środę", "czwartek", "piątek", "sobotę", "niedzielę"];

/** "Co środę" albo "Pn, Śr, Pt". */
export function opisDni(dni: number[]): string {
  const d = [...dni].sort((a, b) => a - b);
  if (d.length === 1) return `Co ${DNI_BIERNIK[d[0] - 1]}`;
  if (d.length === 5 && d.every((x, i) => x === i + 1)) return "Codziennie w dni szkolne";
  if (d.length === 7) return "Codziennie";
  return d.map((x) => DNI_KROTKO[x - 1]).join(", ");
}

/**
 * Czy zadanie jest "moje": przypisane do mnie, a bez przypisania do osoby
 * decyduje pole wykonawcy ("oboje" dotyczy każdego).
 */
export function jestMoje(
  z: Pick<Zadanie, "przypisano_id" | "wykonawca"> & { kategoria?: Kategoria },
  mojeId: string,
  rola: "uczen" | "rodzic",
): boolean {
  if (z.kategoria === "zakupy") return true; // lista zakupów jest wspólna: widzi ją cała rodzina
  if (z.przypisano_id) return z.przypisano_id === mojeId;
  if (z.wykonawca === "oba") return true;
  return z.wykonawca === (rola === "rodzic" ? "rodzic" : "dziecko");
}

/** Stałe kolory członków rodziny (wg kolejności na liście osób), by odróżnić ich zadania przy filtrze „Wszystkie”. */
export const KOLORY_OSOB = ["#2563eb", "#db2777", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
export function kolorOsoby(id: string | null, osoby: OsobaMini[]): string | null {
  const i = osoby.findIndex((o) => o.id === id);
  return i < 0 ? null : KOLORY_OSOB[i % KOLORY_OSOB.length];
}

/**
 * Dzień, od którego zadanie ma się pojawiać do zrobienia: wybrany ręcznie ("zrobię w sobotę")
 * albo domyślnie dzień wcześniej dla terminu w poniedziałek (weekend też bywa dniem nauki).
 */
export function dzienRobienia(z: Pick<Zadanie, "termin" | "na_dzien" | "typ">): string {
  if (z.na_dzien && z.na_dzien <= z.termin) return z.na_dzien;
  if (z.typ === "zwykle" && dzienTygodnia(z.termin) === 1) return dodajDni(z.termin, -1);
  return z.termin;
}

/** Dzień, w którym zadanie widać na liście: nie wcześniej niż dziś. */
export const dzienWidoku = (z: Pick<Zadanie, "termin" | "na_dzien" | "typ">, dzis: string) => {
  const d = dzienRobienia(z);
  return d < dzis ? dzis : d;
};
