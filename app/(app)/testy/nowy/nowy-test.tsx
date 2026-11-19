"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { rozpoznajTekst } from "@/lib/ocr";
import { DOMYSLNE, generujTest, type Parametry, type WynikGeneracji } from "@/lib/testy";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { TestPodglad } from "@/components/testy-podglad";

export function NowyTest({ rodzinaId, rola }: { rodzinaId: string; rola: "uczen" | "rodzic" }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [pliki, setPliki] = useState<File[]>([]);
  const [tekst, setTekst] = useState("");
  const [postep, setPostep] = useState<{ nr: number; z: number; u: number } | null>(null);
  const [tytul, setTytul] = useState("");
  const [przedmiot, setPrzedmiot] = useState("");
  const [param, setParam] = useState<Parametry>(DOMYSLNE);
  const [wynik, setWynik] = useState<WynikGeneracji | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function odczytaj() {
    setBlad(null);
    try {
      let calosc = tekst;
      for (let i = 0; i < pliki.length; i++) {
        setPostep({ nr: i + 1, z: pliki.length, u: 0 });
        const t = await rozpoznajTekst(pliki[i], (u) => setPostep({ nr: i + 1, z: pliki.length, u }), { pasRodzaju: false });
        calosc += (calosc ? "\n\n" : "") + t;
      }
      setTekst(calosc);
      setPliki([]);
    } catch {
      setBlad("Nie udało się odczytać zdjęcia. Spróbuj wyraźniejszego zdjęcia albo wklej tekst ręcznie.");
    } finally {
      setPostep(null);
    }
  }

  function generuj() {
    setBlad(null);
    const w = generujTest(tekst, param, Math.floor(Math.random() * 2 ** 31));
    if (w.pytania.length === 0) return setBlad(w.uwagi[0] ?? "Nie udało się ułożyć pytań z tego tekstu.");
    setWynik(w);
  }

  async function zapisz() {
    if (!wynik) return;
    if (!tytul.trim()) return setBlad("Podaj tytuł testu, np. „Biologia, komórka roślinna”.");
    setBlad(null);
    setTrwa(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("testy").insert({
      id,
      rodzina_id: rodzinaId,
      tytul: tytul.trim(),
      przedmiot: przedmiot.trim() || null,
      pytania: wynik.pytania,
    });
    if (error) {
      setTrwa(false);
      return setBlad(tlumaczBlad(error.message));
    }
    const { error: e2 } = await supabase
      .from("testy_klucz")
      .insert({ test_id: id, rodzina_id: rodzinaId, odpowiedzi: wynik.odpowiedzi });
    setTrwa(false);
    if (e2) return setBlad(tlumaczBlad(e2.message));
    router.push(`/testy/${id}`);
  }

  const liczba = (k: keyof Parametry, etykieta: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{etykieta}</Label>
      <Input
        id={k}
        type="number"
        min={0}
        max={30}
        value={param[k]}
        onChange={(e) => setParam({ ...param, [k]: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">1. Zdjęcia rozdziału</h2>
        <p className="text-sm text-gray-500">
          Zrób proste, wyraźne zdjęcia stron, bez cienia i pod prostym kątem. Rozpoznawanie tekstu
          dzieje się na tym urządzeniu, zdjęcia nigdzie nie są wysyłane.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPliki(Array.from(e.target.files ?? []))}
          className="block w-full text-sm"
        />
        <Button onClick={odczytaj} disabled={pliki.length === 0 || postep !== null}>
          {pliki.length > 0 ? `Odczytaj tekst (${pliki.length})` : "Odczytaj tekst"}
        </Button>
        {postep && (
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              Zdjęcie {postep.nr} z {postep.z} · {Math.round(postep.u * 100)}%
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-gray-900 transition-all" style={{ width: `${postep.u * 100}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">2. Tekst do testu</h2>
        <p className="text-sm text-gray-500">
          Popraw błędy z odczytu, usuń nieistotne fragmenty (ćwiczenia, podpisy zdjęć). Tekst możesz
          też wkleić. Im więcej pełnych zdań, tym lepszy test.
        </p>
        <Textarea rows={12} value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Tutaj pojawi się tekst z zdjęć…" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tytul">Tytuł testu</Label>
            <Input id="tytul" value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder="np. Komórka roślinna" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="przedmiot">Przedmiot</Label>
            <Input id="przedmiot" value={przedmiot} onChange={(e) => setPrzedmiot(e.target.value)} placeholder="np. Biologia" />
          </div>
          {liczba("wybor", "Pytań wyboru (A–D)")}
          {liczba("luki", "Luk do uzupełnienia")}
          {liczba("pf", "Prawda / fałsz")}
          {liczba("otwarte", "Pytań otwartych")}
        </div>
        <Button onClick={generuj} disabled={tekst.trim().length < 50}>
          {wynik ? "Wygeneruj inny zestaw" : "Wygeneruj test"}
        </Button>
      </section>

      {blad && <p className="text-sm text-red-600">{blad}</p>}

      {wynik && (
        <section className="space-y-3">
          <h2 className="font-semibold">3. Podgląd ({wynik.pytania.length} pytań)</h2>
          {wynik.uwagi.length > 0 && <p className="text-sm text-amber-700">{wynik.uwagi.join(" ")}</p>}
          <TestPodglad pytania={wynik.pytania} odpowiedzi={rola === "rodzic" ? wynik.odpowiedzi : undefined} />
          <div className="flex gap-2">
            <Button onClick={zapisz} disabled={trwa}>{trwa ? "Zapisuję…" : "Zapisz test"}</Button>
            <Button variant="outline" onClick={generuj}>Inny zestaw</Button>
          </div>
        </section>
      )}
    </div>
  );
}
