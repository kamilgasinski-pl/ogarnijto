"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZnacznikOsoby } from "@/components/osoba-znacznik";
import { KOLUMNY_PODZADAN, kolorOsoby, type OsobaMini, type Podzadanie } from "@/lib/zadania";

type Props = {
  zadanieId: string;
  rodzinaId: string;
  pozycje: Podzadanie[];
  osoby: OsobaMini[];
  onZmiana: (lista: Podzadanie[]) => void;
};

const ODSWIEZANIE_MS = 10_000;

/**
 * Wspólna lista zakupów: każdy członek rodziny dopisuje, edytuje i odhacza pozycje, a przy pozycji
 * widać, kto ją zgłosił. Zmiany innych osób pojawiają się same (odświeżanie co kilka sekund).
 */
export function ListaZakupow({ zadanieId, rodzinaId, pozycje, osoby, onZmiana }: Props) {
  const [supabase] = useState(() => createClient());
  const [tresc, setTresc] = useState("");
  const [ilosc, setIlosc] = useState("");
  const [edycja, setEdycja] = useState<{ id: string; tresc: string; ilosc: string } | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const ref = useRef(pozycje);
  const zajety = useRef(false);
  const onZmianaRef = useRef(onZmiana);
  useEffect(() => {
    ref.current = pozycje;
    onZmianaRef.current = onZmiana;
  });

  const odswiez = useCallback(async () => {
    if (zajety.current) return;
    const { data } = await supabase.from("podzadania").select(KOLUMNY_PODZADAN).eq("zadanie_id", zadanieId).order("kolejnosc");
    if (!data || zajety.current) return;
    if (JSON.stringify(data) !== JSON.stringify(ref.current)) onZmianaRef.current(data as Podzadanie[]);
  }, [supabase, zadanieId]);

  useEffect(() => {
    const tik = () => document.visibilityState === "visible" && odswiez();
    const t = setInterval(tik, ODSWIEZANIE_MS);
    document.addEventListener("visibilitychange", tik);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tik);
    };
  }, [odswiez]);

  async function zapisz<T>(praca: () => Promise<T>) {
    zajety.current = true;
    try {
      return await praca();
    } finally {
      zajety.current = false;
    }
  }

  async function dodaj() {
    const linie = tresc.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    if (linie.length === 0) return;
    setBlad(null);
    const start = pozycje.reduce((m, p) => Math.max(m, p.kolejnosc), 0);
    const wiersze = linie.map((t, i) => ({
      rodzina_id: rodzinaId,
      zadanie_id: zadanieId,
      tresc: t,
      ilosc: linie.length === 1 ? ilosc.trim() || null : null,
      kolejnosc: start + i + 1,
    }));
    const { data, error } = await zapisz(async () => supabase.from("podzadania").insert(wiersze).select(KOLUMNY_PODZADAN));
    if (error) return setBlad(tlumaczBlad(error.message));
    onZmiana([...pozycje, ...((data ?? []) as Podzadanie[])]);
    setTresc("");
    setIlosc("");
  }

  async function przelacz(p: Podzadanie) {
    onZmiana(pozycje.map((x) => (x.id === p.id ? { ...x, wykonane: !x.wykonane } : x)));
    const { error } = await zapisz(async () => supabase.from("podzadania").update({ wykonane: !p.wykonane }).eq("id", p.id));
    if (error) {
      onZmiana(pozycje);
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function zapiszEdycje() {
    if (!edycja) return;
    const t = edycja.tresc.trim();
    if (!t) return setBlad("Nazwa pozycji nie może być pusta.");
    const pola = { tresc: t, ilosc: edycja.ilosc.trim() || null };
    const { error } = await zapisz(async () => supabase.from("podzadania").update(pola).eq("id", edycja.id));
    if (error) return setBlad(tlumaczBlad(error.message));
    onZmiana(pozycje.map((x) => (x.id === edycja.id ? { ...x, ...pola } : x)));
    setEdycja(null);
    setBlad(null);
  }

  async function usun(p: Podzadanie) {
    const { error } = await zapisz(async () => supabase.from("podzadania").delete().eq("id", p.id));
    if (error) return setBlad(tlumaczBlad(error.message));
    onZmiana(pozycje.filter((x) => x.id !== p.id));
  }

  const posortowane = [...pozycje].sort((a, b) => Number(a.wykonane) - Number(b.wykonane) || a.kolejnosc - b.kolejnosc);
  const kupione = pozycje.filter((p) => p.wykonane).length;
  const imie = (id: string | null) => osoby.find((o) => o.id === id)?.imie ?? null;

  // Kto ile zgłosił: żeby osoba robiąca zakupy widziała, od kogo jest lista.
  const zgloszenia = new Map<string, number>();
  for (const p of pozycje) if (p.dodal) zgloszenia.set(p.dodal, (zgloszenia.get(p.dodal) ?? 0) + 1);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs text-gray-500">
          Kupione {kupione}/{pozycje.length}
        </span>
        {zgloszenia.size > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            {[...zgloszenia.entries()].map(([id, n]) => {
              const k = osoby.length > 1 ? kolorOsoby(id, osoby) : null;
              const nazwa = `${imie(id) ?? "?"} (${n})`;
              return k ? <ZnacznikOsoby key={id} kolor={k} imie={nazwa} /> : <span key={id} className="text-xs text-gray-500">{nazwa}</span>;
            })}
          </span>
        )}
      </div>

      {posortowane.length === 0 ? (
        <p className="text-sm text-gray-400">Lista jest pusta. Dopisz, co trzeba kupić.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {posortowane.map((p) => {
            const k = osoby.length > 1 ? kolorOsoby(p.dodal, osoby) : null;
            const kto = imie(p.dodal);
            const edytowana = edycja?.id === p.id;
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 px-2.5 py-2 text-sm"
                style={k ? { borderLeft: `4px solid ${k}` } : undefined}
              >
                <button
                  type="button"
                  aria-label={p.wykonane ? "Oznacz jako niekupione" : "Oznacz jako kupione"}
                  onClick={() => przelacz(p)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${p.wykonane ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}
                >
                  {p.wykonane && <Check size={14} />}
                </button>
                {edytowana ? (
                  <form
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      zapiszEdycje();
                    }}
                  >
                    <Input
                      autoFocus
                      className="h-9 min-w-0 flex-1"
                      value={edycja.tresc}
                      onChange={(e) => setEdycja({ ...edycja, tresc: e.target.value })}
                      aria-label="Nazwa pozycji"
                    />
                    <Input
                      className="h-9 w-24"
                      placeholder="ilość"
                      value={edycja.ilosc}
                      onChange={(e) => setEdycja({ ...edycja, ilosc: e.target.value })}
                      aria-label="Ilość"
                    />
                    <Button type="submit" size="sm">OK</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEdycja(null)}>Anuluj</Button>
                  </form>
                ) : (
                  <>
                    <span className={`min-w-0 flex-1 ${p.wykonane ? "text-gray-400 line-through" : ""}`}>
                      <span className="font-medium">{p.tresc}</span>
                      {p.ilosc && <span className="ml-1.5 text-gray-500">· {p.ilosc}</span>}
                    </span>
                    {kto && (k ? <ZnacznikOsoby kolor={k} imie={kto} /> : <span className="text-xs text-gray-500">{kto}</span>)}
                    <button
                      type="button"
                      aria-label="Edytuj pozycję"
                      title="Edytuj"
                      onClick={() => setEdycja({ id: p.id, tresc: p.tresc, ilosc: p.ilosc ?? "" })}
                      className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Usuń pozycję"
                      title="Usuń"
                      onClick={() => usun(p)}
                      className="rounded-full p-1 text-gray-300 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          className="min-w-0 flex-1"
          placeholder="Co kupić?"
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              dodaj();
            }
          }}
          aria-label="Nowa pozycja"
        />
        <Input
          className="w-24"
          placeholder="ilość"
          value={ilosc}
          onChange={(e) => setIlosc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              dodaj();
            }
          }}
          aria-label="Ilość"
        />
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Dodaj pozycję" onClick={dodaj}>
          <Plus size={16} />
        </Button>
      </div>
      {blad && <p className="text-sm text-red-600">{blad}</p>}
    </div>
  );
}
