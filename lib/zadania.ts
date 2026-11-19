export type Typ = "zwykle" | "sprawdzian" | "kartkowka";
export type Kategoria = "lekcje" | "do_szkoly" | "platnosc" | "transport" | "inne";
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
};

export type Podzadanie = {
  id: string;
  zadanie_id: string;
  tresc: string;
  kolejnosc: number;
  wykonane: boolean;
};

export const KOLUMNY_ZADAN =
  "id, tytul, typ, termin, przedmiot, kategoria, wykonawca, opis, status";
export const KOLUMNY_PODZADAN = "id, zadanie_id, tresc, kolejnosc, wykonane";

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
