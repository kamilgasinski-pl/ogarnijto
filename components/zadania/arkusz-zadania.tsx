"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  KATEGORIE,
  TYPY,
  WYKONAWCY,
  type Kategoria,
  type Podzadanie,
  type Typ,
  type Wykonawca,
  type Zadanie,
} from "@/lib/zadania";

type Props = {
  zadanie: Zadanie;
  podzadania: Podzadanie[];
  rodzinaId: string;
  onZapisz: (z: Zadanie) => void;
  onUsun: (id: string) => void;
  onPodzadania: (zadanieId: string, lista: Podzadanie[]) => void;
  onZamknij: () => void;
};

export function ArkuszZadania({
  zadanie,
  podzadania,
  rodzinaId,
  onZapisz,
  onUsun,
  onPodzadania,
  onZamknij,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [z, setZ] = useState(zadanie);
  const [lista, setLista] = useState(podzadania);
  const [nowe, setNowe] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  const test = z.typ !== "zwykle";
  const umiem = lista.filter((p) => p.wykonane).length;

  function zmienListe(l: Podzadanie[]) {
    setLista(l);
    onPodzadania(zadanie.id, l);
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!z.tytul.trim()) return setBlad("Podaj tytuł zadania.");
    setTrwa(true);
    const { error } = await supabase
      .from("zadania")
      .update({
        tytul: z.tytul.trim(),
        typ: z.typ,
        termin: z.termin,
        przedmiot: z.przedmiot?.trim() || null,
        kategoria: z.kategoria,
        wykonawca: z.wykonawca,
        opis: z.opis?.trim() || null,
      })
      .eq("id", z.id);
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    onZapisz({ ...z, tytul: z.tytul.trim() });
    onZamknij();
  }

  async function usunZadanie() {
    if (!confirm("Usunąć to zadanie razem z podzadaniami?")) return;
    const { error } = await supabase.from("zadania").delete().eq("id", z.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    onUsun(z.id);
    onZamknij();
  }

  async function dodajPodzadania() {
    // Wklejona lista (po jednej pozycji w wierszu) dodaje wiele podzadań naraz.
    const teksty = nowe.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    if (teksty.length === 0) return;
    const start = lista.reduce((m, p) => Math.max(m, p.kolejnosc), 0);
    const wiersze = teksty.map((tresc, i) => ({
      rodzina_id: rodzinaId,
      zadanie_id: z.id,
      tresc,
      kolejnosc: start + i + 1,
    }));
    const { data, error } = await supabase
      .from("podzadania")
      .insert(wiersze)
      .select("id, zadanie_id, tresc, kolejnosc, wykonane");
    if (error) return setBlad(tlumaczBlad(error.message));
    zmienListe([...lista, ...((data ?? []) as Podzadanie[])]);
    setNowe("");
  }

  async function przelaczPodzadanie(p: Podzadanie) {
    const nowa = lista.map((x) => (x.id === p.id ? { ...x, wykonane: !x.wykonane } : x));
    zmienListe(nowa);
    const { error } = await supabase
      .from("podzadania")
      .update({ wykonane: !p.wykonane })
      .eq("id", p.id);
    if (error) {
      zmienListe(lista);
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function usunPodzadanie(p: Podzadanie) {
    const { error } = await supabase.from("podzadania").delete().eq("id", p.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    zmienListe(lista.filter((x) => x.id !== p.id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={(e) => e.target === e.currentTarget && onZamknij()}
    >
      <form
        onSubmit={zapisz}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zadanie</h2>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Usuń zadanie" className="text-gray-400 hover:text-red-600" onClick={usunZadanie}>
              <Trash2 size={18} />
            </button>
            <button type="button" aria-label="Zamknij" className="text-gray-400 hover:text-gray-900" onClick={onZamknij}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tytul">Tytuł</Label>
          <Input id="tytul" value={z.tytul} onChange={(e) => setZ({ ...z, tytul: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="typ">Rodzaj</Label>
            <Select id="typ" value={z.typ} onChange={(e) => setZ({ ...z, typ: e.target.value as Typ })}>
              {TYPY.map((t) => (
                <option key={t.wartosc} value={t.wartosc}>{t.etykieta}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="termin">Termin</Label>
            <Input id="termin" type="date" required value={z.termin} onChange={(e) => setZ({ ...z, termin: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="przedmiot">Przedmiot</Label>
            <Input id="przedmiot" value={z.przedmiot ?? ""} onChange={(e) => setZ({ ...z, przedmiot: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kategoria">Kategoria</Label>
            <Select id="kategoria" value={z.kategoria} onChange={(e) => setZ({ ...z, kategoria: e.target.value as Kategoria })}>
              {KATEGORIE.map((k) => (
                <option key={k.wartosc} value={k.wartosc}>{k.etykieta}</option>
              ))}
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="wykonawca">Kto ma to zrobić</Label>
            <Select id="wykonawca" value={z.wykonawca} onChange={(e) => setZ({ ...z, wykonawca: e.target.value as Wykonawca })}>
              {WYKONAWCY.map((w) => (
                <option key={w.wartosc} value={w.wartosc}>{w.etykieta}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opis">Opis</Label>
          <Textarea id="opis" value={z.opis ?? ""} onChange={(e) => setZ({ ...z, opis: e.target.value })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>{test ? "Umiem (zakres materiału)" : "Podzadania"}</Label>
            {lista.length > 0 && (
              <span className="text-xs text-gray-500">
                {umiem}/{lista.length}
              </span>
            )}
          </div>
          <ul className="space-y-1">
            {lista.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  aria-label={p.wykonane ? "Odznacz" : "Zaznacz"}
                  onClick={() => przelaczPodzadanie(p)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${p.wykonane ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}
                >
                  {p.wykonane && <Check size={14} />}
                </button>
                <span className={`flex-1 ${p.wykonane ? "text-gray-400 line-through" : ""}`}>{p.tresc}</span>
                <button type="button" aria-label="Usuń podzadanie" className="text-gray-300 hover:text-red-600" onClick={() => usunPodzadanie(p)}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Textarea
              rows={1}
              className="min-h-10"
              placeholder="Dodaj pozycję (kilka linii = kilka pozycji)"
              value={nowe}
              onChange={(e) => setNowe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  dodajPodzadania();
                }
              }}
            />
            <Button type="button" variant="outline" size="icon" className="h-10 w-10" aria-label="Dodaj" onClick={dodajPodzadania}>
              <Plus size={16} />
            </Button>
          </div>
        </div>

        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={trwa}>
            {trwa ? "Zapisuję…" : "Zapisz"}
          </Button>
          <Button type="button" variant="outline" onClick={onZamknij}>Zamknij</Button>
        </div>
      </form>
    </div>
  );
}
