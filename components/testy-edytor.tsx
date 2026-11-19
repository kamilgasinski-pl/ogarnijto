"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { LUKA, type Odpowiedz, type Pytanie } from "@/lib/testy";

const LITERY = ["A", "B", "C", "D", "E"];

/** Edycja jednego pytania razem z jego odpowiedzią z klucza. */
export function EdytorPytania({
  pytanie,
  odpowiedz,
  onZapisz,
  onZamknij,
}: {
  pytanie: Pytanie;
  odpowiedz: Odpowiedz;
  onZapisz: (p: Pytanie, o: Odpowiedz) => void;
  onZamknij: () => void;
}) {
  const [tresc, setTresc] = useState(pytanie.tresc);
  const [opcje, setOpcje] = useState<string[]>(pytanie.typ === "wybor" ? pytanie.opcje : []);
  const [poprawna, setPoprawna] = useState(odpowiedz.poprawna ?? 0);
  const [tekst, setTekst] = useState(
    pytanie.typ === "pf" ? odpowiedz.tekst.replace(/^(Prawda|Fałsz)\.\s*/, "") : odpowiedz.tekst,
  );
  const [prawda, setPrawda] = useState(odpowiedz.prawda ?? true);
  const [blad, setBlad] = useState<string | null>(null);

  function zapisz() {
    if (!tresc.trim()) return setBlad("Treść pytania nie może być pusta.");
    if (pytanie.typ === "wybor") {
      const czyste = opcje.map((o) => o.trim());
      if (czyste.some((o) => !o)) return setBlad("Uzupełnij wszystkie odpowiedzi.");
      if (new Set(czyste).size !== czyste.length) return setBlad("Odpowiedzi nie mogą się powtarzać.");
      onZapisz({ ...pytanie, tresc: tresc.trim(), opcje: czyste }, { ...odpowiedz, tekst: czyste[poprawna], poprawna });
    } else if (pytanie.typ === "luka") {
      if (!tresc.includes(LUKA)) return setBlad(`W zdaniu musi być luka: ${LUKA}`);
      if (!tekst.trim()) return setBlad("Podaj brakujące słowo.");
      onZapisz({ ...pytanie, tresc: tresc.trim() }, { ...odpowiedz, tekst: tekst.trim() });
    } else if (pytanie.typ === "pf") {
      onZapisz(
        { ...pytanie, tresc: tresc.trim() },
        { ...odpowiedz, prawda, tekst: `${prawda ? "Prawda." : "Fałsz."}${tekst.trim() ? ` ${tekst.trim()}` : ""}` },
      );
    } else {
      if (!tekst.trim()) return setBlad("Podaj wzorcową odpowiedź.");
      onZapisz({ ...pytanie, tresc: tresc.trim() }, { ...odpowiedz, tekst: tekst.trim() });
    }
    onZamknij();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={(e) => e.target === e.currentTarget && onZamknij()}>
      <div className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-lg md:rounded-2xl">
        <h2 className="text-lg font-semibold">Edytuj pytanie</h2>

        <div className="space-y-1.5">
          <Label htmlFor="e-tresc">{pytanie.typ === "luka" ? `Zdanie (luka: ${LUKA})` : "Treść"}</Label>
          <Textarea id="e-tresc" rows={4} value={tresc} onChange={(e) => setTresc(e.target.value)} />
          {pytanie.typ === "luka" && (
            <button type="button" className="text-xs text-gray-500 underline" onClick={() => setTresc(tresc + " " + LUKA)}>
              Wstaw lukę na końcu
            </button>
          )}
        </div>

        {pytanie.typ === "wybor" && (
          <div className="space-y-2">
            <Label>Odpowiedzi (zaznacz poprawną)</Label>
            {opcje.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="poprawna" checked={poprawna === i} onChange={() => setPoprawna(i)} aria-label={`Poprawna: ${LITERY[i]}`} />
                <span className="w-4 text-sm font-medium">{LITERY[i]}.</span>
                <Input value={o} onChange={(e) => setOpcje(opcje.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
          </div>
        )}

        {pytanie.typ === "pf" && (
          <div className="space-y-1.5">
            <Label>To zdanie jest</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={prawda} onChange={() => setPrawda(true)} /> prawdziwe
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={!prawda} onChange={() => setPrawda(false)} /> fałszywe
              </label>
            </div>
          </div>
        )}

        {pytanie.typ !== "wybor" && (
          <div className="space-y-1.5">
            <Label htmlFor="e-odp">
              {pytanie.typ === "luka" ? "Brakujące słowo" : pytanie.typ === "pf" ? "Uzasadnienie (opcjonalnie)" : "Wzorcowa odpowiedź"}
            </Label>
            <Textarea id="e-odp" rows={pytanie.typ === "luka" ? 1 : 3} value={tekst} onChange={(e) => setTekst(e.target.value)} />
          </div>
        )}

        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={zapisz}>Zapisz pytanie</Button>
          <Button variant="outline" onClick={onZamknij}>Anuluj</Button>
        </div>
      </div>
    </div>
  );
}
