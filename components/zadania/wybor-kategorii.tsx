"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Input, Select } from "@/components/ui/input";
import { KATEGORIE, TYPY, type Kategoria } from "@/lib/zadania";

type Wlasna = { id: string; nazwa: string };

/**
 * Lista kategorii: sprawdzian / kartkówka / odp. ustna (opcjonalnie), kategorie wbudowane
 * oraz własne kategorie rodziny, które można tu dodać i usunąć.
 */
export function WyborKategorii({
  id,
  wartosc,
  onZmien,
  rodzinaId,
  zTestami = true,
}: {
  id: string;
  wartosc: Kategoria;
  onZmien: (k: Kategoria) => void;
  rodzinaId: string;
  zTestami?: boolean;
}) {
  const [supabase] = useState(() => createClient());
  const [wlasne, setWlasne] = useState<Wlasna[]>([]);
  const [edycja, setEdycja] = useState(false);
  const [nowa, setNowa] = useState("");
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktywny = true;
    supabase
      .from("kategorie_wlasne")
      .select("id, nazwa")
      .order("nazwa")
      .then(({ data }) => {
        if (aktywny) setWlasne((data ?? []) as Wlasna[]);
      });
    return () => {
      aktywny = false;
    };
  }, [supabase]);

  const wbudowane = [...(zTestami ? TYPY.filter((t) => t.wartosc !== "zwykle") : []), ...KATEGORIE];
  // Zapisana kategoria mogła zostać usunięta z listy – nadal ją pokazujemy.
  const brakuje =
    !wbudowane.some((k) => k.wartosc === wartosc) && !wlasne.some((k) => k.nazwa === wartosc) && wartosc;

  async function dodaj() {
    const nazwa = nowa.trim().replace(/\s+/g, " ");
    if (!nazwa) return;
    setBlad(null);
    const zajeta =
      wbudowane.some((k) => k.etykieta.toLowerCase() === nazwa.toLowerCase()) ||
      wlasne.some((k) => k.nazwa.toLowerCase() === nazwa.toLowerCase());
    if (zajeta) return setBlad("Taka kategoria już istnieje.");
    const { data, error } = await supabase
      .from("kategorie_wlasne")
      .insert({ rodzina_id: rodzinaId, nazwa })
      .select("id, nazwa")
      .single();
    if (error) return setBlad(tlumaczBlad(error.message));
    setWlasne((l) => [...l, data as Wlasna].sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl")));
    onZmien(nazwa);
    setNowa("");
  }

  async function usun(k: Wlasna) {
    if (!confirm(`Usunąć kategorię „${k.nazwa}”? Zadania, które jej używają, zachowają ten opis.`)) return;
    const { error } = await supabase.from("kategorie_wlasne").delete().eq("id", k.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    setWlasne((l) => l.filter((x) => x.id !== k.id));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select id={id} value={wartosc} onChange={(e) => onZmien(e.target.value)} className="flex-1">
          {wbudowane.map((k) => (
            <option key={k.wartosc} value={k.wartosc}>{k.etykieta}</option>
          ))}
          {wlasne.length > 0 && (
            <optgroup label="Własne">
              {wlasne.map((k) => (
                <option key={k.id} value={k.nazwa}>{k.nazwa}</option>
              ))}
            </optgroup>
          )}
          {brakuje && <option value={wartosc}>{wartosc}</option>}
        </Select>
        <button
          type="button"
          onClick={() => setEdycja((v) => !v)}
          className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          {edycja ? "Gotowe" : "Własne…"}
        </button>
      </div>
      {edycja && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
          <div className="flex gap-2">
            <Input
              placeholder="Nazwa nowej kategorii"
              maxLength={40}
              value={nowa}
              onChange={(e) => setNowa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dodaj();
                }
              }}
            />
            <button
              type="button"
              onClick={dodaj}
              aria-label="Dodaj kategorię"
              className="flex shrink-0 items-center gap-1 rounded-full bg-gray-900 px-3 text-sm font-medium text-white"
            >
              <Plus size={15} /> Dodaj
            </button>
          </div>
          {wlasne.length > 0 && (
            <ul className="space-y-1.5">
              {wlasne.map((k) => (
                <li key={k.id} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white py-1 pl-2.5 pr-1 text-sm">
                  <span className="mr-auto font-medium">{k.nazwa}</span>
                  <button type="button" aria-label={`Usuń kategorię ${k.nazwa}`} onClick={() => usun(k)} className="rounded-full p-1 text-gray-500 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {blad && <p className="text-xs text-red-600">{blad}</p>}
        </div>
      )}
    </div>
  );
}
