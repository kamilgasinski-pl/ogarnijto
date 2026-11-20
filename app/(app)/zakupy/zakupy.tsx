"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { etykietaDnia, dzienMiesiac } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { ZnacznikOsoby } from "@/components/osoba-znacznik";
import { ListaZakupow } from "@/components/zakupy/lista-zakupow";
import { KOLUMNY_ZADAN, kolorOsoby, polaWykonawcy, type OsobaMini, type Podzadanie, type Zadanie } from "@/lib/zadania";

type Props = {
  listy: Zadanie[];
  pozycje: Podzadanie[];
  osoby: OsobaMini[];
  rodzinaId: string;
  mojeId: string;
  dzis: string;
};

export function Zakupy({ listy: l0, pozycje: p0, osoby, rodzinaId, mojeId, dzis }: Props) {
  const [supabase] = useState(() => createClient());
  const [listy, setListy] = useState(l0);
  const [pozycje, setPozycje] = useState(p0);
  const [tytul, setTytul] = useState("Zakupy");
  const [termin, setTermin] = useState(dzis);
  const [kto, setKto] = useState(""); // id osoby robiącej zakupy, puste = jeszcze nie wiadomo
  const [sklep, setSklep] = useState("");
  // Dotychczasowe sklepy podpowiadają się przy wpisywaniu.
  const sklepy = [...new Set(listy.map((z) => z.sklep).filter((s): s is string => !!s))];
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  const otwarte = listy.filter((z) => z.status === "do_zrobienia").sort((a, b) => a.termin.localeCompare(b.termin));
  const zakonczone = listy.filter((z) => z.status === "zrobione").sort((a, b) => b.termin.localeCompare(a.termin));
  const pozycjeListy = (id: string) => pozycje.filter((p) => p.zadanie_id === id);
  const ustawPozycje = (id: string, lista: Podzadanie[]) =>
    setPozycje((s) => [...s.filter((p) => p.zadanie_id !== id), ...lista]);

  async function utworz(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    setTrwa(true);
    // Wykonawca "oba": lista jest wspólna, a przypisana osoba to ta, która robi zakupy.
    const pola = kto ? { ...polaWykonawcy(kto, osoby), wykonawca: "oba" as const } : { przypisano_id: null, wykonawca: "oba" as const };
    const { data, error } = await supabase
      .from("zadania")
      .insert({ rodzina_id: rodzinaId, tytul: tytul.trim() || "Zakupy", kategoria: "zakupy", termin, sklep: sklep.trim() || null, ...pola })
      .select(KOLUMNY_ZADAN)
      .single();
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    setListy((s) => [...s, data as unknown as Zadanie]);
    setTytul("Zakupy");
    setSklep("");
  }

  async function ustawSklep(z: Zadanie, wartosc: string) {
    const s = wartosc.trim() || null;
    if (s === z.sklep) return;
    setListy((l) => l.map((x) => (x.id === z.id ? { ...x, sklep: s } : x)));
    const { error } = await supabase.from("zadania").update({ sklep: s }).eq("id", z.id);
    if (error) {
      setListy((l) => l.map((x) => (x.id === z.id ? z : x)));
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function ustawStatus(z: Zadanie, status: Zadanie["status"]) {
    setListy((s) => s.map((x) => (x.id === z.id ? { ...x, status } : x)));
    const { error } = await supabase.from("zadania").update({ status }).eq("id", z.id);
    if (error) {
      setListy((s) => s.map((x) => (x.id === z.id ? z : x)));
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function ustawKto(z: Zadanie, id: string) {
    const pola = id ? { ...polaWykonawcy(id, osoby), wykonawca: "oba" as const } : { przypisano_id: null, wykonawca: "oba" as const };
    setListy((s) => s.map((x) => (x.id === z.id ? { ...x, ...pola } : x)));
    const { error } = await supabase.from("zadania").update(pola).eq("id", z.id);
    if (error) {
      setListy((s) => s.map((x) => (x.id === z.id ? z : x)));
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function usun(z: Zadanie) {
    if (!confirm("Usunąć tę listę zakupów razem ze wszystkimi pozycjami?")) return;
    const { error } = await supabase.from("zadania").delete().eq("id", z.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    setListy((s) => s.filter((x) => x.id !== z.id));
  }

  function karta(z: Zadanie, zakonczona = false) {
    const lista = pozycjeListy(z.id);
    const robi = osoby.find((o) => o.id === z.przypisano_id);
    const k = osoby.length > 1 ? kolorOsoby(z.przypisano_id, osoby) : null;
    return (
      <Card key={z.id} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingCart size={18} /> {z.tytul}
            </h2>
            <p className="text-sm text-gray-500">
              {etykietaDnia(z.termin, dzis)} {dzienMiesiac(z.termin)}
              {z.termin < dzis && !zakonczona && <span className="ml-1 font-medium text-red-600">· po terminie</span>}
            </p>
          </div>
          {zakonczona ? (
            <Button size="sm" variant="outline" onClick={() => ustawStatus(z, "do_zrobienia")}>Przywróć</Button>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Robi zakupy:</span>
              <Select className="h-9 w-40" value={z.przypisano_id ?? ""} onChange={(e) => ustawKto(z, e.target.value)} aria-label="Kto robi zakupy">
                <option value="">jeszcze nie wiadomo</option>
                {osoby.map((o) => (
                  <option key={o.id} value={o.id}>{o.imie}{o.id === mojeId ? " (ja)" : ""}</option>
                ))}
              </Select>
              {robi && k && <ZnacznikOsoby kolor={k} imie={robi.imie} />}
            </div>
          )}
        </div>

        {zakonczona ? (
          z.sklep && <p className="text-sm text-gray-500">Sklep: {z.sklep}</p>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Sklep:</span>
            <Input
              key={z.sklep ?? ""}
              list="zk-sklepy"
              className="h-9 w-56"
              placeholder="gdzie robimy zakupy?"
              defaultValue={z.sklep ?? ""}
              onBlur={(e) => ustawSklep(z, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
              aria-label="Sklep"
            />
          </div>
        )}

        <ListaZakupow zadanieId={z.id} rodzinaId={rodzinaId} pozycje={lista} osoby={osoby} onZmiana={(l) => ustawPozycje(z.id, l)} />

        {!zakonczona && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => ustawStatus(z, "zrobione")}>Zakończ zakupy</Button>
            <Button size="sm" variant="outline" onClick={() => usun(z)}>Usuń listę</Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {blad && <p className="text-sm text-red-600">{blad}</p>}
      <datalist id="zk-sklepy">
        {sklepy.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Card>
        <form onSubmit={utworz} className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_11rem_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="zk-tytul">Nowa lista zakupów</Label>
            <Input id="zk-tytul" value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder="np. Zakupy na weekend" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zk-sklep">Sklep</Label>
            <Input id="zk-sklep" list="zk-sklepy" value={sklep} onChange={(e) => setSklep(e.target.value)} placeholder="np. Biedronka" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zk-data">Na dzień</Label>
            <Input id="zk-data" type="date" required value={termin} onChange={(e) => setTermin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zk-kto">Robi zakupy</Label>
            <Select id="zk-kto" value={kto} onChange={(e) => setKto(e.target.value)}>
              <option value="">jeszcze nie wiadomo</option>
              {osoby.map((o) => (
                <option key={o.id} value={o.id}>{o.imie}{o.id === mojeId ? " (ja)" : ""}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={trwa}>{trwa ? "Tworzę…" : "Utwórz listę"}</Button>
        </form>
      </Card>

      {otwarte.length === 0 ? (
        <p className="text-sm text-gray-400">Brak otwartych list. Utwórz nową, a pojawi się u całej rodziny.</p>
      ) : (
        otwarte.map((z) => karta(z))
      )}

      {zakonczone.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm text-gray-500">Zakończone ({zakonczone.length})</summary>
          <div className="mt-3 space-y-3">{zakonczone.map((z) => karta(z, true))}</div>
        </details>
      )}
    </div>
  );
}
