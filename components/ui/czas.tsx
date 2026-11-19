"use client";

import { Select } from "@/components/ui/input";

const GODZINY = Array.from({ length: 24 }, (_, i) => i);
const MINUTY = Array.from({ length: 12 }, (_, i) => i * 5);
const dwie = (n: number) => String(n).padStart(2, "0");

/**
 * Wybór godziny w formacie 24h (niezależnie od ustawień systemu).
 * Wartość to "HH:MM"; przy `opcjonalny` pusty napis oznacza brak godziny.
 */
export function Czas({
  id,
  wartosc,
  onZmien,
  opcjonalny = false,
}: {
  id?: string;
  wartosc: string;
  onZmien: (v: string) => void;
  opcjonalny?: boolean;
}) {
  const pusty = opcjonalny && wartosc === "";
  const [g, m] = pusty ? [0, 0] : wartosc.split(":").map(Number);
  // Minuty spoza kroku 5 (np. po rozciągnięciu) nadal da się wybrać.
  const minuty = MINUTY.includes(m) ? MINUTY : [...MINUTY, m].sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-1">
      <Select
        id={id}
        className="px-2"
        value={pusty ? "" : g}
        onChange={(e) => {
          if (e.target.value === "") return onZmien("");
          onZmien(`${dwie(Number(e.target.value))}:${dwie(pusty ? 0 : m)}`);
        }}
      >
        {opcjonalny && <option value="">—</option>}
        {GODZINY.map((h) => (
          <option key={h} value={h}>{dwie(h)}</option>
        ))}
      </Select>
      <span>:</span>
      <Select
        aria-label="Minuty"
        className="px-2"
        disabled={pusty}
        value={pusty ? "" : m}
        onChange={(e) => onZmien(`${dwie(g)}:${dwie(Number(e.target.value))}`)}
      >
        {pusty && <option value="">—</option>}
        {minuty.map((x) => (
          <option key={x} value={x}>{dwie(x)}</option>
        ))}
      </Select>
    </div>
  );
}
