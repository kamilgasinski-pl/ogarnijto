import Link from "next/link";
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
  const wybrany = tydzienISO(poprawna ? sp.tydzien! : dzis);
  const dzienNr = dzienTygodnia(dzis);

  // Zadania z reguł powtarzalnych: dopilnuj, by istniały dla widocznego zakresu.
  const od = [dzis, wybrany.start].sort()[0];
  const do_ = [jutro, wybrany.koniec].sort().reverse()[0];
  await supabase.rpc("zapewnij_powtarzalne", { p_od: od, p_do: do_ });
  const { data: osobyDb } = await supabase.from("osoby").select("id, imie, rola").order("created_at");

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

  // W piątek i weekend: ile zadań czeka na sobotę i niedzielę.
  let weekend: { przypisano_id: string | null; wykonawca: Wykonawca }[] = [];
  if (dzienNr >= 5) {
    const { data } = await supabase
      .from("zadania")
      .select("przypisano_id, wykonawca")
      .eq("status", "do_zrobienia")
      .gt("termin", dzis)
      .lt("termin", jutro);
    weekend = (data ?? []) as typeof weekend;
  }

  // Dzisiejsze lekcje.
  let lekcje: { id: string; start: number; koniec: number; nazwa: string; sala: string | null; status: string }[] = [];
  if (dzienNr <= 5) {
    await supabase.rpc("zapewnij_tydzien", { p_tydzien_start: poniedzialek(dzis) });
    const [{ data: bloki }, { data: przedmioty }] = await Promise.all([
      supabase
        .from("bloki_planu")
        .select("id, godz_start, godz_koniec, przedmiot_id, sala, status")
        .eq("tydzien_start", poniedzialek(dzis))
        .eq("dzien", dzienNr)
        .order("godz_start"),
      supabase.from("przedmioty").select("id, nazwa"),
    ]);
    const nazwy = new Map((przedmioty ?? []).map((p) => [p.id as string, p.nazwa as string]));
    lekcje = (bloki ?? []).map((b) => ({
      id: b.id as string,
      start: naMinuty(b.godz_start as string),
      koniec: naMinuty(b.godz_koniec as string),
      nazwa: nazwy.get(b.przedmiot_id as string) ?? "Lekcja",
      sala: b.sala as string | null,
      status: b.status as string,
    }));
  }

  // Dojazdy na dziś, jutro i wybrany tydzień (filtr Moje/Wszystkie działa po stronie widoku).
  const odDoj = [dzis, wybrany.start].sort()[0];
  const doDoj = [jutro, wybrany.koniec].sort().reverse()[0];
  const [{ data: dojDb }, { data: wyjDb }] = await Promise.all([
    supabase.from("dojazdy").select(KOLUMNY_DOJAZDOW),
    supabase.from("dojazdy_wyjatki").select(KOLUMNY_WYJATKOW).gte("data", odDoj).lte("data", doDoj),
  ]);
  const widoczneDni = new Set([dzis, jutro]);
  for (let i = 0; i < 7; i++) widoczneDni.add(dodajDni(wybrany.start, i));
  const dojazdy: DojazdWiersz[] = wystapienia((dojDb ?? []) as Dojazd[], (wyjDb ?? []) as Wyjatek[], odDoj, doDoj)
    .filter((w) => widoczneDni.has(w.data))
    .map((w) => ({
      id: w.dojazd.id,
      data: w.data,
      rodzaj: w.dojazd.rodzaj,
      tytul: w.dojazd.tytul,
      start: naCzas(w.start),
      koniec: w.koniec != null ? naCzas(w.koniec) : null,
      przypisano_id: w.dojazd.przypisano_id,
      odwolany: w.odwolany,
      zmieniony: w.zmieniony,
      maWyjatek: !!w.wyjatek,
    }));

  // Najbliższe sprawdziany i kartkówki (60 dni do przodu) wraz z postępem nauki (umiem x/y).
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
  const osobyMini = (osobyDb ?? []) as OsobaMini[];
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
        <Card className="h-fit space-y-3">
          <CardTitle>{dzienNr <= 5 ? "Plan na dziś" : "Weekend"}</CardTitle>
          {dzienNr > 5 ? (
            <p className="text-sm text-gray-500">Dziś bez lekcji.</p>
          ) : lekcje.length === 0 ? (
            <p className="text-sm text-gray-500">Brak lekcji w planie.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {lekcje.map((l) => (
                <li key={l.id} className={l.status === "odwolana" ? "text-gray-400 line-through" : ""}>
                  <span className="text-gray-500">
                    {naCzas(l.start)}–{naCzas(l.koniec)}
                  </span>{" "}
                  <span className="font-medium">{l.nazwa}</span>
                  {l.sala && <span className="text-gray-500"> · s. {l.sala}</span>}
                </li>
              ))}
            </ul>
          )}
          <Link href="/plan" className="inline-block text-sm text-gray-500 underline">
            Cały plan
          </Link>
        </Card>
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
