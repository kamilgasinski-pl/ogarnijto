"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { dzienMiesiac, dzienTygodnia } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Czas } from "@/components/ui/czas";
import { Label, Textarea } from "@/components/ui/input";
import { DNI_KROTKO } from "@/lib/zadania";

export type CelWyjatku = {
  rodzinaId: string;
  dojazdId: string;
  tytul: string;
  data: string;
  start: string; // HH:MM, po uwzględnieniu ewentualnej zmiany
  koniec: string | null;
  odwolany: boolean;
  maWyjatek: boolean;
  notatka?: string | null;
};

/** Zmiana pojedynczego dnia dojazdu: inna godzina, odwołanie albo powrót do standardu. */
export function ArkuszWyjatku({ cel, onZamknij }: { cel: CelWyjatku; onZamknij: () => void }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [od, setOd] = useState(cel.start);
  const [do_, setDo] = useState(cel.koniec ?? "");
  const [notatka, setNotatka] = useState(cel.notatka ?? "");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function zapisz(pola: { odwolany: boolean; godz_start: string | null; godz_koniec: string | null }) {
    setBlad(null);
    setTrwa(true);
    const { error } = await supabase
      .from("dojazdy_wyjatki")
      .upsert({ rodzina_id: cel.rodzinaId, dojazd_id: cel.dojazdId, data: cel.data, notatka: notatka.trim() || null, ...pola }, { onConflict: "dojazd_id,data" });
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    onZamknij();
    router.refresh();
  }

  async function przywroc() {
    setBlad(null);
    setTrwa(true);
    const { error } = await supabase.from("dojazdy_wyjatki").delete().eq("dojazd_id", cel.dojazdId).eq("data", cel.data);
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    onZamknij();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={(e) => e.target === e.currentTarget && onZamknij()}>
      <div className="w-full space-y-4 rounded-t-2xl bg-white p-5 md:max-w-md md:rounded-2xl">
        <h2 className="text-lg font-semibold">
          {cel.tytul}
          <span className="block text-sm font-normal text-gray-500">
            {DNI_KROTKO[dzienTygodnia(cel.data) - 1]} {dzienMiesiac(cel.data)} · zmiana tylko na ten dzień
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Godzina od</Label>
            <Czas wartosc={od} onZmien={setOd} />
          </div>
          <div className="space-y-1.5">
            <Label>Godzina do</Label>
            <Czas opcjonalny wartosc={do_} onZmien={setDo} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notatka-wyjatku">Notatka do tej zmiany (opcjonalnie)</Label>
          <Textarea id="notatka-wyjatku" rows={2} value={notatka} onChange={(e) => setNotatka(e.target.value)} placeholder="np. odbiera babcia, zajęcia krócej" />
        </div>
        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={trwa}
            onClick={() => {
              if (do_ && do_ <= od) return setBlad("Koniec musi być później niż początek.");
              zapisz({ odwolany: false, godz_start: od, godz_koniec: do_ || null });
            }}
          >
            Zapisz godzinę
          </Button>
          {!cel.odwolany && (
            <Button variant="outline" disabled={trwa} onClick={() => zapisz({ odwolany: true, godz_start: null, godz_koniec: null })}>
              Odwołaj ten dzień
            </Button>
          )}
          {cel.maWyjatek && (
            <Button variant="outline" disabled={trwa} onClick={przywroc}>
              Przywróć standard
            </Button>
          )}
          <Button variant="outline" onClick={onZamknij}>Zamknij</Button>
        </div>
      </div>
    </div>
  );
}
