// Generator testów z tekstu podręcznika. Działa na regułach, bez AI:
// wyszukuje definicje, liczby, nazwy i kluczowe pojęcia, a potem buduje z nich
// pytania wyboru, uzupełnianie luk, prawda/fałsz i pytania otwarte.

export type Pytanie =
  | { id: string; typ: "wybor"; tresc: string; opcje: string[] }
  | { id: string; typ: "luka"; tresc: string }
  | { id: string; typ: "pf"; tresc: string }
  | { id: string; typ: "otwarte"; tresc: string; linie: number };

/** Klucz odpowiedzi: trzymany osobno, widoczny tylko dla rodziców. */
export type Odpowiedz = {
  id: string;
  tekst: string; // poprawna odpowiedź albo wzorcowa odpowiedź
  poprawna?: number; // indeks opcji w pytaniu wyboru
  prawda?: boolean; // dla prawda/fałsz
};

export type Parametry = { wybor: number; luki: number; pf: number; otwarte: number };
export type WynikGeneracji = { pytania: Pytanie[]; odpowiedzi: Odpowiedz[]; uwagi: string[] };

export const DOMYSLNE: Parametry = { wybor: 10, luki: 5, pf: 5, otwarte: 3 };
export const LUKA = "……………";

const STOP = new Set(
  `i w na z do nie to się że o jak ale po co jest są był była było byli ma mają tak tylko może można przez dla od za przy oraz lub albo czyli który która które których którym którą jego jej ich tego tej tym tych ten ta te tu tam gdy gdzie kiedy ponieważ jednak także też bardzo wiele inne innych każdy każda każde wszystkie wszystkich między pod nad bez przed podczas około wśród więc dlatego będzie będą zostały został została jako jeśli gdyby aby żeby które jeden jedna jedno dwa dwie trzy kilka wielu często zwykle również przykład przykładem dzięki wtedy później wcześniej obecnie która którego którymi czasie czasem` 
    .split(/\s+/),
);

// --- losowość (powtarzalna dla tego samego ziarna) ---
function prng(ziarno: number) {
  let a = ziarno >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tasuj<T>(t: T[], los: () => number): T[] {
  const w = [...t];
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(los() * (i + 1));
    [w[i], w[j]] = [w[j], w[i]];
  }
  return w;
}

// --- czyszczenie tekstu z OCR ---
const SKROTY = /\b(np|itd|itp|tzw|tj|ok|zob|por|ryc|tab|r|w|ul|prof|dr|św|wg|godz|min|mln|mld|tys|ws|im|nr|str|s|pn|pd|wsch|zach)\./giu;

type Czesc = { zdania: string[]; naglowki: { tekst: string; od: number }[] };

export function oczyscTekst(surowy: string): Czesc {
  const tekst = surowy
    .replace(/\r/g, "")
    .replace(/­/g, "")
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2");
  const linie = tekst.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const naglowki: { tekst: string; od: number }[] = [];
  let akapity: string[] = [];
  let biezacy = "";
  const zamknij = () => {
    if (biezacy.trim()) akapity.push(biezacy.trim());
    biezacy = "";
  };
  // Dla nagłówków zapamiętujemy, ile zdań poprzedza je w tekście.
  let zdaniaPrzed = 0;
  const policz = (s: string) => rozbijNaZdania(s).length;
  for (const l of linie) {
    if (!l) {
      zamknij();
      continue;
    }
    if (/^[\d\W_]+$/u.test(l)) continue; // numery stron, ozdobniki
    if (l.length < 3) continue;
    const slowa = l.split(" ");
    const wielkie = l === l.toUpperCase() && /\p{L}{3}/u.test(l);
    const wyglądaNaNaglowek =
      l.length <= 70 && !/[.!?;,]$/.test(l) && /^[\p{Lu}\d]/u.test(l) && (slowa.length >= 2 || l.length >= 6) && slowa.length <= 9;
    if (wielkie || (wyglądaNaNaglowek && biezacy === "")) {
      zamknij();
      zdaniaPrzed = akapity.reduce((s, a) => s + policz(a), 0);
      naglowki.push({ tekst: l.replace(/^\d+[.)]\s*/, ""), od: zdaniaPrzed });
      continue;
    }
    biezacy += (biezacy ? " " : "") + l;
  }
  zamknij();
  const zdania = akapity.flatMap(rozbijNaZdania).filter(zdanieSensowne);
  // Po filtrowaniu indeksy nagłówków mogą się przesunąć: liczymy je ponownie na przefiltrowanej liście.
  const wszystkie = akapity.flatMap(rozbijNaZdania);
  const mapa = naglowki.map((n) => {
    const przed = wszystkie.slice(0, n.od).filter(zdanieSensowne).length;
    return { tekst: n.tekst, od: przed };
  });
  akapity = [];
  return { zdania, naglowki: mapa };
}

function rozbijNaZdania(akapit: string): string[] {
  const chroniony = akapit.replace(SKROTY, (m) => m.replace(".", "\u0001")).replace(/(\d)\.(\d)/g, "$1\u0001$2");
  return chroniony
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}\d„"–—-])/u)
    .map((z) => z.replace(/\u0001/g, ".").trim())
    .filter(Boolean);
}

function zdanieSensowne(z: string): boolean {
  if (z.length < 35 || z.length > 280) return false;
  const slowa = z.split(/\s+/);
  if (slowa.length < 6) return false;
  const litery = (z.match(/\p{L}/gu) ?? []).length;
  if (litery / z.length < 0.72) return false; // szum z OCR
  const dlugie = slowa.filter((w) => w.replace(/\P{L}/gu, "").length >= 3).length;
  return dlugie / slowa.length > 0.6;
}

// --- wyszukiwanie terminów ---
type Rodzaj = "liczba" | "nazwa" | "pojecie";
type Termin = { tekst: string; rodzaj: Rodzaj; wynik: number; rdzen: string };

const rdzen = (s: string) => s.toLowerCase().replace(/\P{L}/gu, "").slice(0, 5);

function terminyZdania(z: string, czestosc: Map<string, number>): Termin[] {
  const wynik: Termin[] = [];
  const re = /\d[\d.,]*\d|\d|[\p{L}][\p{L}-]*/gu;
  let m: RegExpExecArray | null;
  let pierwsze = true;
  while ((m = re.exec(z))) {
    const s = m[0];
    const poczatek = pierwsze;
    pierwsze = false;
    if (/^\d/.test(s)) {
      if (s.length >= 2) wynik.push({ tekst: s, rodzaj: "liczba", wynik: 10 + (s.length >= 3 ? 2 : 0), rdzen: s });
      continue;
    }
    const goly = s.replace(/-/g, "");
    if (goly.length < 3 || STOP.has(s.toLowerCase())) continue;
    if (/^\p{Lu}/u.test(s) && !poczatek && goly.length >= 3) {
      wynik.push({ tekst: s, rodzaj: "nazwa", wynik: 8, rdzen: rdzen(s) });
    } else if (goly.length >= 6) {
      const f = czestosc.get(rdzen(s)) ?? 1;
      wynik.push({ tekst: s, rodzaj: "pojecie", wynik: Math.min(f, 5) * 1.5 + goly.length / 6, rdzen: rdzen(s) });
    }
  }
  return wynik;
}

function slownik(zdania: string[]) {
  const czest = new Map<string, number>();
  for (const z of zdania) {
    for (const w of z.match(/\p{L}{6,}/gu) ?? []) {
      if (STOP.has(w.toLowerCase())) continue;
      const r = rdzen(w);
      czest.set(r, (czest.get(r) ?? 0) + 1);
    }
  }
  return czest;
}

function zamienNaLuke(zdanie: string, cel: string): string | null {
  const wz = new RegExp(`(?<![\\p{L}\\d])${cel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "u");
  return wz.test(zdanie) ? zdanie.replace(wz, LUKA) : null;
}

function zmyslLiczbe(liczba: string, los: () => number): string {
  const n = Number(liczba.replace(",", "."));
  if (!Number.isFinite(n)) return liczba + "0";
  const rok = Number.isInteger(n) && n >= 1000 && n <= 2100;
  const kroki = rok ? [-100, -50, -25, -10, -5, 5, 10, 25, 50, 100] : [-10, -5, -2, -1, 1, 2, 5, 10, 100, -100];
  const k = kroki[Math.floor(los() * kroki.length)];
  const wynik = n + (rok ? k : n >= 20 ? Math.round(n * 0.25) * Math.sign(k) || k : k);
  return String(Math.max(0, wynik)).replace(".", liczba.includes(",") ? "," : ".");
}

type Dystraktory = { opcje: string[]; poprawna: number } | null;

function dobierzDystraktory(cel: Termin, pula: Termin[], los: () => number, ile = 3): string[] {
  const inne = new Map<string, Termin>();
  for (const t of pula) {
    if (t.rodzaj === cel.rodzaj && t.rdzen !== cel.rdzen && t.tekst.toLowerCase() !== cel.tekst.toLowerCase()) {
      inne.set(t.tekst.toLowerCase(), t);
    }
  }
  let kandydaci = [...inne.values()];
  if (cel.rodzaj === "liczba") {
    const dobre = tasuj(kandydaci, los).map((t) => t.tekst);
    const wynik = dobre.slice(0, ile);
    let proby = 0;
    while (wynik.length < ile && proby++ < 30) {
      const z = zmyslLiczbe(cel.tekst, los);
      if (z !== cel.tekst && !wynik.includes(z)) wynik.push(z);
    }
    return wynik;
  }
  // Podobna końcówka (ten sam przypadek) i długość: odpowiedź nie może wyróżniać się formą.
  const koniec = cel.tekst.toLowerCase().slice(-2);
  kandydaci = kandydaci
    .map((t) => ({
      t,
      punkty:
        (t.tekst.toLowerCase().endsWith(koniec) ? 4 : t.tekst.toLowerCase().endsWith(koniec.slice(-1)) ? 2 : 0) -
        Math.abs(t.tekst.length - cel.tekst.length) / 6 +
        los(),
    }))
    .sort((a, b) => b.punkty - a.punkty)
    .map((x) => x.t);
  return kandydaci.slice(0, ile).map((t) => {
    // wielkość pierwszej litery taka jak w poprawnej odpowiedzi (inaczej wyróżniałaby się)
    if (cel.rodzaj === "nazwa") return t.tekst;
    return /^\p{Lu}/u.test(cel.tekst) ? t.tekst[0].toUpperCase() + t.tekst.slice(1) : t.tekst[0].toLowerCase() + t.tekst.slice(1);
  });
}

function zlozOpcje(poprawna: string, dyst: string[], los: () => number): Dystraktory {
  if (dyst.length < 2) return null;
  const opcje = tasuj([poprawna, ...dyst], los);
  return { opcje, poprawna: opcje.indexOf(poprawna) };
}

// --- definicje ---
type Definicja = { pojecie: string; lacznik: string; opis: string; zdanie: string };

function znajdzDefinicje(zdania: string[]): Definicja[] {
  const wynik: Definicja[] = [];
  const re =
    /^(?<p>[\p{L}][\p{L}\d\s-]{2,60}?)\s+(?<c>to|jest|są|oznacza|polega na)\s+(?<o>.{20,})$/u;
  for (const z of zdania) {
    const m = re.exec(z.replace(/[.!?…]+$/, ""));
    if (!m?.groups) continue;
    const p = m.groups.p.trim();
    if (p.split(/\s+/).length > 5) continue;
    if (STOP.has(p.toLowerCase())) continue;
    if (/^(to|ten|ta|te|co|jak|kiedy|gdy|on|ona|ono|oni|one|tam|tu|który|która|które)\b/iu.test(p)) continue;
    wynik.push({ pojecie: p, lacznik: m.groups.c, opis: m.groups.o.trim(), zdanie: z });
  }
  return wynik;
}

const skroc = (s: string, n = 110) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…");

// --- główna funkcja ---
export function generujTest(surowy: string, p: Parametry = DOMYSLNE, ziarno = Date.now()): WynikGeneracji {
  const los = prng(ziarno);
  const { zdania, naglowki } = oczyscTekst(surowy);
  const uwagi: string[] = [];
  if (zdania.length < 5) {
    return { pytania: [], odpowiedzi: [], uwagi: ["Za mało czytelnego tekstu. Dodaj więcej zdjęć lub popraw tekst ręcznie."] };
  }

  const czest = slownik(zdania);
  const terminy = zdania.map((z) => terminyZdania(z, czest));
  const pula = terminy.flat();
  const uzyte = new Set<number>();
  const definicje = znajdzDefinicje(zdania);
  const indeksDef = new Map(definicje.map((d) => [d.zdanie, d]));

  const najlepszy = (i: number): Termin | null =>
    [...terminy[i]].sort((a, b) => b.wynik - a.wynik)[0] ?? null;
  const kolejnosc = tasuj(zdania.map((_, i) => i), los).sort(
    (a, b) => (najlepszy(b)?.wynik ?? 0) - (najlepszy(a)?.wynik ?? 0) + (los() - 0.5) * 6,
  );

  const pytania: Pytanie[] = [];
  const odpowiedzi: Odpowiedz[] = [];
  let nr = 0;
  const id = () => `q${++nr}`;

  // 1. Wybór: najpierw z definicji, potem z luk w zdaniach.
  let zrobioneWybor = 0;
  const uzyteDef = new Set<string>();
  const defDoWyboru = tasuj(definicje, los);
  for (const d of defDoWyboru) {
    if (zrobioneWybor >= Math.floor(p.wybor / 3)) break;
    const inne = definicje.filter((x) => x.pojecie !== d.pojecie);
    if (inne.length < 3) break;
    // Wolimy wyróżniki o tym samym łączniku (to / jest / są), by forma nie zdradzała odpowiedzi.
    const dyst = tasuj(inne, los)
      .sort((x, y) => Number(y.lacznik === d.lacznik) - Number(x.lacznik === d.lacznik))
      .slice(0, 3)
      .map((x) => `${x.lacznik} ${skroc(x.opis)}`);
    const z = zlozOpcje(`${d.lacznik} ${skroc(d.opis)}`, dyst, los);
    const i = zdania.indexOf(d.zdanie);
    if (!z || i < 0 || uzyte.has(i)) continue;
    uzyte.add(i);
    uzyteDef.add(d.pojecie);
    const q = id();
    pytania.push({ id: q, typ: "wybor", tresc: `Wybierz poprawne dokończenie zdania: ${d.pojecie} …`, opcje: z.opcje });
    odpowiedzi.push({ id: q, tekst: z.opcje[z.poprawna], poprawna: z.poprawna });
    zrobioneWybor++;
  }
  for (const i of kolejnosc) {
    if (zrobioneWybor >= p.wybor) break;
    if (uzyte.has(i)) continue;
    const cel = najlepszy(i);
    if (!cel) continue;
    const luka = zamienNaLuke(zdania[i], cel.tekst);
    if (!luka) continue;
    const z = zlozOpcje(cel.tekst, dobierzDystraktory(cel, pula, los), los);
    if (!z) continue;
    uzyte.add(i);
    const q = id();
    pytania.push({ id: q, typ: "wybor", tresc: `Wybierz odpowiedź, która poprawnie uzupełnia zdanie: ${luka}`, opcje: z.opcje });
    odpowiedzi.push({ id: q, tekst: z.opcje[z.poprawna], poprawna: z.poprawna });
    zrobioneWybor++;
  }
  if (zrobioneWybor < p.wybor) uwagi.push(`Pytań wyboru: ${zrobioneWybor} z ${p.wybor} (za mało materiału).`);

  // 2. Luki.
  let luki = 0;
  for (const i of kolejnosc) {
    if (luki >= p.luki) break;
    if (uzyte.has(i)) continue;
    const cel = najlepszy(i);
    if (!cel) continue;
    const luka = zamienNaLuke(zdania[i], cel.tekst);
    if (!luka) continue;
    uzyte.add(i);
    const q = id();
    pytania.push({ id: q, typ: "luka", tresc: luka });
    odpowiedzi.push({ id: q, tekst: cel.tekst });
    luki++;
  }
  if (luki < p.luki) uwagi.push(`Luk do uzupełnienia: ${luki} z ${p.luki}.`);

  // 3. Prawda / fałsz: co drugie zdanie zafałszowane przez podmianę terminu.
  let pf = 0;
  for (const i of kolejnosc) {
    if (pf >= p.pf) break;
    if (uzyte.has(i)) continue;
    const cel = najlepszy(i);
    if (!cel) continue;
    const falsz = pf % 2 === 1;
    let tresc = zdania[i];
    let prawda = true;
    let tekstOdp = "Prawda.";
    if (falsz) {
      const podmiana = dobierzDystraktory(cel, pula, los, 3).find(
        (x) =>
          !zdania[i].toLowerCase().includes(x.toLowerCase().slice(0, 5)) &&
          (cel.rodzaj === "liczba" || x.toLowerCase().slice(-2) === cel.tekst.toLowerCase().slice(-2)),
      );
      if (!podmiana) continue; // bez pasującej formy gramatycznej fałsz byłby widoczny na pierwszy rzut oka
      const zm = zdania[i].replace(
        new RegExp(`(?<![\\p{L}\\d])${cel.tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "u"),
        podmiana,
      );
      if (zm === zdania[i]) continue;
      tresc = zm;
      prawda = false;
      tekstOdp = `Fałsz. W tekście: „${cel.tekst}” (zamiast „${podmiana}”). Zdanie: ${zdania[i]}`;
    }
    uzyte.add(i);
    const q = id();
    pytania.push({ id: q, typ: "pf", tresc });
    odpowiedzi.push({ id: q, tekst: tekstOdp, prawda });
    pf++;
  }
  if (pf < p.pf) uwagi.push(`Pytań prawda/fałsz: ${pf} z ${p.pf}.`);

  // 4. Otwarte: pojęcia z definicji, potem nagłówki, potem najczęstsze pojęcia.
  let otw = 0;
  for (const d of tasuj(definicje, los).sort((x, y) => Number(uzyteDef.has(x.pojecie)) - Number(uzyteDef.has(y.pojecie)))) {
    if (otw >= p.otwarte) break;
    const q = id();
    pytania.push({ id: q, typ: "otwarte", tresc: `Wyjaśnij własnymi słowami, co to jest: ${d.pojecie}.`, linie: 3 });
    odpowiedzi.push({ id: q, tekst: d.zdanie });
    otw++;
  }
  for (const n of tasuj(naglowki, los)) {
    if (otw >= p.otwarte) break;
    const pocz = zdania.slice(n.od, n.od + 2);
    if (pocz.length === 0) continue;
    const q = id();
    pytania.push({ id: q, typ: "otwarte", tresc: `Napisz, czego dowiedziałeś się o temacie: ${n.tekst}.`, linie: 4 });
    odpowiedzi.push({ id: q, tekst: pocz.join(" ") });
    otw++;
  }
  const topPojecia = [...czest.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
  for (const r of topPojecia) {
    if (otw >= p.otwarte) break;
    const si = zdania.findIndex((z) => rdzen(z.match(/\p{L}{6,}/gu)?.find((w) => rdzen(w) === r) ?? "") === r);
    if (si < 0) continue;
    const slowo = zdania[si].match(/\p{L}{6,}/gu)!.find((w) => rdzen(w) === r)!;
    if (indeksDef.size && definicje.some((d) => rdzen(d.pojecie) === r)) continue;
    const q = id();
    pytania.push({ id: q, typ: "otwarte", tresc: `Napisz, co wiesz o: ${slowo}.`, linie: 3 });
    odpowiedzi.push({ id: q, tekst: zdania.filter((z) => rdzen(z.match(/\p{L}{6,}/gu)?.find((w) => rdzen(w) === r) ?? "") === r).slice(0, 2).join(" ") });
    otw++;
  }
  if (otw < p.otwarte) uwagi.push(`Pytań otwartych: ${otw} z ${p.otwarte}.`);

  // Porządek: wybór, luki, prawda/fałsz, otwarte; numeracja według kolejności w teście.
  const rzad = { wybor: 0, luka: 1, pf: 2, otwarte: 3 } as const;
  pytania.sort((a, b) => rzad[a.typ] - rzad[b.typ]);
  return { pytania, odpowiedzi, uwagi };
}

export const NAZWY_CZESCI: Record<Pytanie["typ"], string> = {
  wybor: "Test jednokrotnego wyboru. Zaznacz jedną poprawną odpowiedź.",
  luka: "Uzupełnij zdania brakującym słowem lub liczbą.",
  pf: "Prawda czy fałsz? Zaznacz P lub F.",
  otwarte: "Odpowiedz własnymi słowami.",
};
