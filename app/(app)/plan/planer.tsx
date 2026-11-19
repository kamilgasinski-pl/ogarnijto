"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  type Przedmiot,
  type WierszBloku,
} from "@/lib/plan";
import { Arkusz, type Szkic } from "./arkusz";

const PPM = 1.4; // pikseli na minutę
const KROK = 5; // przyciąganie do 5 minut
const DOMYSLNY_CZAS = 45;

type Props = {
  tryb: "tydzien" | "szablon";
  tydzien: string;
  rodzinaId: string;
  dzis: string;
  przedmioty: Przedmiot[];
  bloki: WierszBloku[];
};

type Podglad = { id: string; dzien: number; start: number; koniec: number };

type Przeciaganie = {
  id: string;
  tryb: "przesun" | "rozciagnij";
  dotyk: boolean;
  x0: number;
  y0: number;
  orig: { dzien: number; start: number; koniec: number };
  aktywne: boolean;
  anulowane: boolean;
  timer: number | null;
  ostatni: Podglad | null;
};

function blokujPrzewijanie(e: TouchEvent) {
  if (e.cancelable) e.preventDefault();
}

const przyciagnij = (min: number) => Math.round(min / KROK) * KROK;

export function Planer({ tryb, tydzien, rodzinaId, dzis, przedmioty: p0, bloki: b0 }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [przedmioty, setPrzedmioty] = useState(p0);
  const [bloki, setBloki] = useState<Blok[]>(() => b0.map(zWiersza));
  const [dzien, setDzien] = useState(() => {
    const d = dzienTygodnia(dzis);
    return d <= 5 ? d : 1;
  });
  const [szkic, setSzkic] = useState<Szkic | null>(null);
  const [podglad, setPodglad] = useState<Podglad | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const kolumny = useRef<Record<number, HTMLDivElement | null>>({});
  const drag = useRef<Przeciaganie | null>(null);

  const jestTydzien = tryb === "tydzien";
  const tabela = jestTydzien ? "bloki_planu" : "bloki_szablonu";
  const kolumnyDb = jestTydzien ? KOLUMNY_TYGODNIA : KOLUMNY_SZABLONU;

  // Zakres godzin siatki: co najmniej 7:00–16:00, szerszy, gdy są lekcje poza nim.
  const minStart = Math.min(7 * 60, ...bloki.map((b) => b.start));
  const maxKoniec = Math.max(16 * 60, ...bloki.map((b) => b.koniec));
  const godzOd = Math.floor(minStart / 60) * 60;
  const godzDo = Math.min(24 * 60, Math.ceil(maxKoniec / 60) * 60);
  const wysokosc = (godzDo - godzOd) * PPM;
  const godziny: number[] = [];
  for (let m = godzOd; m <= godzDo; m += 60) godziny.push(m);

  const dni = [1, 2, 3, 4, 5];
  if (bloki.some((b) => b.dzien === 6)) dni.push(6);
  if (bloki.some((b) => b.dzien === 7)) dni.push(7);

  const przedmiotPo = (id: string | null) => przedmioty.find((p) => p.id === id);

  function doWiersza(b: Szkic | Podglad) {
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

  // ---------- przeciąganie ----------

  function zakoncz() {
    const d = drag.current;
    if (d?.timer) window.clearTimeout(d.timer);
    window.removeEventListener("touchmove", blokujPrzewijanie);
    drag.current = null;
    setPodglad(null);
  }

  function aktywuj(d: Przeciaganie) {
    d.aktywne = true;
    if (d.dotyk) {
      window.addEventListener("touchmove", blokujPrzewijanie, { passive: false });
      navigator.vibrate?.(15);
    }
  }

  function start(e: React.PointerEvent<HTMLElement>, b: Blok, t: "przesun" | "rozciagnij") {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const d: Przeciaganie = {
      id: b.id,
      tryb: t,
      dotyk: e.pointerType !== "mouse",
      x0: e.clientX,
      y0: e.clientY,
      orig: { dzien: b.dzien, start: b.start, koniec: b.koniec },
      aktywne: false,
      anulowane: false,
      timer: null,
      ostatni: null,
    };
    drag.current = d;
    if (t === "rozciagnij") aktywuj(d);
    else if (d.dotyk) {
      d.timer = window.setTimeout(() => {
        aktywuj(d);
        setPodglad({ id: b.id, ...d.orig });
      }, 350);
    }
  }

  function ruch(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.anulowane) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.aktywne) {
      if (d.dotyk) {
        // ruch przed długim przytrzymaniem = zwykłe przewijanie strony
        if (Math.hypot(dx, dy) > 8) {
          if (d.timer) window.clearTimeout(d.timer);
          d.anulowane = true;
        }
        return;
      }
      if (Math.hypot(dx, dy) < 4) return;
      aktywuj(d);
    }
    const minuty = przyciagnij(dy / PPM);
    const dl = d.orig.koniec - d.orig.start;
    if (d.tryb === "rozciagnij") {
      const koniec = Math.min(godzDo, Math.max(d.orig.start + 15, przyciagnij(d.orig.koniec + minuty)));
      d.ostatni = { id: d.id, dzien: d.orig.dzien, start: d.orig.start, koniec };
      setPodglad(d.ostatni);
      return;
    }
    const nowyStart = Math.min(godzDo - dl, Math.max(godzOd, d.orig.start + minuty));
    let nowyDzien = d.orig.dzien;
    for (const n of dni) {
      const r = kolumny.current[n]?.getBoundingClientRect();
      if (r && r.width > 0 && e.clientX >= r.left && e.clientX < r.right) nowyDzien = n;
    }
    d.ostatni = { id: d.id, dzien: nowyDzien, start: nowyStart, koniec: nowyStart + dl };
    setPodglad(d.ostatni);
  }

  async function koniecRuchu(e: React.PointerEvent<HTMLElement>, b: Blok) {
    const d = drag.current;
    if (!d) return;
    const bylAktywny = d.aktywne;
    const anulowane = d.anulowane;
    const p = d.ostatni;
    zakoncz();
    if (e.type === "pointercancel" || anulowane) return;
    if (!bylAktywny) {
      if (d.tryb === "przesun") setSzkic({ ...b });
      return;
    }
    if (!p || (p.dzien === b.dzien && p.start === b.start && p.koniec === b.koniec)) return;
    const stare = bloki;
    setBloki((s) =>
      s.map((x) => (x.id === b.id ? { ...x, dzien: p.dzien, start: p.start, koniec: p.koniec } : x)),
    );
    const { error } = await supabase
      .from(tabela)
      .update(doWiersza({ id: b.id, dzien: p.dzien, start: p.start, koniec: p.koniec }))
      .eq("id", b.id);
    if (error) {
      setBloki(stare);
      setBlad(tlumaczBlad(error.message));
    }
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

  const widoczny = (b: Blok): Blok =>
    podglad?.id === b.id ? { ...b, dzien: podglad.dzien, start: podglad.start, koniec: podglad.koniec } : b;

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

      <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* oś godzin */}
        <div className="w-10 shrink-0 border-r border-gray-100 md:w-12">
          <div className="hidden h-9 md:block" />
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
              className={`${dzien === n ? "block" : "hidden"} min-w-0 flex-1 border-r border-gray-100 last:border-r-0 md:block`}
            >
              <div className={`hidden h-9 items-center justify-center text-sm font-medium md:flex ${data === dzis ? "text-gray-900 underline" : "text-gray-600"}`}>
                {DNI[n - 1]}
                {data && <span className="ml-1 text-xs font-normal text-gray-400">{dzienMiesiac(data)}</span>}
              </div>
              <div
                ref={(el) => {
                  kolumny.current[n] = el;
                }}
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
                {bloki
                  .map(widoczny)
                  .filter((b) => b.dzien === n)
                  .map((b) => {
                    const p = przedmiotPo(b.przedmiot_id);
                    const kolor = p?.kolor ?? "#9ca3af";
                    const odwolana = b.status === "odwolana";
                    const przeciagany = podglad?.id === b.id;
                    const etykieta = STATUS_ETYKIETA[b.status];
                    return (
                      <div
                        key={b.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => start(e, b, "przesun")}
                        onPointerMove={ruch}
                        onPointerUp={(e) => koniecRuchu(e, b)}
                        onPointerCancel={(e) => koniecRuchu(e, b)}
                        onContextMenu={(e) => e.preventDefault()}
                        onKeyDown={(e) => e.key === "Enter" && setSzkic({ ...b })}
                        className={`absolute inset-x-0.5 select-none overflow-hidden rounded-md text-xs text-gray-900 ${przeciagany ? "z-20 shadow-lg ring-2 ring-gray-900" : "z-10"} ${b.status === "dodatkowa" ? "border border-dashed border-gray-500" : ""}`}
                        style={{
                          top: (b.start - godzOd) * PPM,
                          height: (b.koniec - b.start) * PPM - 1,
                          backgroundColor: `${kolor}30`,
                          borderLeft: `4px solid ${kolor}`,
                          touchAction: "pan-y",
                          opacity: odwolana ? 0.6 : 1,
                          backgroundImage: odwolana
                            ? "repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.06) 6px 12px)"
                            : undefined,
                        }}
                      >
                        <div className="px-1.5 pt-1">
                          <p className={`truncate font-semibold ${odwolana ? "line-through" : ""}`}>
                            {b.nr_lekcji != null && <span className="mr-1 text-gray-500">{b.nr_lekcji}.</span>}
                            {p?.nazwa ?? "Lekcja"}
                          </p>
                          <p className="truncate text-[11px] text-gray-600">
                            {naCzas(b.start)}–{naCzas(b.koniec)}
                            {b.sala && ` · ${b.sala}`}
                          </p>
                          {etykieta && (
                            <span className="mt-0.5 inline-block rounded bg-white/80 px-1 text-[10px] font-medium">
                              {etykieta}
                            </span>
                          )}
                        </div>
                        <div
                          className="absolute inset-x-0 bottom-0 flex h-4 cursor-ns-resize items-end justify-center pb-0.5"
                          style={{ touchAction: "none" }}
                          onPointerDown={(e) => start(e, b, "rozciagnij")}
                          onPointerMove={ruch}
                          onPointerUp={(e) => koniecRuchu(e, b)}
                          onPointerCancel={(e) => koniecRuchu(e, b)}
                        >
                          <span className="h-1 w-6 rounded-full bg-gray-900/30" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Kliknij puste miejsce, by dodać lekcję. Dotknij lekcji, by ją edytować. Przytrzymaj, by
        przesunąć, a uchwyt na dole rozciąga blok.
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
