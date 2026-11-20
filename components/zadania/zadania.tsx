"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { haslaDla } from "@/lib/motywacje";
import { ArkuszWyjatku } from "@/components/dojazdy/arkusz-wyjatku";
import { IkonaDojazdu } from "@/components/dojazdy/ikona";
import { ZnacznikOsoby as Znacznik } from "@/components/osoba-znacznik";
import { STYL_KIERUNKU } from "@/lib/dojazdy";
import { AlarmClock, Check, ShoppingCart, ChevronDown, ChevronRight, ListChecks, Pencil, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { dodajDni, dzienMiesiac, etykietaDnia } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  KOLUMNY_ZADAN,
  jestMoje,
  jestZalegle,
  dzienWidoku,
  krotkaGodzina,
  kolorOsoby, KOLORY_OSOB, nazwaWykonawcy,
  polaWykonawcy,
  type OsobaMini,
  type Podzadanie,
  type Wykonawca,
  type Zadanie,
} from "@/lib/zadania";
import { ArkuszZadania } from "./arkusz-zadania";

/** Dojazd na konkretny dzień (tylko do odczytu), pokazywany obok zadań. */
export type DojazdWiersz = {
  id: string;
  data: string;
  rodzaj: "autobus" | "samochod";
  kierunek: "odjazd" | "przyjazd";
  tytul: string;
  start: string;
  koniec: string | null;
  przypisano_id: string | null;
  odwolany: boolean;
  zmieniony: boolean;
  maWyjatek: boolean;
  opis?: string | null;
  bylo?: string | null;
};

const KOLORY_KONFETTI = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

/** Nagroda po ukończeniu wszystkich zadań na dziś. Własny obrazek: plik public/nagroda.jpg. */
function Nagroda({ imie }: { imie: string }) {
  const [obrazek, setObrazek] = useState(true);
  const [haslo, setHaslo] = useState<string | null>(null);
  const [konfetti, setKonfetti] = useState<
    { id: number; left: number; dx: number; czas: number; opoznienie: number; kolor: string }[]
  >([]);

  useEffect(() => {
    // Losowanie dopiero po zamontowaniu (bez rozjazdu z renderem serwera).
    const hasla = haslaDla(imie);
    let i = Math.floor(Math.random() * hasla.length);
    try {
      const ostatnie = Number(localStorage.getItem("ogarnijto.motywacja"));
      if (hasla.length > 1 && i === ostatnie) i = (i + 1 + Math.floor(Math.random() * (hasla.length - 1))) % hasla.length;
      localStorage.setItem("ogarnijto.motywacja", String(i));
    } catch {}
    /* eslint-disable react-hooks/set-state-in-effect */
    setHaslo(hasla[i]);
    setKonfetti(
      Array.from({ length: 60 }, (_, id) => ({
        id,
        left: Math.random() * 100,
        dx: Math.round((Math.random() - 0.5) * 200),
        czas: 2.5 + Math.random() * 2.5,
        opoznienie: Math.random() * 1.2,
        kolor: KOLORY_KONFETTI[Math.floor(Math.random() * KOLORY_KONFETTI.length)],
      })),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
    const koniec = setTimeout(() => setKonfetti([]), 6500);
    return () => clearTimeout(koniec);
  }, [imie]);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
      {konfetti.map((k) => (
        <span
          key={k.id}
          className="konfetti"
          aria-hidden
          style={{
            left: `${k.left}%`,
            backgroundColor: k.kolor,
            animationDuration: `${k.czas}s`,
            animationDelay: `${k.opoznienie}s`,
            ["--dx" as string]: `${k.dx}px`,
          }}
        />
      ))}
      <p className="text-4xl motion-safe:animate-bounce" aria-hidden>🏆</p>
      <p className="text-xl font-bold text-emerald-900">Wszystkie zadania ukończone!</p>
      {haslo && <p className="text-emerald-800">{haslo}</p>}
      {obrazek && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/nagroda.jpg"
          alt=""
          onError={() => setObrazek(false)}
          className="mx-auto max-h-64 rounded-lg"
        />
      )}
    </div>
  );
}

function WierszDojazdu({ d, onEdytuj, kolor, imie }: { d: DojazdWiersz; onEdytuj: () => void; kolor?: string | null; imie?: string }) {
  return (
    <li style={kolor ? { borderLeftWidth: 5, borderLeftStyle: "solid", borderLeftColor: kolor } : undefined} className={`flex flex-wrap items-center gap-2 rounded-lg border border-dashed ${STYL_KIERUNKU[d.kierunek].lista} px-3 py-2 text-sm ${d.odwolany ? "opacity-50" : ""}`}>
      <IkonaDojazdu rodzaj={d.rodzaj} kierunek={d.kierunek} size={16} className={`shrink-0 ${STYL_KIERUNKU[d.kierunek].ikona}`} />
      <span className={STYL_KIERUNKU[d.kierunek].czas}>
        {d.start}
        {d.koniec && `–${d.koniec}`}
      </span>
      <span className={`font-medium ${d.odwolany ? "line-through" : ""}`}>{d.tytul}</span>
      {kolor && imie && <Znacznik kolor={kolor} imie={imie} />}
      {d.zmieniony && <span className="rounded bg-amber-100 px-1 text-[11px] text-amber-800">zmiana</span>}
      {d.odwolany && <span className="text-[11px]">odwołany</span>}
      <button
        aria-label="Zmień ten dojazd"
        title="Zmień na ten dzień"
        onClick={onEdytuj}
        className={`ml-auto rounded-full p-1 ${STYL_KIERUNKU[d.kierunek].ikona} ${STYL_KIERUNKU[d.kierunek].hover}`}
      >
        <Pencil size={16} />
      </button>
      {d.opis && <p className="w-full whitespace-pre-line pl-6 text-xs text-gray-500">{d.opis}</p>}
    </li>
  );
}

type Props = {
  zadania: Zadanie[];
  podzadania: Podzadanie[];
  rodzinaId: string;
  osoby: OsobaMini[];
  mojeId: string;
  rola: "uczen" | "rodzic";
  dzis: string;
  jutro: string;
  widok: "pulpit" | "wszystkie";
  /** Zadania z soboty i niedzieli (do licznika "+ N zadań w weekend"). */
  weekend?: { przypisano_id: string | null; wykonawca: Wykonawca }[];
  /** Tydzień pokazywany na pulpicie (poniedziałek–niedziela). */
  tydzien?: { start: string; numer: number; koniec: string; biezacy: boolean };
  /** Dojazdy (stały rozkład po uwzględnieniu wyjątków) na widoczne dni. */
  dojazdy?: DojazdWiersz[];
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
  rola,
  dzis,
  jutro,
  widok,
  weekend = [],
  tydzien,
  dojazdy = [],
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

  // Domyślny widok: dziecko widzi swoje zadania, rodzic wszystkie. Wybór
  // użytkownika jest zapamiętany w tej przeglądarce.
  const [dojazdEdycja, setDojazdEdycja] = useState<DojazdWiersz | null>(null);
  const [filtr, setFiltr] = useState<string>(rola === "uczen" ? "moje" : "wszystkie");
  const kluczFiltra = `ogarnijto.filtr.${mojeId}`;
  useEffect(() => {
    try {
      const f = localStorage.getItem(kluczFiltra);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (f && (f === "moje" || f === "wszystkie" || osoby.some((o) => o.id === f))) setFiltr(f);
    } catch {}
  }, [kluczFiltra, osoby]);
  // Widok tygodnia na pulpicie: domyślnie zwinięty, wybór pamiętany w przeglądarce.
  const [tydzienOtwarty, setTydzienOtwarty] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("ogarnijto.tydzien.otwarty") === "1") setTydzienOtwarty(true);
    } catch {}
  }, []);
  function przelaczTydzien() {
    const nowy = !tydzienOtwarty;
    setTydzienOtwarty(nowy);
    try {
      localStorage.setItem("ogarnijto.tydzien.otwarty", nowy ? "1" : "0");
    } catch {}
  }

  function ustawFiltr(f: string) {
    setFiltr(f);
    try {
      localStorage.setItem(kluczFiltra, f);
    } catch {}
  }

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
    // Zadanie powtarzalne ma już wystąpienie w tym dniu: zaległe łączymy z dzisiejszym, czyli usuwamy duplikat.
    if (error?.code === "23505" && z.powtarzalne_id) {
      const { error: e2 } = await supabase.rpc("pomin_termin", { p_zadanie: z.id });
      if (!e2) {
        setZadania((s) => s.filter((x) => x.id !== z.id));
        return;
      }
    }
    if (error) {
      setZadania((s) => s.map((x) => (x.id === z.id ? z : x)));
      setBlad(tlumaczBlad(error.message));
    }
  }

  // Filtr "Moje" ogranicza wszystkie sekcje poniżej.
  // Filtr: "moje", konkretna osoba (id) albo "wszystkie".
  const osobaFiltru = filtr === "wszystkie" ? null : osoby.find((o) => o.id === (filtr === "moje" ? mojeId : filtr)) ?? null;
  const mojeFiltr = (z: Pick<Zadanie, "przypisano_id" | "wykonawca">) =>
    !osobaFiltru || jestMoje(z, osobaFiltru.id, osobaFiltru.rola);
  const lista0 = zadania.filter(mojeFiltr);
  const widoczne = lista0.filter((z) => pokazWykonane || widok === "pulpit" || z.status === "do_zrobienia");
  const zalegle = lista0.filter((z) => jestZalegle(z, dzis)).sort(sortuj);
  // Dojazdy podlegają temu samemu filtrowi: "Moje" to te przypisane do mnie.
  const dojazdyDnia = (d: string) =>
    dojazdy.filter((x) => x.data === d && (!osobaFiltru || x.przypisano_id === osobaFiltru.id));
  const weekendLiczba = weekend.filter(mojeFiltr).length;
  const ukryte = zadania.length - lista0.length;

  const kolorDla = (id: string | null) => {
    const k = filtr === "wszystkie" && osoby.length > 1 ? kolorOsoby(id, osoby) : null;
    return k ? { kolor: k, imie: osoby.find((o) => o.id === id)?.imie } : {};
  };

  function sekcja(naglowek: string, lista: Zadanie[], pusto?: string, dodatek?: React.ReactNode, doj: DojazdWiersz[] = []) {
    return (
      <section key={naglowek} className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {naglowek} <span className="font-normal text-gray-400">{lista.length > 0 && lista.length}</span>
        </h2>
        {lista.length === 0 && doj.length === 0 ? (
          pusto && <p className="text-sm text-gray-400">{pusto}</p>
        ) : (
          <ul className="space-y-1.5">
            {doj.map((x) => (
              <WierszDojazdu key={x.id + x.data} d={x} onEdytuj={() => setDojazdEdycja(x)} {...kolorDla(x.przypisano_id)} />
            ))}
            {lista.map((z) => (
              <Wiersz
                key={z.id}
                koloruj={filtr === "wszystkie"}
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
      if (i < 5 || lista0.some((z) => z.termin === d) || dojazdyDnia(d).length > 0) dni.push(d);
    }
    return (
      <section className="space-y-3 border-t border-gray-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={przelaczTydzien}
            aria-expanded={tydzienOtwarty}
            className="flex items-center gap-1.5 text-left"
          >
            {tydzienOtwarty ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h2 className="text-lg font-semibold">
              Tydzień {t.numer}{" "}
              <span className="text-sm font-normal text-gray-500">
                {dzienMiesiac(t.start)}–{dzienMiesiac(t.koniec)}
              </span>
            </h2>
          </button>
          {tydzienOtwarty && (
            <div className="flex items-center gap-2">
              <Link href={`/?tydzien=${dodajDni(t.start, -7)}`} className={nawig} aria-label="Poprzedni tydzień">←</Link>
              {!t.biezacy && <Link href="/" className={nawig}>Ten tydzień</Link>}
              <Link href={`/?tydzien=${dodajDni(t.start, 7)}`} className={nawig} aria-label="Następny tydzień">→</Link>
            </div>
          )}
        </div>
        {tydzienOtwarty && dni.map((d) => {
          const lista = lista0.filter((z) => z.termin === d).sort(sortuj);
          const doj = dojazdyDnia(d);
          return (
            <div key={d} className="space-y-1.5">
              <h3 className={`text-sm font-semibold ${d === dzis ? "text-gray-900" : "text-gray-600"}`}>
                {etykietaDnia(d, dzis)}
                {d === dzis || d === jutro ? <span className="ml-1 font-normal text-gray-400">{dzienMiesiac(d)}</span> : null}
              </h3>
              {lista.length === 0 && doj.length === 0 ? (
                <p className="text-sm text-gray-300">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {doj.map((x) => (
                    <WierszDojazdu key={x.id + x.data} d={x} onEdytuj={() => setDojazdEdycja(x)} {...kolorDla(x.przypisano_id)} />
                  ))}
                  {lista.map((z) => (
                    <Wiersz
                      key={z.id}
                      koloruj={filtr === "wszystkie"}
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
    // Do zrobienia dziś: termin dziś albo zadanie z późniejszym terminem, które wypada zrobić już dziś
    // (np. na poniedziałek w niedzielę albo w dniu wybranym przez dziecko).
    const naDzis = (z: Zadanie) => !jestZalegle(z, dzis) && z.termin >= dzis && dzienWidoku(z, dzis) === dzis;
    const dzisL = lista0.filter(naDzis).sort(sortuj);
    const jutroL = lista0.filter((z) => z.termin === jutro && !naDzis(z)).sort(sortuj);
    tresc = (
      <>
        {zalegle.length > 0 && sekcja("Zaległe", zalegle)}
        {zalegle.length === 0 && dzisL.length > 0 && dzisL.every((z) => z.status === "zrobione") && <Nagroda imie={osobaFiltru?.imie ?? osoby.find((o) => o.id === mojeId)?.imie ?? ""} />}
        {sekcja("Dziś", dzisL, "Nic na dziś. Można odpocząć albo dodać zadanie.", undefined, dojazdyDnia(dzis))}
        {sekcja(
          etykietaDnia(jutro, dzis),
          jutroL,
          "Nic zaplanowane.",
          weekendLiczba > 0 && (
            <Link href="/zadania" className="inline-block text-sm text-gray-500 underline">
              + {liczba(weekendLiczba)} w weekend
            </Link>
          ),
          dojazdyDnia(jutro),
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
  const arkuszDojazdu = dojazdEdycja && (
    <ArkuszWyjatku
      key={dojazdEdycja.id + dojazdEdycja.data}
      onZamknij={() => setDojazdEdycja(null)}
      cel={{
        rodzinaId,
        dojazdId: dojazdEdycja.id,
        tytul: dojazdEdycja.tytul,
        data: dojazdEdycja.data,
        start: dojazdEdycja.start,
        koniec: dojazdEdycja.koniec,
        odwolany: dojazdEdycja.odwolany,
        maWyjatek: dojazdEdycja.maWyjatek,
      }}
    />
  );

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

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Pokaż:</span>
        <div className="flex rounded-full border border-gray-300 bg-white p-0.5">
          {[
            { wartosc: "moje", etykieta: "Moje" },
            ...osoby.filter((o) => o.id !== mojeId).map((o) => ({ wartosc: o.id, etykieta: o.imie })),
            { wartosc: "wszystkie", etykieta: "Wszystkie" },
          ].map((f) => (
            <button
              key={f.wartosc}
              onClick={() => ustawFiltr(f.wartosc)}
              className={`rounded-full px-4 py-1 ${filtr === f.wartosc ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
            >
              {f.etykieta}
            </button>
          ))}
        </div>
        {filtr === "wszystkie" && osoby.length > 1 && (
          <span className="flex flex-wrap items-center gap-2">
            {osoby.map((o, i) => (
              <Znacznik key={o.id} kolor={KOLORY_OSOB[i % KOLORY_OSOB.length]} imie={o.imie} />
            ))}
          </span>
        )}
        {filtr !== "wszystkie" && ukryte > 0 && (
          <span className="text-gray-400">
            ({ukryte} {ukryte === 1 ? "zadanie innej osoby ukryte" : "zadań innych osób ukrytych"})
          </span>
        )}
        <Link
          href={`/druk/zadania?zakres=dzis&kto=${filtr}`}
          target="_blank"
          className="ml-auto rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100"
        >
          Drukuj / PDF
        </Link>
      </div>

      {tresc}
      {arkuszDojazdu}

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
  koloruj,
  onStatus,
  onPrzenies,
  onOtworz,
}: {
  koloruj?: boolean;
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
  const kolor = koloruj && osoby.length > 1 ? kolorOsoby(z.przypisano_id, osoby) : null;
  const od = krotkaGodzina(z.godz_start);
  const do_ = krotkaGodzina(z.godz_koniec);

  return (
    <li
      style={kolor ? { borderLeftWidth: 5, borderLeftColor: kolor } : undefined}
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
          {z.kategoria === "zakupy" && <ShoppingCart size={13} aria-label="Lista zakupów" className="text-gray-700" />}
          {z.kategoria === "zakupy" && z.sklep && <span className="font-medium text-gray-700">{z.sklep}</span>}
          {z.powtarzalne_id && <Repeat size={12} aria-label="Powtarza się" />}
          {z.przedmiot && <span>{z.przedmiot}</span>}
          {zalegle && <span className="text-red-600">z {dzienMiesiac(z.termin)}</span>}
          {!zalegle && z.termin > dzis && <span className="font-medium text-amber-700">termin: {etykietaDnia(z.termin, dzis)}</span>}
          {wykonawca && (kolor ? <Znacznik kolor={kolor} imie={wykonawca} /> : <span>· {wykonawca}</span>)}
          {podzadania.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} />
              {test ? "umiem " : z.kategoria === "zakupy" ? "kupione " : ""}
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
