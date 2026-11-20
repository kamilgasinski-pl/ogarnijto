"use client";

import { useRef, useState } from "react";
import { Camera, Check, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { ZnacznikOsoby } from "@/components/osoba-znacznik";
import { etykietaDnia, dzienMiesiac } from "@/lib/dates";
import { kopiujObraz } from "@/lib/zdjecie";
import { kolorOsoby, type OsobaMini, type Podzadanie, type Zadanie } from "@/lib/zadania";

/** Aktualna lista zakupów w formie do skopiowania jako obraz (np. do wklejenia w komunikatorze). */
export function PodgladZakupow({
  listy,
  pozycje,
  osoby,
  dzis,
}: {
  listy: Zadanie[]; // otwarte listy, od najbliższej
  pozycje: Podzadanie[];
  osoby: OsobaMini[];
  dzis: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [wybrana, setWybrana] = useState<string | null>(null);
  const [stan, setStan] = useState<"" | "trwa" | "schowek" | "udostepnione" | "pobrane" | "blad">("");

  const lista = listy.find((l) => l.id === wybrana) ?? listy[0];

  async function kopiuj() {
    if (!ref.current || stan === "trwa") return;
    setStan("trwa");
    try {
      setStan(await kopiujObraz(ref.current, `zakupy-${lista?.termin ?? "lista"}.png`, "Lista zakupów"));
    } catch {
      setStan("blad");
    }
    setTimeout(() => setStan(""), 3000);
  }

  const komunikat =
    stan === "schowek" ? "Skopiowano. Wklej w komunikatorze."
    : stan === "pobrane" ? "Zapisano plik ze zdjęciem."
    : stan === "udostepnione" ? "Gotowe."
    : stan === "blad" ? "Nie udało się zrobić zdjęcia."
    : "";

  if (!lista) {
    return (
      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ShoppingCart size={18} /> Aktualna lista</h2>
        <p className="text-sm text-gray-400">Brak otwartej listy zakupów.</p>
      </Card>
    );
  }

  const elementy = pozycje
    .filter((p) => p.zadanie_id === lista.id)
    .sort((a, b) => Number(a.wykonane) - Number(b.wykonane) || a.kolejnosc - b.kolejnosc);
  const doKupienia = elementy.filter((p) => !p.wykonane);
  const kupione = elementy.filter((p) => p.wykonane);
  const robi = osoby.find((o) => o.id === lista.przypisano_id);
  const imie = (id: string | null) => osoby.find((o) => o.id === id)?.imie ?? null;
  const kolorowe = osoby.length > 1;

  const wiersz = (p: Podzadanie) => {
    const k = kolorowe ? kolorOsoby(p.dodal, osoby) : null;
    const kto = imie(p.dodal);
    return (
      <li key={p.id} className="flex items-start gap-2 text-sm">
        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${p.wykonane ? "border-gray-400 bg-gray-400 text-white" : "border-gray-500"}`}>
          {p.wykonane && <Check size={11} />}
        </span>
        <span className={`min-w-0 flex-1 ${p.wykonane ? "text-gray-400 line-through" : ""}`}>
          <span className="font-medium">{p.tresc}</span>
          {p.ilosc && <span className="ml-1 text-gray-600">· {p.ilosc}</span>}
          {p.notatka && <span className="block whitespace-pre-line text-xs text-gray-500">{p.notatka}</span>}
        </span>
        {kto && (k ? <ZnacznikOsoby kolor={k} imie={kto} /> : <span className="text-xs text-gray-500">{kto}</span>)}
      </li>
    );
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingCart size={18} /> Aktualna lista
        </h2>
        <button
          type="button"
          onClick={kopiuj}
          disabled={stan === "trwa"}
          title="Skopiuj listę jako obraz do schowka"
          aria-label="Skopiuj listę zakupów jako obraz"
          className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
        >
          {stan === "schowek" || stan === "udostepnione" || stan === "pobrane" ? <Check size={14} /> : <Camera size={14} />}
          {stan === "trwa" ? "Chwila…" : "Kopiuj obraz"}
        </button>
      </div>

      {listy.length > 1 && (
        <Select value={lista.id} onChange={(e) => setWybrana(e.target.value)} aria-label="Wybierz listę" className="h-9 text-sm">
          {listy.map((l) => (
            <option key={l.id} value={l.id}>
              {l.tytul}
              {l.sklep ? ` · ${l.sklep}` : ""} · {dzienMiesiac(l.termin)}
            </option>
          ))}
        </Select>
      )}

      {/* Ta część trafia na zdjęcie. */}
      <div ref={ref} className="space-y-2 bg-white p-2">
        <div>
          <p className="text-base font-bold">
            {lista.tytul}
            {lista.sklep && <span className="font-semibold text-gray-700"> · {lista.sklep}</span>}
          </p>
          <p className="text-xs text-gray-600">
            {etykietaDnia(lista.termin, dzis)} {dzienMiesiac(lista.termin)}
            {robi && (
              <>
                {" · robi zakupy: "}
                <b style={kolorowe ? { color: kolorOsoby(robi.id, osoby) ?? undefined } : undefined}>{robi.imie}</b>
              </>
            )}
          </p>
          {lista.opis && <p className="whitespace-pre-line text-xs text-gray-500">{lista.opis}</p>}
        </div>

        {elementy.length === 0 ? (
          <p className="text-sm text-gray-400">Lista jest pusta.</p>
        ) : (
          <>
            {doKupienia.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Do kupienia ({doKupienia.length})</p>
                <ul className="space-y-1.5">{doKupienia.map(wiersz)}</ul>
              </>
            )}
            {kupione.length > 0 && (
              <>
                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Kupione ({kupione.length})</p>
                <ul className="space-y-1.5">{kupione.map(wiersz)}</ul>
              </>
            )}
          </>
        )}
      </div>

      {komunikat && (
        <p role="status" className="text-xs text-gray-600">
          {komunikat}
        </p>
      )}
    </Card>
  );
}
