import type { Typ } from "./zadania";

// Parser wpisów skopiowanych z kalendarza Librusa (tekst wklejony lub
// rozpoznany ze zrzutu ekranu). Działa lokalnie, na regułach, bez AI.

export type Wpis = {
  typ: Typ;
  przedmiot: string | null;
  termin: string | null; // YYYY-MM-DD
  nr_lekcji: number | null;
  nauczyciel: string | null;
  opis: string;
  podzadania: string[];
  tytul: string;
  surowy: string;
};

const MIESIACE: Record<string, number> = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, wrzesnia: 9, września: 9, pazdziernika: 10,
  października: 10, listopada: 11, grudnia: 12,
};

const dwie = (n: number) => String(n).padStart(2, "0");

function poprawnaData(r: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(r, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${r}-${dwie(m)}-${dwie(d)}`;
}

function dniMiedzy(a: string, b: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** Rok dla daty podanej bez roku: najbliższa pasująca data, nie starsza niż pół roku. */
function zRokiem(m: number, d: number, dzis: string): string | null {
  const rok = Number(dzis.slice(0, 4));
  let data = poprawnaData(rok, m, d);
  if (data && dniMiedzy(dzis, data) > 180) data = poprawnaData(rok + 1, m, d);
  return data;
}

/** Pierwsza data w tekście (ISO, 25.11.2026, 25.11, "25 listopada"). */
export function znajdzDate(tekst: string, dzis: string): string | null {
  let m = tekst.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return poprawnaData(+m[1], +m[2], +m[3]);

  m = tekst.match(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4}|\d{2})\b/);
  if (m) {
    const rok = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return poprawnaData(rok, +m[2], +m[1]);
  }

  m = tekst.match(/\b(\d{1,2})\s+([a-ząćęłńóśźż]+)(?:\s+(\d{4}))?/i);
  if (m && MIESIACE[m[2].toLowerCase()]) {
    const mies = MIESIACE[m[2].toLowerCase()];
    return m[3] ? poprawnaData(+m[3], mies, +m[1]) : zRokiem(mies, +m[1], dzis);
  }

  m = tekst.match(/(?<![\d.])(\d{1,2})\s*[./]\s*(\d{1,2})(?![\d.])/);
  if (m) return zRokiem(+m[2], +m[1], dzis);
  return null;
}

// Etykiety, które w układzie z aplikacji Librusa występują bez dwukropka
// (np. "Numer lekcji 3 Przedmiot Język niemiecki"): rozpoznajemy je, gdy
// zaczynają się wielką literą.
const ETYKIETY_BEZ_DWUKROPKA: Record<string, string> = {
  "numer lekcji": "nr lekcji",
  "nr lekcji": "nr lekcji",
  "data i czas": "data",
  "data dodania": "data dodania",
  przedmiot: "przedmiot",
  nauczyciel: "nauczyciel",
  opis: "opis",
  rodzaj: "rodzaj",
  kategoria: "kategoria",
  sala: "sala",
  zakres: "zakres",
};
// Te wymagają dwukropka, bo to zwykłe słowa.
const ETYKIETY_Z_DWUKROPKIEM: Record<string, string> = {
  data: "data",
  termin: "termin",
  typ: "typ",
  lekcja: "nr lekcji",
  godzina: "godzina",
  dodał: "data dodania",
  dodano: "data dodania",
};

const ETYKIETA_RE = new RegExp(
  `(?<![\\p{L}\\d])(${[
    ...Object.keys(ETYKIETY_BEZ_DWUKROPKA),
    ...Object.keys(ETYKIETY_Z_DWUKROPKIEM),
  ]
    .sort((a, b) => b.length - a.length)
    .join("|")})(\\s*:)?(?![\\p{L}\\d])`,
  "giu",
);

/** Rozbija wpis na pola oraz nagłówek (tekst przed pierwszą etykietą). */
function polaEtykiet(tekst: string): { pola: Map<string, string>; naglowek: string } {
  const plaski = tekst.replace(/\s+/g, " ").trim();
  const trafienia: { nazwa: string; od: number; do: number }[] = [];
  for (const m of plaski.matchAll(ETYKIETA_RE)) {
    const surowa = m[1].toLowerCase();
    const zDwukropkiem = !!m[2];
    const wielka = /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(m[1]);
    const nazwa = zDwukropkiem
      ? (ETYKIETY_BEZ_DWUKROPKA[surowa] ?? ETYKIETY_Z_DWUKROPKIEM[surowa])
      : wielka
        ? ETYKIETY_BEZ_DWUKROPKA[surowa]
        : undefined;
    if (nazwa) trafienia.push({ nazwa, od: m.index!, do: m.index! + m[0].length });
  }
  const pola = new Map<string, string>();
  trafienia.forEach((t, i) => {
    const wartosc = plaski.slice(t.do, trafienia[i + 1]?.od ?? plaski.length).trim();
    pola.set(t.nazwa, [pola.get(t.nazwa), wartosc].filter(Boolean).join(" "));
  });
  return { pola, naglowek: plaski.slice(0, trafienia[0]?.od ?? 0).trim() };
}

function rozpoznajTyp(tekst: string): Typ {
  if (/sprawdzian|praca\s+klasowa/i.test(tekst)) return "sprawdzian";
  if (/kartk[oó]wk/i.test(tekst)) return "kartkowka";
  return "zwykle";
}

/** Dzieli opis na tematy: numeracja 1)/1., a w razie braku przecinki poza nawiasami. */
export function podzielOpis(opis: string): { opis: string; podzadania: string[] } {
  const tekst = opis.replace(/\s+/g, " ").trim();
  if (!tekst) return { opis: "", podzadania: [] };

  // 1) Numeracja kolejnymi liczbami od 1: "1. ... 2. ... 3. ..."
  const znaczniki: { numer: number; poczatek: number; koniec: number }[] = [];
  const re = /(?<![\d,])(\d{1,2})\s*[.)]\s+(?=\S)/g;
  let oczekiwany = 1;
  for (let m = re.exec(tekst); m; m = re.exec(tekst)) {
    if (Number(m[1]) === oczekiwany) {
      znaczniki.push({ numer: oczekiwany, poczatek: m.index, koniec: m.index + m[0].length });
      oczekiwany++;
    }
  }
  if (znaczniki.length >= 2) {
    const przed = tekst.slice(0, znaczniki[0].poczatek).trim();
    const pozycje = znaczniki
      .map((z, i) => tekst.slice(z.koniec, znaczniki[i + 1]?.poczatek ?? tekst.length))
      .map(oczysc)
      .filter(Boolean);
    return { opis: przed, podzadania: pozycje };
  }

  // 2) Pojedyncze "1." na początku: zdejmujemy numer i dzielimy po przecinkach.
  let reszta = tekst;
  if (znaczniki.length === 1 && znaczniki[0].poczatek === 0) {
    reszta = tekst.slice(znaczniki[0].koniec);
  }

  // Przedrostek typu "Rozdział II - " lub "Zakres: " trafia do opisu.
  let przedrostek = "";
  const pr = reszta.match(/^(.{2,40}?)(?:\s+[-–—]\s+|\s*:\s+)(.+)$/);
  if (pr && pr[2].includes(",")) {
    przedrostek = pr[1].trim();
    reszta = pr[2];
  }

  const pozycje = dzielPoPrzecinkach(reszta).map(oczysc).filter(Boolean);
  if (pozycje.length <= 1) {
    // jeden temat to zwykły opis, bez podzadań
    return { opis: [przedrostek, pozycje[0] ?? ""].filter(Boolean).join(" – "), podzadania: [] };
  }
  return { opis: przedrostek, podzadania: pozycje };
}

function dzielPoPrzecinkach(t: string): string[] {
  const wynik: string[] = [];
  let glebokosc = 0;
  let biezacy = "";
  for (let i = 0; i < t.length; i++) {
    const znak = t[i];
    if (znak === "(") glebokosc++;
    if (znak === ")") glebokosc = Math.max(0, glebokosc - 1);
    const koniecZdania =
      znak === "." &&
      t[i + 1] === " " &&
      /\p{L}/u.test(t[i + 2] ?? "") &&
      (biezacy.match(/(\p{L}+)$/u)?.[1].length ?? 0) >= 4; // nie rozdzielaj skrótów (np., itd.)
    if ((znak === "," || znak === ";" || koniecZdania) && glebokosc === 0) {
      wynik.push(biezacy);
      biezacy = "";
    } else biezacy += znak;
  }
  wynik.push(biezacy);
  return wynik;
}

function oczysc(t: string): string {
  const s = t.trim().replace(/^[-–—•*·\s]+/, "").replace(/[.\s]+$/, "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function podzielNaWpisy(tekst: string): string[] {
  const linie = tekst.split("\n");
  const typRe = /^\s*(sprawdzian|kartk[oó]wka|praca\s+klasowa|zadanie\s+domowe)\b/i;
  const dataRe = /^\s*(data|termin)\s*:/i;
  for (const re of [typRe, dataRe]) {
    const indeksy = linie.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);
    if (indeksy.length >= 2) {
      return indeksy
        .map((od, k) => linie.slice(od, indeksy[k + 1] ?? linie.length).join("\n"))
        .map((b) => b.trim())
        .filter(Boolean);
    }
  }
  return [tekst.trim()];
}

function parsujWpis(blok: string, dzis: string, znane: string[]): Wpis {
  const { pola, naglowek } = polaEtykiet(blok);

  const typTekst = [pola.get("rodzaj"), pola.get("kategoria"), pola.get("typ")]
    .filter(Boolean)
    .join(" ");
  const plaski = blok.replace(/\s+/g, " ").trim();
  const typ = rozpoznajTyp(typTekst || naglowek || plaski.slice(0, 150));

  // Termin: pole "Data"/"Data i czas"/"Termin", inaczej pierwsza data poza "Data dodania".
  const bezDodania = plaski.replace(/(data dodania|dodano|dodał)\s*:?[^A-Za-ząćęłńóśźż]*/gi, " ");
  const termin =
    znajdzDate(pola.get("data") ?? pola.get("termin") ?? "", dzis) ?? znajdzDate(bezDodania, dzis);

  // Przedmiot: pole, potem nagłówek, potem znany przedmiot z planu.
  let przedmiot = pola.get("przedmiot")?.trim() || null;
  const naglowekCzysty = naglowek
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .replace(/\d{1,4}[./-]\d{1,2}([./-]\d{2,4})?/g, "")
    .replace(/(sprawdzian|kartk[oó]wka|praca\s+klasowa|zadanie\s+domowe)/gi, "")
    .replace(/[-–—:,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!przedmiot && naglowekCzysty && naglowekCzysty.length <= 40) przedmiot = naglowekCzysty;
  if (!przedmiot) {
    const male = plaski.toLowerCase();
    przedmiot =
      [...znane]
        .sort((a, b) => b.length - a.length)
        .find((n) => n && male.includes(n.toLowerCase())) ?? null;
  }
  if (przedmiot) przedmiot = przedmiot.replace(/\s+/g, " ").trim();

  const nrM = (pola.get("nr lekcji") ?? "").match(/\d+/);
  const nr_lekcji = nrM ? Number(nrM[0]) : null;

  const nauczyciel = pola.get("nauczyciel")?.trim() || null;

  let opisSurowy = pola.get("opis") ?? pola.get("zakres") ?? "";
  if (!opisSurowy && pola.size === 0) {
    // brak etykiet: opis to wszystko poza pierwszą linią nagłówkową
    opisSurowy = blok.split("\n").slice(1).join(" ");
  }
  const { opis, podzadania } = podzielOpis(opisSurowy);

  const etykieta =
    typ === "sprawdzian" ? "Sprawdzian" : typ === "kartkowka" ? "Kartkówka" : "Zadanie";
  const tytul = przedmiot ? `${etykieta}: ${przedmiot}` : etykieta;

  return { typ, przedmiot, termin, nr_lekcji, nauczyciel, opis, podzadania, tytul, surowy: blok };
}

export function parsujTekst(tekst: string, dzis: string, znane: string[] = []): Wpis[] {
  const czysty = tekst
    .replace(/\r/g, "")
    .replace(/[ \t]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
  if (!czysty) return [];
  return podzielNaWpisy(czysty).map((b) => parsujWpis(b, dzis, znane));
}

export function kluczDedup(w: { typ: string; przedmiot: string | null; termin: string | null; nr_lekcji: number | null }): string {
  return [w.typ, (w.przedmiot ?? "").toLowerCase(), w.termin ?? "", w.nr_lekcji ?? ""].join("|");
}
