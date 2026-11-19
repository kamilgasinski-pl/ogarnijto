"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function StartForm() {
  const [tryb, setTryb] = useState<"nowa" | "dolacz">("nowa");
  const [imie, setImie] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [rola, setRola] = useState<"rodzic" | "uczen">("rodzic");
  const [kod, setKod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    setTrwa(true);
    const supabase = createClient();
    const { error } =
      tryb === "nowa"
        ? await supabase.rpc("utworz_rodzine", { p_nazwa: nazwa, p_imie: imie, p_rola: rola })
        : await supabase.rpc("dolacz_do_rodziny", { p_kod: kod.trim().toUpperCase(), p_imie: imie });
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    // pełne przeładowanie, żeby nie użyć starej, zapamiętanej odpowiedzi serwera
    window.location.assign("/");
  }

  return (
    <Card className="w-full max-w-sm space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-bold">Witaj!</h1>
        <p className="text-gray-500">Załóż rodzinę albo dołącz kodem zaproszenia.</p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={tryb === "nowa" ? "default" : "outline"} onClick={() => setTryb("nowa")}>Nowa rodzina</Button>
        <Button type="button" size="sm" variant={tryb === "dolacz" ? "default" : "outline"} onClick={() => setTryb("dolacz")}>Mam kod</Button>
      </div>
      <form onSubmit={wyslij} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="imie">Twoje imię</Label>
          <Input id="imie" required value={imie} onChange={(e) => setImie(e.target.value)} />
        </div>
        {tryb === "nowa" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="nazwa">Nazwa rodziny</Label>
              <Input id="nazwa" required placeholder="np. Rodzina Kowalskich" value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rola">Jesteś</Label>
              <Select id="rola" value={rola} onChange={(e) => setRola(e.target.value as "rodzic" | "uczen")}>
                <option value="rodzic">Rodzicem</option>
                <option value="uczen">Uczniem</option>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="kod">Kod zaproszenia</Label>
            <Input id="kod" required value={kod} onChange={(e) => setKod(e.target.value)} />
          </div>
        )}
        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <Button type="submit" className="w-full" disabled={trwa}>
          {trwa ? "Chwileczkę…" : tryb === "nowa" ? "Utwórz rodzinę" : "Dołącz"}
        </Button>
      </form>
    </Card>
  );
}
