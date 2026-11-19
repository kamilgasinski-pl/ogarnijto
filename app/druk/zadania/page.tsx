import Link from "next/link";
import { Bus, Car } from "lucide-react";
import { wymagajRodziny } from "@/lib/auth";
import { dodajDni, dzienMiesiac, dzisiaj, etykietaDnia, jutroDlaWidoku, poniedzialek } from "@/lib/dates";
import { KOLUMNY_DOJAZDOW, KOLUMNY_WYJATKOW, wystapienia, type Dojazd, type Wyjatek } from "@/lib/dojazdy";
import { naCzas } from "@/lib/plan";
import {
  jestMoje,
  jestZalegle,
  krotkaGodzina,
  KOLUMNY_PODZADAN,
  KOLUMNY_ZADAN,
  type OsobaMini,
  type Podzadanie,
  type Zadanie,
} from "@/lib/zadania";
import { PrzyciskDruku } from "./przycisk-druku";

type Props = { searchParams: Promise<{ zakres?: string; kto?: string }> };

const ZAKRESY = [
  { id: "dzis", etykieta: "Dziś" },
  { id: "dwa", etykieta: "Dziś i jutro" },
  { id: "tydzien", etykieta: "Cały tydzień" },
];

export default async function DrukZadan({ searchParams }: Props) {
  const { supabase, osoba } = await wymagajRodziny();
  const sp = await searchParams;
  const dzis = dzisiaj();
  const zakres = ZAKRESY.some((z) => z.id === sp.zakres) ? sp.zakres! : "dzis";
  const kto = sp.kto ?? "moje";
  const koniec =
    zakres === "dzis" ? dzis : zakres === "dwa" ? jutroDlaWidoku(dzis) : dodajDni(poniedzialek(dzis), 6);
  const koniecEfektywny = koniec < dzis ? dzis : koniec;

  await supabase.rpc("zapewnij_powtarzalne", { p_od: dzis, p_do: koniecEfektywny });
  const { data: osobyDb } = await supabase.from("osoby").select("id, imie, rola").order("created_at");
  const osoby = (osobyDb ?? []) as OsobaMini[];
  const wybrana = kto === "wszystkie" ? null : osoby.find((o) => o.id === (kto === "moje" ? osoba.id : kto)) ?? osoba;

  const { data: zad } = await supabase
    .from("zadania")
    .select(KOLUMNY_ZADAN)
    .eq("status", "do_zrobienia")
    .lte("termin", koniecEfektywny)
    .order("termin");
  const zadania = ((zad ?? []) as Zadanie[])
    .filter((z) => !wybrana || jestMoje(z, wybrana.id, wybrana.rola))
    .sort((a, b) => (a.godz_start ?? "99").localeCompare(b.godz_start ?? "99") || a.tytul.localeCompare(b.tytul, "pl"));

  let podzadania: Podzadanie[] = [];
  if (zadania.length > 0) {
    const { data } = await supabase
      .from("podzadania")
      .select(KOLUMNY_PODZADAN)
      .in("zadanie_id", zadania.map((z) => z.id))
      .order("kolejnosc");
    podzadania = (data ?? []) as Podzadanie[];
  }

  const [{ data: dojDb }, { data: wyjDb }] = await Promise.all([
    supabase.from("dojazdy").select(KOLUMNY_DOJAZDOW),
    supabase.from("dojazdy_wyjatki").select(KOLUMNY_WYJATKOW).gte("data", dzis).lte("data", koniecEfektywny),
  ]);
  const dojazdy = wystapienia((dojDb ?? []) as Dojazd[], (wyjDb ?? []) as Wyjatek[], dzis, koniecEfektywny).filter(
    (w) => !w.odwolany && (!wybrana || w.dojazd.przypisano_id === wybrana.id),
  );

  const zalegle = zadania.filter((z) => jestZalegle(z, dzis));
  const dni: string[] = [];
  for (let d = dzis; d <= koniecEfektywny; d = dodajDni(d, 1)) dni.push(d);

  const tytul = wybrana ? `Zadania · ${wybrana.imie}` : "Zadania · wszystkie osoby";
  const nawig = (id: string, etykieta: string, aktywny: boolean) => (
    <Link
      key={id}
      href={`/druk/zadania?zakres=${id}&kto=${kto}`}
      className={`rounded-full px-3 py-1 text-sm ${aktywny ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-700"}`}
    >
      {etykieta}
    </Link>
  );

  function blok(z: Zadanie) {
    const pod = podzadania.filter((p) => p.zadanie_id === z.id);
    const typ = z.typ === "sprawdzian" ? "Sprawdzian" : z.typ === "kartkowka" ? "Kartkówka" : null;
    const kiedy = krotkaGodzina(z.godz_start);
    const kogo = z.przypisano_id ? osoby.find((o) => o.id === z.przypisano_id)?.imie : null;
    return (
      <li key={z.id} className="break-inside-avoid">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-sm border-2 border-gray-800" />
          <div>
            <p className="font-semibold leading-snug">
              {typ && <span className="mr-1.5 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{typ}</span>}
              {z.przedmiot && <span className="text-gray-600">{z.przedmiot}: </span>}
              {z.tytul}
            </p>
            <p className="text-xs text-gray-600">
              {kiedy && `${kiedy}${krotkaGodzina(z.godz_koniec) ? `–${krotkaGodzina(z.godz_koniec)}` : ""}`}
              {kiedy && kogo && " · "}
              {!wybrana && kogo}
              {z.termin < dzis && ` · termin ${dzienMiesiac(z.termin)}`}
            </p>
            {z.opis && <p className="text-xs text-gray-500">{z.opis}</p>}
          </div>
        </div>
        {pod.length > 0 && (
          <ul className="ml-2 mt-1 space-y-0.5 border-l-2 border-gray-500 pl-4">
            {pod.map((p) => (
              <li
                key={p.id}
                className="relative flex items-start gap-2 text-sm before:absolute before:-left-4 before:top-2.5 before:w-3.5 before:border-t-2 before:border-gray-500"
              >
                <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border-[1.5px] border-gray-700 text-center text-[10px] leading-3">
                  {p.wykonane ? "✓" : ""}
                </span>
                <span className={p.wykonane ? "text-gray-400 line-through" : ""}>{p.tresc}</span>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[800px] p-4 print:max-w-none print:p-0" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <style href="druk-zadan" precedence="default">{`@page { size: A4 portrait; margin: 12mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-1.5">{ZAKRESY.map((z) => nawig(z.id, z.etykieta, z.id === zakres))}</div>
        <PrzyciskDruku />
      </div>

      <h1 className="text-xl font-bold">
        {tytul}
        <span className="ml-2 text-sm font-normal text-gray-500">
          {zakres === "dzis" ? etykietaDnia(dzis, dzis) + " " + dzienMiesiac(dzis) : `${dzienMiesiac(dzis)}–${dzienMiesiac(koniecEfektywny)}`}
        </span>
      </h1>

      <div className="mt-3 space-y-4">
        {zalegle.length > 0 && (
          <section>
            <h2 className="mb-1 border-b border-gray-400 text-sm font-bold uppercase tracking-wide text-gray-700">Zaległe</h2>
            <ul className="space-y-2">{zalegle.map(blok)}</ul>
          </section>
        )}
        {dni.map((d) => {
          const lista = zadania.filter((z) => z.termin === d && !jestZalegle(z, dzis));
          const doj = dojazdy.filter((w) => w.data === d);
          if (lista.length === 0 && doj.length === 0 && dni.length > 1) return null;
          return (
            <section key={d}>
              <h2 className="mb-1 border-b border-gray-400 text-sm font-bold uppercase tracking-wide text-gray-700">
                {etykietaDnia(d, dzis)} <span className="font-normal normal-case text-gray-500">{dzienMiesiac(d)}</span>
              </h2>
              {lista.length === 0 && doj.length === 0 ? (
                <p className="text-sm text-gray-400">Brak zadań.</p>
              ) : (
                <ul className="space-y-2">
                  {doj.map((w) => (
                    <li key={w.dojazd.id + w.data} className="flex items-center gap-2 text-sm">
                      {w.dojazd.rodzaj === "autobus" ? <Bus size={14} /> : <Car size={14} />}
                      <span className="font-medium">
                        {naCzas(w.start)}
                        {w.koniec != null && `–${naCzas(w.koniec)}`}
                      </span>
                      <span>{w.dojazd.tytul}</span>
                    </li>
                  ))}
                  {lista.map(blok)}
                </ul>
              )}
            </section>
          );
        })}
        {zadania.length === 0 && dojazdy.length === 0 && <p className="text-sm text-gray-400">Brak zadań do zrobienia.</p>}
      </div>
    </main>
  );
}
