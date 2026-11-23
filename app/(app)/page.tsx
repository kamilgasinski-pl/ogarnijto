import { PlanDnia, type PozycjaDnia } from "@/components/plan-dnia";
import { wymagajRodziny } from "@/lib/auth";
import { Card, CardTitle } from "@/components/ui/card";
import { Zadania, type DojazdWiersz } from "@/components/zadania/zadania";
import {
  dataSlownie,
  dodajDni,
  dzienTygodnia,
  dzienMiesiac,
  dzisiaj,
  jutroDlaWidoku,
  poniedzialek,
  tydzienISO,
} from "@/lib/dates";
import { naCzas, naMinuty } from "@/lib/plan";
import { KOLUMNY_DOJAZDOW, KOLUMNY_WYJATKOW, wystapienia, type Dojazd, type Wyjatek } from "@/lib/dojazdy";
import {
  KOLUMNY_PODZADAN,
  kolorOsoby,
  nazwaWykonawcy,
  KOLUMNY_ZADAN,
  type OsobaMini,
  type Podzadanie,
  type Wykonawca,
  type Zadanie,
} from "@/lib/zadania";

export default async function Pulpit({
  searchParams,
}: {
  searchParams: Promise<{ tydzien?: string }>;
}) {
  const { supabase, osoba } = await wymagajRodziny();
  const sp = await searchParams;
  const dzis = dzisiaj();
  const jutro = jutroDlaWidoku(dzis);
  const tydzien = tydzienISO(dzis);
  const poprawna = sp.tydzien && /^\d{4}-\d{2}-\d{2}$/.test(sp.tydzien);
  // Domyślnie pokazujemy kolejny tydzień (bieżący i tak widać w Dziś i Jutro); strzałkami można wrócić.
  const wybrany = tydzienISO(poprawna ? sp.tydzien! : dodajDni(dzis, 7));
  const dzienNr = dzienTygodnia(dzis);

  // Zadania z reguł powtarzalnych: dopilnuj, by istniały dla widocznego zakresu.
  const od = [dzis, wybrany.start].sort()[0];
  const do_ = [jutro, wybrany.koniec].sort().reverse()[0];
  // Niezależne części pulpitu pobieramy równolegle, a nie jedna po drugiej: każde zapytanie to
  // osobna podróż do bazy, więc sekwencja znacznie wydłużała ładowanie (zwłaszcza na telefonie).
  const zadaniaIPodzadania = async () => {
    await supabase.rpc("zapewnij_powtarzalne", { p_od: od, p_do: do_ });
    // Zadania: niewykonane do jutra (w tym zaległe) oraz wszystko z dziś i jutra.
    const { data: zad } = await supabase
      .from("zadania")
      .select(KOLUMNY_ZADAN)
      .or(
        `and(status.eq.do_zrobienia,termin.lte.${jutro}),and(status.eq.do_zrobienia,na_dzien.lte.${dzis}),termin.in.(${dzis},${jutro}),and(termin.gte.${wybrany.start},termin.lte.${wybrany.koniec})`,
      )
      .order("termin");
    const zadania = (zad ?? []) as Zadanie[];
    let podzadania: Podzadanie[] = [];
    if (zadania.length > 0) {
      const { data } = await supabase
        .from("podzadania")
        .select(KOLUMNY_PODZADAN)
        .in("zadanie_id", zadania.map((z) => z.id))
        .order("kolejnosc");
      podzadania = (data ?? []) as Podzadanie[];
    }
    return { zadania, podzadania };
  };

  // W piątek i weekend: ile zadań czeka na sobotę i niedzielę.
  const weekendLista = async () => {
    if (dzienNr < 5) return [] as { przypisano_id: string | null; wykonawca: Wykonawca }[];
    const { data } = await supabase
      .from("zadania")
      .select("przypisano_id, wykonawca")
      .eq("status", "do_zrobienia")
      .gt("termin", dzis)
      .lt("termin", jutro);
    return (data ?? []) as { przypisano_id: string | null; wykonawca: Wykonawca }[];
  };

  // Dzisiejsze lekcje.
  type Lekcja = { id: string; start: number; koniec: number; nazwa: string; sala: string | null; status: string; zmiany: string[]; uwagi: string | null };
  const lekcjeDnia = async (): Promise<Lekcja[]> => {
    if (dzienNr > 5) return [];
    await supabase.rpc("zapewnij_tydzien", { p_tydzien_start: poniedzialek(dzis) });
    const [{ data: bloki }, { data: przedmioty }] = await Promise.all([
      supabase
        .from("bloki_planu")
        .select("id, linia_id, godz_start, godz_koniec, przedmiot_id, sala, status, uwagi")
        .eq("tydzien_start", poniedzialek(dzis))
        .eq("dzien", dzienNr)
        .order("godz_start"),
      supabase.from("przedmioty").select("id, nazwa"),
    ]);
    const nazwy = new Map((przedmioty ?? []).map((p) => [p.id as string, p.nazwa as string]));
    // Porównanie ze stałym szablonem planu: wykrywamy zmianę godziny, sali albo przedmiotu na dziś.
    const { data: szablonDb } = await supabase
      .from("bloki_szablonu")
      .select("id, godz_start, godz_koniec, przedmiot_id, sala")
      .in("id", (bloki ?? []).map((b) => b.linia_id as string));
    const szablon = new Map((szablonDb ?? []).map((x) => [x.id as string, x]));
    return (bloki ?? []).map((b) => {
      const start = naMinuty(b.godz_start as string);
      const koniec = naMinuty(b.godz_koniec as string);
      const bylo = szablon.get(b.linia_id as string);
      const zmiany: string[] = [];
      if (bylo && b.status !== "odwolana") {
        const bs = naMinuty(bylo.godz_start as string);
        const bk = naMinuty(bylo.godz_koniec as string);
        if (bs !== start || bk !== koniec) zmiany.push(`było ${naCzas(bs)}–${naCzas(bk)}`);
        if ((bylo.sala ?? "") !== ((b.sala as string | null) ?? "")) zmiany.push(`sala: było ${bylo.sala ?? "brak"}`);
        if (bylo.przedmiot_id !== b.przedmiot_id) zmiany.push(`było: ${nazwy.get(bylo.przedmiot_id as string) ?? "inny przedmiot"}`);
      }
      return {
        id: b.id as string,
        start,
        koniec,
        nazwa: nazwy.get(b.przedmiot_id as string) ?? "Lekcja",
        sala: b.sala as string | null,
        status: b.status as string,
        zmiany,
        uwagi: (b.uwagi as string | null) || null,
      };
    });
  };

  // Dojazdy na dziś, jutro i wybrany tydzień (filtr Moje/Wszystkie działa po stronie widoku).
  const odDoj = [dzis, wybrany.start].sort()[0];
  const doDoj = [jutro, wybrany.koniec].sort().reverse()[0];
  const dojazdyDb = () =>
    Promise.all([
      supabase.from("dojazdy").select(KOLUMNY_DOJAZDOW),
      supabase.from("dojazdy_wyjatki").select(KOLUMNY_WYJATKOW).gte("data", odDoj).lte("data", doDoj),
    ]);

  // Najbliższe sprawdziany i kartkówki (60 dni do przodu) wraz z postępem nauki (umiem x/y).
  const sprawdziany = async () => {
    const { data: testyDb } = await supabase
      .from("zadania")
      .select(KOLUMNY_ZADAN)
      .in("typ", ["sprawdzian", "kartkowka"])
      .eq("status", "do_zrobienia")
      .gte("termin", dzis)
      .lte("termin", dodajDni(dzis, 60))
      .order("termin")
      .limit(8);
    const nadchodzace = (testyDb ?? []) as Zadanie[];
    const postep = new Map<string, { ok: number; razem: number }>();
    if (nadchodzace.length > 0) {
      const { data } = await supabase
        .from("podzadania")
        .select("zadanie_id, wykonane")
        .in("zadanie_id", nadchodzace.map((z) => z.id));
      for (const r of data ?? []) {
        const e = postep.get(r.zadanie_id as string) ?? { ok: 0, razem: 0 };
        e.razem++;
        if (r.wykonane) e.ok++;
        postep.set(r.zadanie_id as string, e);
      }
    }
    return { nadchodzace, postep };
  };

  const [{ data: osobyDb }, { zadania, podzadania }, weekend, lekcje, [{ data: dojDb }, { data: wyjDb }], { nadchodzace, postep }] =
    await Promise.all([
      supabase.from("osoby").select("id, imie, rola").order("created_at"),
      zadaniaIPodzadania(),
      weekendLista(),
      lekcjeDnia(),
      dojazdyDb(),
      sprawdziany(),
    ]);

  const widoczneDni = new Set([dzis, jutro]);
  for (let i = 0; i < 7; i++) widoczneDni.add(dodajDni(wybrany.start, i));
  const dojazdy: DojazdWiersz[] = wystapienia((dojDb ?? []) as Dojazd[], (wyjDb ?? []) as Wyjatek[], odDoj, doDoj)
    .filter((w) => widoczneDni.has(w.data))
    .map((w) => ({
      id: w.dojazd.id,
      data: w.data,
      rodzaj: w.dojazd.rodzaj,
      kierunek: w.dojazd.kierunek,
      tytul: w.dojazd.tytul,
      start: naCzas(w.start),
      koniec: w.koniec != null ? naCzas(w.koniec) : null,
      przypisano_id: w.dojazd.przypisano_id,
      odwolany: w.odwolany,
      zmieniony: w.zmieniony,
      maWyjatek: !!w.wyjatek,
      opis: w.dojazd.opis,
      bylo: w.zmieniony ? naCzas(naMinuty(w.dojazd.godz_start)) : null,
    }));

  const osobyMini = (osobyDb ?? []) as OsobaMini[];
  // Plan dnia: lekcje i dojazdy (z oznaczeniem osoby, która odbiera lub odwozi) w jednej osi czasu.
  const pozycjeDnia: PozycjaDnia[] = [
    ...lekcje.map((l): PozycjaDnia => ({ rodzaj: "lekcja", ...l })),
    ...dojazdy
      .filter((d) => d.data === dzis)
      .map((d): PozycjaDnia => ({
        rodzaj: "dojazd",
        id: `d-${d.id}`,
        start: naMinuty(d.start),
        koniec: d.koniec ? naMinuty(d.koniec) : null,
        nazwa: d.tytul,
        pojazd: d.rodzaj,
        kierunek: d.kierunek,
        odwolany: d.odwolany,
        zmieniony: d.zmieniony,
        bylo: d.bylo ?? null,
        opis: d.opis ?? null,
        imie: osobyMini.find((o) => o.id === d.przypisano_id)?.imie ?? null,
        kolor: osobyMini.length > 1 ? kolorOsoby(d.przypisano_id, osobyMini) : null,
      })),
  ].sort((a, b) => a.start - b.start);
  const zaIleDni = (iso: string) => Math.round((Date.parse(iso) - Date.parse(dzis)) / 86400000);
  const opisDni = (n: number) => (n === 0 ? "dziś" : n === 1 ? "jutro" : `za ${n} dni`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cześć, {osoba.imie}!</h1>
        <p className="text-gray-500">
          {dataSlownie(dzis)} · tydzień {tydzien.numer}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Zadania
            key={wybrany.start}
            zadania={zadania}
            podzadania={podzadania}
            rodzinaId={osoba.rodzina_id}
            osoby={(osobyDb ?? []) as OsobaMini[]}
            mojeId={osoba.id}
            rola={osoba.rola}
            dzis={dzis}
            jutro={jutro}
            widok="pulpit"
            weekend={weekend}
            dojazdy={dojazdy}
            tydzien={{ ...wybrany, biezacy: wybrany.start === tydzien.start }}
          />
        </div>
        <div className="space-y-6">
        <PlanDnia
          tytul={dzienNr <= 5 ? "Plan na dziś" : "Weekend"}
          data={dataSlownie(dzis)}
          pozycje={pozycjeDnia}
          pusto={dzienNr > 5 ? "Dziś bez lekcji." : "Brak lekcji w planie."}
        />
        <Card className="h-fit space-y-3">
          <CardTitle>Najbliższe sprawdziany i kartkówki</CardTitle>
          {nadchodzace.length === 0 ? (
            <p className="text-sm text-gray-500">Brak zapowiedzianych sprawdzianów.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {nadchodzace.map((z) => {
                const n = zaIleDni(z.termin);
                const pil = n <= 2;
                const pos = postep.get(z.id);
                const kolor = osobyMini.length > 1 ? kolorOsoby(z.przypisano_id, osobyMini) : null;
                const imie = nazwaWykonawcy(z, osobyMini);
                return (
                  <li
                    key={z.id}
                    className="rounded-lg border border-gray-200 bg-white p-2.5"
                    style={kolor ? { borderLeftWidth: 5, borderLeftColor: kolor } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">
                        <span className="mr-1.5 rounded bg-amber-100 px-1.5 text-xs font-normal text-amber-800">
                          {z.typ === "sprawdzian" ? "Sprawdzian" : "Kartkówka"}
                        </span>
                        {z.przedmiot ?? z.tytul}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${pil ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                        {opisDni(n)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {dzienMiesiac(z.termin)}
                      {z.przedmiot && z.tytul !== z.przedmiot ? ` · ${z.tytul}` : ""}
                      {pos && pos.razem > 0 ? ` · umiem ${pos.ok}/${pos.razem}` : ""}
                      {kolor && imie ? <span style={{ color: kolor }}> · {imie}</span> : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}
