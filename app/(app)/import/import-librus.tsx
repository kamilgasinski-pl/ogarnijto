"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { kluczDedup, parsujTekst } from "@/lib/librus";
import { rozpoznajTekst } from "@/lib/ocr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { TYPY, type Typ } from "@/lib/zadania";

type Pozycja = {
  id: number;
  zaznacz: boolean;
  istnieje: boolean;
  tytul: string;
  typ: Typ;
  termin: string;
  przedmiot: string;
  nr_lekcji: string;
  nauczyciel: string;
  opis: string;
  podzadania: string; // jedna pozycja w wierszu
};

type Props = { rodzinaId: string; dzis: string; znanePrzedmioty: string[] };

export function ImportLibrus({ rodzinaId, dzis, znanePrzedmioty }: Props) {
  const [supabase] = useState(() => createClient());
  const [tekst, setTekst] = useState("");
  const [zrodlo, setZrodlo] = useState<"wklejka" | "screen">("wklejka");
  const [obraz, setObraz] = useState<string | null>(null);
  const [postep, setPostep] = useState<number | null>(null);
  const [pozycje, setPozycje] = useState<Pozycja[]>([]);
  const [blad, setBlad] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);
  const licznik = useRef(0);

  async function przetworz(t: string) {
    setBlad(null);
    setInfo(null);
    const wpisy = parsujTekst(t, dzis, znanePrzedmioty);
    if (wpisy.length === 0) {
      setPozycje([]);
      return setBlad("Nie znalazłem żadnego wpisu. Wklej tekst albo zrzut ekranu.");
    }
    const klucze = wpisy.map((w) => kluczDedup(w));
    const { data } = await supabase.from("zadania").select("klucz_dedup").in("klucz_dedup", klucze);
    const istniejace = new Set((data ?? []).map((r) => r.klucz_dedup as string));
    setPozycje(
      wpisy.map((w, i) => {
        const istnieje = istniejace.has(klucze[i]);
        return {
          id: ++licznik.current,
          zaznacz: !istnieje && !!w.termin,
          istnieje,
          tytul: w.tytul,
          typ: w.typ,
          termin: w.termin ?? "",
          przedmiot: w.przedmiot ?? "",
          nr_lekcji: w.nr_lekcji?.toString() ?? "",
          nauczyciel: w.nauczyciel ?? "",
          opis: w.opis,
          podzadania: w.podzadania.join("\n"),
        };
      }),
    );
  }

  async function odczytajObraz(plik: Blob) {
    setBlad(null);
    setInfo(null);
    setZrodlo("screen");
    setObraz((stary) => {
      if (stary) URL.revokeObjectURL(stary);
      return URL.createObjectURL(plik);
    });
    setPostep(0);
    try {
      const wynik = await rozpoznajTekst(plik, setPostep);
      setTekst(wynik);
      await przetworz(wynik);
    } catch (e) {
      setBlad(`Nie udało się odczytać obrazu${e instanceof Error ? `: ${e.message}` : "."}`);
    } finally {
      setPostep(null);
    }
  }

  // Ctrl+V z zrzutem ekranu (Print Screen / Win+Shift+S) w dowolnym miejscu strony.
  useEffect(() => {
    function wklej(e: ClipboardEvent) {
      const plik = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (plik) {
        e.preventDefault();
        void odczytajObraz(plik);
      }
    }
    document.addEventListener("paste", wklej);
    return () => document.removeEventListener("paste", wklej);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function zmien(id: number, zmiany: Partial<Pozycja>) {
    setPozycje((s) => s.map((p) => (p.id === id ? { ...p, ...zmiany } : p)));
  }

  async function zapisz() {
    const wybrane = pozycje.filter((p) => p.zaznacz);
    if (wybrane.some((p) => !p.termin)) return setBlad("Uzupełnij termin we wszystkich zaznaczonych wpisach.");
    setBlad(null);
    setTrwa(true);
    let dodane = 0;
    for (const p of wybrane) {
      const nr = p.nr_lekcji === "" ? null : Number(p.nr_lekcji);
      const { data, error } = await supabase
        .from("zadania")
        .insert({
          rodzina_id: rodzinaId,
          tytul: p.tytul.trim() || "Zadanie",
          typ: p.typ,
          termin: p.termin,
          przedmiot: p.przedmiot.trim() || null,
          nauczyciel: p.nauczyciel.trim() || null,
          nr_lekcji: nr,
          opis: p.opis.trim() || null,
          kategoria: "lekcje",
          wykonawca: "dziecko",
          zrodlo,
          klucz_dedup: kluczDedup({ typ: p.typ, przedmiot: p.przedmiot.trim() || null, termin: p.termin, nr_lekcji: nr }),
        })
        .select("id")
        .single();
      if (error) {
        setTrwa(false);
        return setBlad(
          error.code === "23505"
            ? `„${p.tytul}” już istnieje w zadaniach.`
            : tlumaczBlad(error.message),
        );
      }
      const tematy = p.podzadania.split("\n").map((t) => t.trim()).filter(Boolean);
      if (tematy.length > 0) {
        const { error: e2 } = await supabase.from("podzadania").insert(
          tematy.map((tresc, i) => ({
            rodzina_id: rodzinaId,
            zadanie_id: data.id as string,
            tresc,
            kolejnosc: i + 1,
          })),
        );
        if (e2) {
          setTrwa(false);
          return setBlad(tlumaczBlad(e2.message));
        }
      }
      dodane++;
    }
    setTrwa(false);
    setPozycje([]);
    setTekst("");
    setObraz(null);
    setInfo(`Dodano ${dodane} ${dodane === 1 ? "zadanie" : "zadań"}.`);
  }

  const zaznaczone = pozycje.filter((p) => p.zaznacz).length;

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <label
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 hover:border-gray-500"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.type.startsWith("image/")) void odczytajObraz(f);
          }}
        >
          <span className="font-medium text-gray-900">Wklej zrzut ekranu (Ctrl+V)</span>
          <span>albo przeciągnij obraz tutaj, albo kliknij i wybierz plik</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void odczytajObraz(f);
              e.target.value = "";
            }}
          />
        </label>

        {postep !== null && (
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Rozpoznawanie tekstu… {Math.round(postep * 100)}%</p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-gray-900 transition-all" style={{ width: `${postep * 100}%` }} />
            </div>
          </div>
        )}
        {obraz && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={obraz} alt="Wklejony zrzut ekranu" className="max-h-48 rounded-lg border border-gray-200" />
        )}

        <div className="space-y-1.5">
          <Label htmlFor="tekst">Tekst wpisu (rozpoznany ze zrzutu albo wklejony)</Label>
          <Textarea
            id="tekst"
            rows={6}
            placeholder="Wklej tu tekst skopiowany z Librusa…"
            value={tekst}
            onChange={(e) => {
              setTekst(e.target.value);
              setZrodlo("wklejka");
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => przetworz(tekst)} disabled={!tekst.trim()}>
            Przetwórz tekst
          </Button>
        </div>
      </Card>

      {blad && <p className="text-sm text-red-600">{blad}</p>}
      {info && (
        <p className="text-sm text-green-700">
          {info} <Link href="/zadania" className="underline">Zobacz zadania</Link>
        </p>
      )}

      {pozycje.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Podgląd ({pozycje.length})</h2>
          <p className="text-sm text-gray-500">Sprawdź i popraw dane przed dodaniem. Zadania cząstkowe wpisuj po jednym w wierszu.</p>
          {pozycje.map((p) => (
            <Card key={p.id} className={`space-y-3 ${p.zaznacz ? "" : "opacity-60"}`}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={p.zaznacz} onChange={(e) => zmien(p.id, { zaznacz: e.target.checked })} />
                Dodaj to zadanie
                {p.istnieje && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">już istnieje</span>}
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Tytuł</Label>
                  <Input value={p.tytul} onChange={(e) => zmien(p.id, { tytul: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rodzaj</Label>
                  <Select value={p.typ} onChange={(e) => zmien(p.id, { typ: e.target.value as Typ })}>
                    {TYPY.map((t) => (
                      <option key={t.wartosc} value={t.wartosc}>{t.etykieta}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Termin</Label>
                  <Input type="date" value={p.termin} onChange={(e) => zmien(p.id, { termin: e.target.value })} />
                  {!p.termin && <p className="text-xs text-red-600">Nie znalazłem daty. Wpisz ją.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Przedmiot</Label>
                  <Input value={p.przedmiot} onChange={(e) => zmien(p.id, { przedmiot: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nr lekcji</Label>
                  <Input type="number" min={0} max={20} value={p.nr_lekcji} onChange={(e) => zmien(p.id, { nr_lekcji: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Opis</Label>
                  <Input value={p.opis} onChange={(e) => zmien(p.id, { opis: e.target.value })} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Zadania cząstkowe (lista „umiem”)</Label>
                  <Textarea rows={Math.min(10, Math.max(3, p.podzadania.split("\n").length))} value={p.podzadania} onChange={(e) => zmien(p.id, { podzadania: e.target.value })} />
                </div>
              </div>
            </Card>
          ))}
          <Button onClick={zapisz} disabled={trwa || zaznaczone === 0}>
            {trwa ? "Dodaję…" : `Dodaj zaznaczone (${zaznaczone})`}
          </Button>
        </div>
      )}
    </div>
  );
}
