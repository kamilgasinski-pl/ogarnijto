"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { rozpoznajBloki } from "@/lib/ocr";
import { DOMYSLNE, generujTest, type Odpowiedz, type Parametry, type Pytanie, type WynikGeneracji } from "@/lib/testy";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { TestPodglad } from "@/components/testy-podglad";
import { Kadrowanie } from "@/components/testy-kadrowanie";
import { EdytorPytania } from "@/components/testy-edytor";

export function NowyTest({ rodzinaId, rola, przedmioty }: { rodzinaId: string; rola: "uczen" | "rodzic"; przedmioty: string[] }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [zdjecia, setZdjecia] = useState<File[]>([]);
  const [kadruj, setKadruj] = useState<File | null>(null);
  const [bloki, setBloki] = useState<{ id: number; plik: Blob; wyciety: boolean; miniatura: string }[]>([]);
  const [jakosc, setJakosc] = useState<{ pewnosc: number; odrzucone: number } | null>(null);
  const [tekst, setTekst] = useState("");
  const [postep, setPostep] = useState<{ nr: number; z: number; u: number } | null>(null);
  const [tytul, setTytul] = useState("");
  const [przedmiot, setPrzedmiot] = useState("");
  const [param, setParam] = useState<Parametry>(DOMYSLNE);
  const [wynik, setWynik] = useState<WynikGeneracji | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [edytowane, setEdytowane] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  function dodajBlok(plik: Blob, wyciety: boolean) {
    setBloki((b) => [...b, { id: Date.now() + Math.random(), plik, wyciety, miniatura: URL.createObjectURL(plik) }]);
  }
  function usunBlok(id: number) {
    setBloki((b) => b.filter((x) => x.id !== id));
  }

  async function odczytaj() {
    setBlad(null);
    setJakosc(null);
    try {
      const wyniki = await rozpoznajBloki(
        bloki.map((b) => ({ plik: b.plik, wyciety: b.wyciety })),
        (nr, u) => setPostep({ nr: nr + 1, z: bloki.length, u }),
      );
      const polaczone = wyniki.map((w) => w.tekst).filter(Boolean).join("\n\n");
      setTekst((t) => (t ? `${t}\n\n${polaczone}` : polaczone));
      const slowa = wyniki.filter((w) => w.pewnosc > 0);
      setJakosc({
        pewnosc: slowa.length ? Math.round(slowa.reduce((s, w) => s + w.pewnosc, 0) / slowa.length) : 0,
        odrzucone: wyniki.reduce((s, w) => s + w.odrzucone, 0),
      });
      setBloki([]);
      setZdjecia([]);
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

  function zmienPytanie(p: Pytanie, o: Odpowiedz) {
    setWynik((w) =>
      w && {
        ...w,
        pytania: w.pytania.map((x) => (x.id === p.id ? p : x)),
        odpowiedzi: w.odpowiedzi.map((x) => (x.id === o.id ? o : x)),
      },
    );
  }
  function usunPytanie(id: string) {
    if (!confirm("Usunąć to pytanie z testu?")) return;
    setWynik((w) => w && { ...w, pytania: w.pytania.filter((x) => x.id !== id), odpowiedzi: w.odpowiedzi.filter((x) => x.id !== id) });
  }

  async function zapisz() {
    if (!wynik) return;
    if (!przedmiot.trim()) return setBlad("Podaj przedmiot, np. Chemia.");
    if (!tytul.trim()) return setBlad("Podaj tytuł testu, np. „Właściwości substancji”.");
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
          Zrób wyraźne zdjęcia stron, najlepiej jedna strona na zdjęcie, bez cienia i pod prostym kątem. Potem zaznacz tylko kolumny z tekstem (bez zdjęć i tabel). Rozpoznawanie tekstu
          dzieje się na tym urządzeniu, zdjęcia nigdzie nie są wysyłane.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setZdjecia(Array.from(e.target.files ?? []))}
          className="block w-full text-sm"
        />
        {zdjecia.length > 0 && (
          <ul className="space-y-1.5">
            {zdjecia.map((f, i) => (
              <li key={`${f.name}${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
                <span className="truncate">{f.name}</span>
                <Button size="sm" variant="outline" onClick={() => setKadruj(f)}>Wybierz fragmenty</Button>
              </li>
            ))}
          </ul>
        )}
        {bloki.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Do odczytu ({bloki.length}), w tej kolejności:</p>
            <ul className="flex flex-wrap gap-2">
              {bloki.map((b, i) => (
                <li key={b.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.miniatura} alt={`Fragment ${i + 1}`} className="h-16 rounded border border-gray-300" />
                  <button onClick={() => usunBlok(b.id)} aria-label="Usuń fragment" className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-gray-900 text-xs text-white">×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button onClick={odczytaj} disabled={bloki.length === 0 || postep !== null}>
          {bloki.length > 0 ? `Odczytaj tekst (${bloki.length})` : "Odczytaj tekst"}
        </Button>
        {jakosc && (
          <p className={`text-sm ${jakosc.pewnosc >= 75 ? "text-emerald-700" : "text-amber-700"}`}>
            Pewność odczytu: {jakosc.pewnosc}%.
            {jakosc.odrzucone > 0 && ` Pominięto ${jakosc.odrzucone} nieczytelnych linii.`}
            {jakosc.pewnosc < 75 && " Spróbuj węższych fragmentów (jedna kolumna) i zdjęcia z lepszym światłem."}
          </p>
        )}
        {postep && (
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              Fragment {postep.nr} z {postep.z} · {Math.round(postep.u * 100)}%
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
            <Input id="przedmiot" list="lista-przedmiotow" required value={przedmiot} onChange={(e) => setPrzedmiot(e.target.value)} placeholder="np. Chemia" />
            <datalist id="lista-przedmiotow">
              {przedmioty.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
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

      {wynik && edytowane && (() => {
        const p = wynik.pytania.find((x) => x.id === edytowane);
        const o = wynik.odpowiedzi.find((x) => x.id === edytowane);
        return p && o ? <EdytorPytania key={edytowane} pytanie={p} odpowiedz={o} onZapisz={zmienPytanie} onZamknij={() => setEdytowane(null)} /> : null;
      })()}
      {kadruj && <Kadrowanie plik={kadruj} onDodaj={dodajBlok} onZamknij={() => setKadruj(null)} />}
      {blad && <p className="text-sm text-red-600">{blad}</p>}

      {wynik && (
        <section className="space-y-3">
          <h2 className="font-semibold">3. Podgląd ({wynik.pytania.length} pytań)</h2>
          {wynik.uwagi.length > 0 && <p className="text-sm text-amber-700">{wynik.uwagi.join(" ")}</p>}
          <TestPodglad
            pytania={wynik.pytania}
            odpowiedzi={rola === "rodzic" ? wynik.odpowiedzi : undefined}
            onEdytuj={rola === "rodzic" ? setEdytowane : undefined}
            onUsun={rola === "rodzic" ? usunPytanie : undefined}
          />
          {rola !== "rodzic" && <p className="text-xs text-gray-500">Edytować pytania mogą rodzice.</p>}
          <div className="flex gap-2">
            <Button onClick={zapisz} disabled={trwa}>{trwa ? "Zapisuję…" : "Zapisz test"}</Button>
            <Button variant="outline" onClick={generuj}>Inny zestaw</Button>
          </div>
        </section>
      )}
    </div>
  );
}
