"use client";

import { useState } from "react";
import Link from "next/link";
import { AlarmClock, Check, ListChecks, Pencil, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { dodajDni, dzienMiesiac, etykietaDnia } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  KOLUMNY_ZADAN,
  jestZalegle,
  krotkaGodzina,
  nazwaWykonawcy,
  polaWykonawcy,
  type OsobaMini,
  type Podzadanie,
  type Zadanie,
} from "@/lib/zadania";
import { ArkuszZadania } from "./arkusz-zadania";

type Props = {
  zadania: Zadanie[];
  podzadania: Podzadanie[];
  rodzinaId: string;
  osoby: OsobaMini[];
  mojeId: string;
  dzis: string;
  jutro: string;
  widok: "pulpit" | "wszystkie";
  weekend?: number;
  /** Tydzień pokazywany na pulpicie (poniedziałek–niedziela). */
  tydzien?: { start: string; numer: number; koniec: string; biezacy: boolean };
};

function liczba(n: number) {
  if (n === 1) return "1 zadanie";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} zadania`;
  return `${n} zadań`;
}

const sortuj = (a: Zadanie, b: Zadanie) =>
  Number(a.status === "zrobione") - Number(b.status === "zrobione") ||
  a.termin.localeCompare(b.termin) ||
  (a.godz_start ?? "99").localeCompare(b.godz_start ?? "99") ||
  a.tytul.localeCompare(b.tytul, "pl");

export function Zadania({
  zadania: z0,
  podzadania: p0,
  rodzinaId,
  osoby,
  mojeId,
  dzis,
  jutro,
  widok,
  weekend = 0,
  tydzien,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [zadania, setZadania] = useState(z0);
  const [podzadania, setPodzadania] = useState(p0);
  const [edycja, setEdycja] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [pokazWykonane, setPokazWykonane] = useState(false);

  const [tytul, setTytul] = useState("");
  const [termin, setTermin] = useState(dzis);
  const [kto, setKto] = useState(mojeId);

  const podDla = (id: string) => podzadania.filter((p) => p.zadanie_id === id);

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    const t = tytul.trim();
    if (!t) return;
    setBlad(null);
    const { data, error } = await supabase
      .from("zadania")
      .insert({ rodzina_id: rodzinaId, tytul: t, termin, ...polaWykonawcy(kto, osoby) })
      .select(KOLUMNY_ZADAN)
      .single();
    if (error) return setBlad(tlumaczBlad(error.message));
    setZadania((s) => [...s, data as unknown as Zadanie]);
    setTytul("");
  }

  async function ustawStatus(z: Zadanie, status: Zadanie["status"]) {
    setZadania((s) => s.map((x) => (x.id === z.id ? { ...x, status } : x)));
    const { error } = await supabase.from("zadania").update({ status }).eq("id", z.id);
    if (error) {
      setZadania((s) => s.map((x) => (x.id === z.id ? z : x)));
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function przenies(z: Zadanie, nowyTermin: string) {
    setZadania((s) => s.map((x) => (x.id === z.id ? { ...x, termin: nowyTermin } : x)));
    const { error } = await supabase.from("zadania").update({ termin: nowyTermin }).eq("id", z.id);
    if (error) {
      setZadania((s) => s.map((x) => (x.id === z.id ? z : x)));
      setBlad(tlumaczBlad(error.message));
    }
  }

  const widoczne = zadania.filter((z) => pokazWykonane || widok === "pulpit" || z.status === "do_zrobienia");
  const zalegle = zadania.filter((z) => jestZalegle(z, dzis)).sort(sortuj);

  function sekcja(naglowek: string, lista: Zadanie[], pusto?: string, dodatek?: React.ReactNode) {
    return (
      <section key={naglowek} className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {naglowek} <span className="font-normal text-gray-400">{lista.length > 0 && lista.length}</span>
        </h2>
        {lista.length === 0 ? (
          pusto && <p className="text-sm text-gray-400">{pusto}</p>
        ) : (
          <ul className="space-y-1.5">
            {lista.map((z) => (
              <Wiersz
                key={z.id}
                z={z}
                podzadania={podDla(z.id)}
                osoby={osoby}
                zalegle={jestZalegle(z, dzis)}
                dzis={dzis}
                onStatus={ustawStatus}
                onPrzenies={przenies}
                onOtworz={() => setEdycja(z.id)}
              />
            ))}
          </ul>
        )}
        {dodatek}
      </section>
    );
  }

  function widokTygodnia(t: NonNullable<Props["tydzien"]>) {
    const nawig =
      "rounded-full border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-100";
    const dni: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = dodajDni(t.start, i);
      // sobotę i niedzielę pokazujemy tylko, gdy coś w nie wypada
      if (i < 5 || zadania.some((z) => z.termin === d)) dni.push(d);
    }
    return (
      <section className="space-y-3 border-t border-gray-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Tydzień {t.numer}{" "}
            <span className="text-sm font-normal text-gray-500">
              {dzienMiesiac(t.start)}–{dzienMiesiac(t.koniec)}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Link href={`/?tydzien=${dodajDni(t.start, -7)}`} className={nawig} aria-label="Poprzedni tydzień">←</Link>
            {!t.biezacy && <Link href="/" className={nawig}>Ten tydzień</Link>}
            <Link href={`/?tydzien=${dodajDni(t.start, 7)}`} className={nawig} aria-label="Następny tydzień">→</Link>
          </div>
        </div>
        {dni.map((d) => {
          const lista = zadania.filter((z) => z.termin === d).sort(sortuj);
          return (
            <div key={d} className="space-y-1.5">
              <h3 className={`text-sm font-semibold ${d === dzis ? "text-gray-900" : "text-gray-600"}`}>
                {etykietaDnia(d, dzis)}
                {d === dzis || d === jutro ? <span className="ml-1 font-normal text-gray-400">{dzienMiesiac(d)}</span> : null}
              </h3>
              {lista.length === 0 ? (
                <p className="text-sm text-gray-300">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {lista.map((z) => (
                    <Wiersz
                      key={z.id}
                      z={z}
                      podzadania={podDla(z.id)}
                      osoby={osoby}
                      zalegle={false}
                      dzis={dzis}
                      onStatus={ustawStatus}
                      onPrzenies={przenies}
                      onOtworz={() => setEdycja(z.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    );
  }

  let tresc: React.ReactNode;
  if (widok === "pulpit") {
    const dzisL = zadania.filter((z) => z.termin === dzis && !jestZalegle(z, dzis)).sort(sortuj);
    const jutroL = zadania.filter((z) => z.termin === jutro).sort(sortuj);
    tresc = (
      <>
        {zalegle.length > 0 && sekcja("Zaległe", zalegle)}
        {sekcja("Dziś", dzisL, "Nic na dziś. Można odpocząć albo dodać zadanie.")}
        {sekcja(
          etykietaDnia(jutro, dzis),
          jutroL,
          "Nic zaplanowane.",
          weekend > 0 && (
            <Link href="/zadania" className="inline-block text-sm text-gray-500 underline">
              + {liczba(weekend)} w weekend
            </Link>
          ),
        )}
        {tydzien && widokTygodnia(tydzien)}
      </>
    );
  } else {
    const grupy = new Map<string, Zadanie[]>();
    for (const z of widoczne.filter((x) => !jestZalegle(x, dzis)).sort(sortuj)) {
      if (!pokazWykonane && z.termin < dzis) continue; // stare sprawdziany po terminie
      grupy.set(z.termin, [...(grupy.get(z.termin) ?? []), z]);
    }
    const daty = [...grupy.keys()].sort();
    tresc = (
      <>
        {zalegle.length > 0 && sekcja("Zaległe", zalegle)}
        {daty.map((d) => sekcja(etykietaDnia(d, dzis), grupy.get(d)!))}
        {daty.length === 0 && zalegle.length === 0 && (
          <p className="text-sm text-gray-400">Brak zadań.</p>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={pokazWykonane} onChange={(e) => setPokazWykonane(e.target.checked)} />
          Pokaż wykonane
        </label>
      </>
    );
  }

  const edytowane = zadania.find((z) => z.id === edycja);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <form onSubmit={dodaj} className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-48 flex-1"
            placeholder="Dodaj zadanie…"
            value={tytul}
            onChange={(e) => setTytul(e.target.value)}
          />
          <Input type="date" required className="w-40" value={termin} onChange={(e) => setTermin(e.target.value)} aria-label="Termin" />
          <Select className="w-36" value={kto} onChange={(e) => setKto(e.target.value)} aria-label="Kto">
            {osoby.map((o) => (
              <option key={o.id} value={o.id}>{o.imie}</option>
            ))}
            <option value="oba">Oboje</option>
          </Select>
          <Button type="submit">Dodaj</Button>
        </form>
        {blad && <p className="mt-2 text-sm text-red-600">{blad}</p>}
      </Card>

      {tresc}

      {edytowane && (
        <ArkuszZadania
          key={edytowane.id}
          zadanie={edytowane}
          podzadania={podDla(edytowane.id)}
          rodzinaId={rodzinaId}
          osoby={osoby}
          onZapisz={(z) => setZadania((s) => s.map((x) => (x.id === z.id ? z : x)))}
          onUsun={(id) => setZadania((s) => s.filter((x) => x.id !== id))}
          onPodzadania={(id, lista) =>
            setPodzadania((s) => [...s.filter((p) => p.zadanie_id !== id), ...lista])
          }
          onZamknij={() => setEdycja(null)}
        />
      )}
    </div>
  );
}

function Wiersz({
  z,
  podzadania,
  osoby,
  zalegle,
  dzis,
  onStatus,
  onPrzenies,
  onOtworz,
}: {
  z: Zadanie;
  podzadania: Podzadanie[];
  osoby: OsobaMini[];
  zalegle: boolean;
  dzis: string;
  onStatus: (z: Zadanie, s: Zadanie["status"]) => void;
  onPrzenies: (z: Zadanie, termin: string) => void;
  onOtworz: () => void;
}) {
  const zrobione = z.status === "zrobione";
  const umiem = podzadania.filter((p) => p.wykonane).length;
  const test = z.typ !== "zwykle";
  const wykonawca = nazwaWykonawcy(z, osoby);
  const od = krotkaGodzina(z.godz_start);
  const do_ = krotkaGodzina(z.godz_koniec);

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border bg-white p-3 ${zalegle ? "border-red-200 bg-red-50/40" : "border-gray-200"}`}
    >
      <button
        aria-label={zrobione ? "Cofnij wykonanie" : "Oznacz jako zrobione"}
        onClick={() => onStatus(z, zrobione ? "do_zrobienia" : "zrobione")}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${zrobione ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 hover:border-gray-900"}`}
      >
        {zrobione && <Check size={14} />}
      </button>

      <button onClick={onOtworz} className="min-w-0 flex-1 text-left">
        <p className={`flex items-center gap-1.5 text-sm font-medium ${zrobione ? "text-gray-400 line-through" : "text-gray-900"}`}>
          {zalegle && <AlarmClock size={15} className="shrink-0 text-red-600" aria-label="Zaległe" />}
          <span className="truncate">{z.tytul}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          {test && (
            <span className="rounded bg-amber-100 px-1.5 text-amber-800">
              {z.typ === "sprawdzian" ? "Sprawdzian" : "Kartkówka"}
            </span>
          )}
          {od && (
            <span className="font-medium text-gray-700">
              {od}
              {do_ && `–${do_}`}
            </span>
          )}
          {z.powtarzalne_id && <Repeat size={12} aria-label="Powtarza się" />}
          {z.przedmiot && <span>{z.przedmiot}</span>}
          {zalegle && <span className="text-red-600">z {dzienMiesiac(z.termin)}</span>}
          {wykonawca && <span>· {wykonawca}</span>}
          {podzadania.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} />
              {test ? "umiem " : ""}
              {umiem}/{podzadania.length}
            </span>
          )}
        </p>
      </button>

      {zalegle && !zrobione && (
        <Button size="sm" variant="outline" onClick={() => onPrzenies(z, dzis)}>
          Przenieś na dziś
        </Button>
      )}
      <button
        aria-label="Edytuj zadanie"
        title="Edytuj"
        onClick={onOtworz}
        className="mt-0.5 shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
      >
        <Pencil size={16} />
      </button>
    </li>
  );
}
