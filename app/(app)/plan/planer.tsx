"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { IkonaDojazdu } from "@/components/dojazdy/ikona";
import { STYL_KIERUNKU } from "@/lib/dojazdy";
import { createClient } from "@/lib/supabase/client";
import { ZnacznikOsoby } from "@/components/osoba-znacznik";
import { kolorOsoby, type OsobaMini } from "@/lib/zadania";
import { tlumaczBlad } from "@/lib/bledy";
import { dodajDni, dzienMiesiac, dzienTygodnia } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  DNI,
  DNI_KROTKO,
  KOLUMNY_SZABLONU,
  KOLUMNY_TYGODNIA,
  naCzas,
  zWiersza,
  type Blok,
  type DojazdNaPlanie,
  type Przedmiot,
  type WierszBloku,
} from "@/lib/plan";
import { Arkusz, type Szkic } from "./arkusz";
import { ArkuszWyjatku, type CelWyjatku } from "@/components/dojazdy/arkusz-wyjatku";

const PPM_NORMALNIE = 1.75; // pikseli na minutę
export const SZEROKOSC_ZDJECIA = 1400; // zdjęcie planu ma proporcje A4 poziomo (297:210)
const WYSOKOSC_ZDJECIA = Math.round(SZEROKOSC_ZDJECIA * (210 / 297));
const NAGLOWKI_ZDJECIA = 84; // tytuł + nagłówki dni
const KROK = 5; // przyciąganie do 5 minut
const DOMYSLNY_CZAS = 45;

export type TestNaPlanie = { termin: string; etykieta: string; przedmiot: string | null; tytul: string };

const norm = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

/** Czy zadanie dotyczy przedmiotu: dokładna nazwa albo słowa kluczowe (np. „z niemieckiego” → Język Niemiecki). */
function dotyczyPrzedmiotu(t: TestNaPlanie, nazwa: string): boolean {
  if (norm(t.przedmiot) === nazwa) return true;
  const tekst = norm(t.przedmiot) || norm(t.tytul);
  const slowa = nazwa.split(/\s+/).filter((s) => s !== "język" && s !== "jezyk" && s.length >= 2);
  if (slowa.length === 0) return tekst.includes(nazwa);
  return slowa.every((s) => {
    const rdzen = s.length > 5 ? s.slice(0, 5) : s;
    return tekst.split(/[^\p{L}\d]+/u).some((w) => (s.length <= 3 ? w === s : w.startsWith(rdzen)));
  });
}

type Props = {
  tryb: "tydzien" | "szablon";
  tydzien: string;
  rodzinaId: string;
  dzis: string;
  przedmioty: Przedmiot[];
  testy?: TestNaPlanie[];
  bloki: WierszBloku[];
  dojazdy?: DojazdNaPlanie[];
  osoby?: OsobaMini[];
};


export function Planer({ tryb, tydzien, rodzinaId, dzis, przedmioty: p0, testy = [], bloki: b0, dojazdy = [], osoby = [] }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [przedmioty, setPrzedmioty] = useState(p0);
  const [bloki, setBloki] = useState<Blok[]>(() => b0.map(zWiersza));
  const [dzien, setDzien] = useState(() => dzienTygodnia(dzis));
  const [szkic, setSzkic] = useState<Szkic | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  // Na czas robienia zdjęcia plan jest ściśnięty pionowo do proporcji A4 poziomo.
  const [zdj, setZdj] = useState(false);
  const [wyjatek, setWyjatek] = useState<CelWyjatku | null>(null);
  useEffect(() => {
    const f = (e: Event) => setZdj((e as CustomEvent<boolean>).detail);
    window.addEventListener("planer-zdjecie", f);
    return () => window.removeEventListener("planer-zdjecie", f);
  }, []);

  const jestTydzien = tryb === "tydzien";
  const tabela = jestTydzien ? "bloki_planu" : "bloki_szablonu";
  const kolumnyDb = jestTydzien ? KOLUMNY_TYGODNIA : KOLUMNY_SZABLONU;

  // Zakres godzin siatki: co najmniej 7:00–16:00, szerszy, gdy są lekcje poza nim.
  const minStart = Math.min(7 * 60, ...bloki.map((b) => b.start), ...dojazdy.map((d) => d.start));
  const maxKoniec = Math.max(16 * 60, ...bloki.map((b) => b.koniec), ...dojazdy.map((d) => d.koniec));
  const godzOd = Math.floor(minStart / 60) * 60;
  const godzDo = Math.min(24 * 60, Math.ceil(maxKoniec / 60) * 60);
  const PPM = zdj ? (WYSOKOSC_ZDJECIA - NAGLOWKI_ZDJECIA) / (godzDo - godzOd) : PPM_NORMALNIE;
  const wysokosc = (godzDo - godzOd) * PPM;
  /** Ile minut dojazd zajmuje na planie (nie dłużej niż 45 min i nie mniej niż minimalna wysokość bloku). */
  const minutyDojazdu = (d: DojazdNaPlanie) => Math.max(Math.min(d.koniec - d.start, 45), (d.notatka ? 48 : 22) / PPM);
  const godziny: number[] = [];
  for (let m = godzOd; m <= godzDo; m += 60) godziny.push(m);

  const dni = [1, 2, 3, 4, 5, 6, 7]; // cały tydzień; weekend można planować tak samo jak dni szkolne

  // Zajęcia są szare, a pasek z lewej ma kolor dziecka (uczeń z listy osób).
  const dziecko = osoby.find((o) => o.rola === "uczen");
  const kolorDziecka = (dziecko && kolorOsoby(dziecko.id, osoby)) ?? "#6b7280";

  const przedmiotPo = (id: string | null) => przedmioty.find((p) => p.id === id);

  function doWiersza(b: Szkic) {
    const w: Record<string, unknown> = {
      dzien: b.dzien,
      godz_start: naCzas(b.start),
      godz_koniec: naCzas(b.koniec),
    };
    if ("sala" in b) {
      w.przedmiot_id = b.przedmiot_id;
      w.sala = b.sala || null;
      w.nauczyciel = b.nauczyciel || null;
      w.nr_lekcji = b.nr_lekcji;
      if (jestTydzien) {
        w.status = b.status;
        w.uwagi = b.uwagi || null;
      }
    }
    return w;
  }

  async function przeladuj() {
    let q = supabase.from(tabela).select(kolumnyDb);
    if (jestTydzien) q = q.eq("tydzien_start", tydzien);
    const { data, error } = await q;
    if (error) return setBlad(tlumaczBlad(error.message));
    setBloki(((data ?? []) as unknown as WierszBloku[]).map(zWiersza));
  }

  async function zapiszSzkic(s: Szkic): Promise<string | null> {
    setBlad(null);
    if (s.id) {
      const { error } = await supabase.from(tabela).update(doWiersza(s)).eq("id", s.id);
      if (error) return tlumaczBlad(error.message);
      setBloki((stare) => stare.map((b) => (b.id === s.id ? { ...b, ...s, id: b.id } : b)));
    } else {
      const wiersz: Record<string, unknown> = { ...doWiersza(s), rodzina_id: rodzinaId };
      if (jestTydzien) wiersz.tydzien_start = tydzien;
      const { data, error } = await supabase.from(tabela).insert(wiersz).select(kolumnyDb).single();
      if (error) return tlumaczBlad(error.message);
      setBloki((stare) => [...stare, zWiersza(data as unknown as WierszBloku)]);
    }
    setSzkic(null);
    return null;
  }

  async function usun() {
    if (!szkic?.id) return;
    const id = szkic.id;
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) return setBlad(tlumaczBlad(error.message));
    setBloki((stare) => stare.filter((b) => b.id !== id));
    setSzkic(null);
  }

  async function nowyPrzedmiot(nazwa: string, kolor: string) {
    const { data, error } = await supabase
      .from("przedmioty")
      .insert({ rodzina_id: rodzinaId, nazwa, kolor })
      .select("id, nazwa, kolor")
      .single();
    if (error) {
      setBlad(
        error.code === "23505" ? "Taki przedmiot już istnieje." : tlumaczBlad(error.message),
      );
      return null;
    }
    const p = data as Przedmiot;
    setPrzedmioty((s) => [...s, p].sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl")));
    return p;
  }

  function klikWPuste(e: React.MouseEvent<HTMLDivElement>, n: number) {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const start = Math.max(
      godzOd,
      Math.min(24 * 60 - DOMYSLNY_CZAS, Math.floor((godzOd + (e.clientY - r.top) / PPM) / KROK) * KROK),
    );
    setSzkic({
      dzien: n,
      start,
      koniec: start + DOMYSLNY_CZAS,
      przedmiot_id: null,
      sala: "",
      nauczyciel: "",
      nr_lekcji: null,
      status: "normalna",
      uwagi: "",
    });
  }

  // ---------- akcje tygodnia ----------

  async function zapiszJakoSzablon() {
    if (!confirm("Zapisać ten tydzień jako szablon? Zastąpi obecny szablon.")) return;
    const { error } = await supabase.rpc("zapisz_szablon", { p_tydzien_start: tydzien });
    if (error) return setBlad(tlumaczBlad(error.message));
    setBlad(null);
    alert("Szablon zapisany.");
  }

  async function przywrocZSzablonu() {
    if (!confirm("Przywrócić ten tydzień do szablonu? Zmiany tego tygodnia zostaną usunięte.")) return;
    const { error } = await supabase.rpc("zastosuj_szablon", { p_tydzien_start: tydzien });
    if (error) return setBlad(tlumaczBlad(error.message));
    setBlad(null);
    await przeladuj();
    router.refresh();
  }

  // ---------- render ----------

  return (
    <div className="space-y-3">
      {!jestTydzien && (
        <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-600">
          Edytujesz szablon. Nie zmienia on tygodni, które już istnieją. Dotyczy kolejnych nowych
          tygodni albo użyj „Przywróć z szablonu” w widoku tygodnia.
        </p>
      )}
      {blad && <p className="text-sm text-red-600">{blad}</p>}

      {/* zakładki dni na telefonie */}
      <div className="flex gap-1 md:hidden">
        {dni.map((n) => (
          <button
            key={n}
            onClick={() => setDzien(n)}
            className={`flex-1 rounded-full py-1.5 text-sm ${dzien === n ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-700"}`}
          >
            {DNI_KROTKO[n - 1]}
            {jestTydzien && (
              <span className="block text-[10px] opacity-70">{dzienMiesiac(dodajDni(tydzien, n - 1))}</span>
            )}
          </button>
        ))}
      </div>

      <div id="planer-zdjecie" className="group/z bg-white">
        <p className="hidden px-2 pb-1 pt-2 text-base font-semibold text-gray-900 group-data-[zdjecie]/z:block">
          {jestTydzien
            ? `Plan zajęć · ${dzienMiesiac(tydzien)}–${dzienMiesiac(dodajDni(tydzien, 6))}`
            : "Plan zajęć · szablon tygodnia"}
        </p>
      <div className="flex md:overflow-x-auto md:overflow-y-hidden md:overscroll-x-contain rounded-xl border border-gray-200 bg-white group-data-[zdjecie]/z:w-full group-data-[zdjecie]/z:overflow-visible">
        {/* oś godzin */}
        <div className="w-10 shrink-0 border-r border-gray-100 md:w-12">
          <div className="hidden h-9 group-data-[zdjecie]/z:block! md:block" />
          <div className="relative" style={{ height: wysokosc }}>
            {godziny.map((m) => (
              <span
                key={m}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400"
                style={{ top: (m - godzOd) * PPM }}
              >
                {String(m / 60).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {dni.map((n) => {
          const data = jestTydzien ? dodajDni(tydzien, n - 1) : null;
          return (
            <div
              key={n}
              className={`${dzien === n ? "block" : "hidden"} group-data-[zdjecie]/z:block! min-w-0 flex-1 border-r border-gray-100 last:border-r-0 md:block md:min-w-[8.5rem]`}
            >
              <div className={`hidden h-9 items-center justify-center text-sm font-medium group-data-[zdjecie]/z:flex! md:flex ${data === dzis ? "text-gray-900 underline" : "text-gray-600"}`}>
                {DNI[n - 1]}
                {data && <span className="ml-1 text-xs font-normal text-gray-400">{dzienMiesiac(data)}</span>}
              </div>
              <div
                className="relative cursor-cell"
                style={{ height: wysokosc }}
                onClick={(e) => klikWPuste(e, n)}
              >
                {godziny.map((m) => (
                  <div
                    key={m}
                    className="pointer-events-none absolute inset-x-0 border-t border-gray-100"
                    style={{ top: (m - godzOd) * PPM }}
                  />
                ))}
                {dojazdy
                  .filter((d) => d.dzien === n)
                  .map((d) => {
                    // Dojazd to punkt w czasie: długi przedział nie może zasłaniać lekcji pod spodem.
                    const wys = minutyDojazdu(d) * PPM - 1;
                    // Dojazd nachodzący na lekcję: dzielimy kolumnę na dwa pasy, żeby nic się nie zasłaniało.
                    const nakladaSie = bloki.some((b) => b.dzien === n && b.start < d.start + minutyDojazdu(d) && b.koniec > d.start);
                    const imieOsoby = osoby.find((o) => o.id === d.przypisano_id)?.imie ?? null;
                    const kolorOs = osoby.length > 1 ? kolorOsoby(d.przypisano_id, osoby) : null;
                    const czas = `${naCzas(d.start)}${d.koniec - d.start > 30 ? `–${naCzas(d.koniec)}` : ""}`;
                    return (
                      <div
                        key={d.id}
                        className={`pointer-events-none absolute ${nakladaSie ? "left-[46%] right-0.5 z-20" : "inset-x-0.5 z-[5]"} overflow-hidden rounded-md border border-dashed ${STYL_KIERUNKU[d.kierunek].planer} px-1.5 text-xs shadow-sm ${d.odwolany ? "text-gray-500" : ""}`}
                        style={{
                          top: (d.start - godzOd) * PPM,
                          height: wys,
                          // Tło zawsze pełne (nieprzezroczyste), żeby lekcja pod spodem nie prześwitywała.
                          backgroundColor: d.odwolany ? "#f3f4f6" : d.kierunek === "odjazd" ? "#fff7ed" : "#f0f9ff",
                          // Zmiana względem stałego rozkładu: niebiesko-szare paski.
                          ...(d.zmieniony && !d.odwolany
                            ? { backgroundImage: "repeating-linear-gradient(45deg, rgba(59,130,246,0.25) 0 7px, rgba(107,114,128,0.25) 7px 14px)" }
                            : {}),
                          ...(kolorOs ? { borderLeftWidth: 5, borderLeftStyle: "solid", borderLeftColor: kolorOs } : {}),
                        }}
                      >
                        {d.wyjatek && (
                          <button
                            type="button"
                            data-bez-zdjecia
                            aria-label="Zmień ten dojazd tylko w tym dniu"
                            title="Zmień tylko ten dzień"
                            onClick={(e) => {
                              e.stopPropagation();
                              const w = d.wyjatek!;
                              setWyjatek({ rodzinaId, dojazdId: w.dojazdId, tytul: d.tytul, data: w.data, start: w.start, koniec: w.koniec, odwolany: d.odwolany, maWyjatek: w.maWyjatek, notatka: d.notatka });
                            }}
                            className="pointer-events-auto absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm ring-1 ring-gray-300 hover:bg-white"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {wys >= 36 ? (
                          <div className="pr-6 pt-0.5">
                            <p className={`flex items-center gap-1 font-semibold leading-tight ${d.odwolany ? "line-through" : ""}`}>
                              <IkonaDojazdu rodzaj={d.rodzaj} kierunek={d.kierunek} size={12} className="shrink-0" />
                              <span className="break-words">{d.tytul}</span>
                            </p>
                            <p className={`flex flex-wrap items-center gap-x-1 text-[11px] ${STYL_KIERUNKU[d.kierunek].czas}`}>
                              <span>
                                {czas}
                                {d.odwolany && " · odwołany"}
                              </span>
                              {imieOsoby && (kolorOs ? <ZnacznikOsoby kolor={kolorOs} imie={imieOsoby} /> : <span>· {imieOsoby}</span>)}
                            </p>
                            {d.notatka && <p className="whitespace-pre-line text-[10px] leading-tight text-gray-500">{d.notatka}</p>}
                          </div>
                        ) : (
                          <p className={`flex h-full items-center gap-1 ${d.wyjatek ? "pr-6" : ""} font-semibold leading-tight ${d.odwolany ? "line-through" : ""}`}>
                            <IkonaDojazdu rodzaj={d.rodzaj} kierunek={d.kierunek} size={12} className="shrink-0" />
                            <span className="min-w-0 break-words">
                              {naCzas(d.start)} {d.tytul}
                            </span>
                            {imieOsoby && (
                              <span className="shrink-0 font-bold" style={kolorOs ? { color: kolorOs } : undefined}>
                                {imieOsoby}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                {bloki
                  .filter((b) => b.dzien === n)
                  .map((b) => {
                    const p = przedmiotPo(b.przedmiot_id);
                    const kolor = kolorDziecka;
                    const odwolana = b.status === "odwolana";
                    const etykieta = STATUS_ETYKIETA[b.status];
                    // Sprawdzian, kartkówka lub odp. ustna z tego przedmiotu w tym dniu.
                    const dataBloku = jestTydzien ? dodajDni(tydzien, b.dzien - 1) : null;
                    const nazwaPrzedmiotu = norm(p?.nazwa);
                    const maDojazd = dojazdy.some((d) => d.dzien === n && d.start < b.koniec && d.start + minutyDojazdu(d) > b.start);
                    const test = dataBloku && nazwaPrzedmiotu
                      ? testy.find((t) => t.termin === dataBloku && dotyczyPrzedmiotu(t, nazwaPrzedmiotu))
                      : undefined;
                    return (
                      <div
                        key={b.id}
                        className={`absolute ${maDojazd ? "left-0.5 right-[55%]" : "inset-x-0.5"} z-10 overflow-hidden rounded-md text-xs text-gray-900 ${b.status === "dodatkowa" ? "border border-dashed border-gray-500" : ""}`}
                        style={{
                          top: (b.start - godzOd) * PPM,
                          height: (b.koniec - b.start) * PPM - 1,
                          backgroundColor: "#6b728022",
                          borderLeft: `5px solid ${kolor}`,
                          opacity: odwolana ? 0.6 : 1,
                          backgroundImage: odwolana
                            ? "repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.06) 6px 12px)"
                            : test
                              ? "repeating-linear-gradient(45deg, rgba(250,204,21,0.45) 0 8px, rgba(156,163,175,0.35) 8px 16px)"
                              : undefined,
                        }}
                      >
                        <div className="px-1.5 pt-1">
                          <p className={`break-words font-semibold leading-tight ${odwolana ? "line-through" : ""}`}>
                            {b.nr_lekcji != null && <span className="mr-1 text-gray-500">{b.nr_lekcji}.</span>}
                            {p?.nazwa ?? "Lekcja"}
                            {test && (
                              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 align-middle text-[11px] font-black leading-none text-white" title={test.etykieta}>
                                !
                              </span>
                            )}
                          </p>
                          <p className="break-words text-[11px] leading-tight text-gray-600">
                            {naCzas(b.start)}–{naCzas(b.koniec)}
                            {b.sala && ` · ${b.sala}`}
                          </p>
                          {test && (
                            <span className="mt-0.5 mr-1 inline-block rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">
                              {test.etykieta}
                            </span>
                          )}
                          {etykieta && (
                            <span className="mt-0.5 inline-block rounded bg-white/80 px-1 text-[10px] font-medium">
                              {etykieta}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          data-bez-zdjecia
                          onClick={(e) => {
                            e.stopPropagation();
                            setSzkic({ ...b });
                          }}
                          aria-label="Edytuj lekcję"
                          title="Edytuj"
                          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm ring-1 ring-gray-300 hover:bg-white"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <p className="text-xs text-gray-500">
        Dotknij pustego miejsca, by dodać lekcję. Aby zmienić lekcję, użyj ołówka w jej bloku.
      </p>

      {jestTydzien && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={zapiszJakoSzablon}>
            Zapisz jako szablon
          </Button>
          <Button variant="outline" size="sm" onClick={przywrocZSzablonu}>
            Przywróć z szablonu
          </Button>
        </div>
      )}

      {wyjatek && <ArkuszWyjatku key={wyjatek.dojazdId + wyjatek.data} cel={wyjatek} onZamknij={() => setWyjatek(null)} />}
      {szkic && (
        <Arkusz
          key={szkic.id ?? "nowy"}
          szkic={szkic}
          przedmioty={przedmioty}
          tydzien={jestTydzien}
          onZapisz={zapiszSzkic}
          onUsun={szkic.id ? usun : undefined}
          onNowyPrzedmiot={nowyPrzedmiot}
          onZamknij={() => setSzkic(null)}
        />
      )}
    </div>
  );
}

const STATUS_ETYKIETA: Record<string, string | null> = {
  normalna: null,
  odwolana: "odwołana",
  zastepstwo: "zastępstwo",
  przesunieta: "przesunięta",
  dodatkowa: "dodatkowa",
};
