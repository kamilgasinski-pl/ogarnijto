import { ArrowDownLeft, ArrowUpRight, Bus, Car } from "lucide-react";
import type { Kierunek, Rodzaj } from "@/lib/dojazdy";

/**
 * Pojazd (autobus albo samochód rodzica) z małą strzałką w rogu:
 * w górę i w prawo = odjazd / dowóz, w dół i w lewo = przyjazd / odbiór.
 */
export function IkonaDojazdu({
  rodzaj,
  kierunek,
  size = 16,
  className,
}: {
  rodzaj: Rodzaj;
  kierunek: Kierunek;
  size?: number;
  className?: string;
}) {
  const Pojazd = rodzaj === "autobus" ? Bus : Car;
  const Strzalka = kierunek === "odjazd" ? ArrowUpRight : ArrowDownLeft;
  const opis = `${rodzaj === "autobus" ? "Autobus" : "Samochód"}: ${kierunek === "odjazd" ? "odjazd" : "przyjazd"}`;
  return (
    <span className={`relative inline-flex shrink-0 ${className ?? ""}`} title={opis} role="img" aria-label={opis}>
      <Pojazd size={size} />
      <span className="absolute -bottom-1 -right-1.5 flex items-center justify-center rounded-full bg-white ring-1 ring-current">
        <Strzalka size={Math.max(8, Math.round(size * 0.6))} strokeWidth={3} />
      </span>
    </span>
  );
}
