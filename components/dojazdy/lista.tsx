import Link from "next/link";
import { Bus, Car } from "lucide-react";
import { naCzas } from "@/lib/plan";
import { type Wystapienie } from "@/lib/dojazdy";
import { Card, CardTitle } from "@/components/ui/card";

/** Przypomnienie na pulpicie: dojazdy, za które odpowiadam (lub bez przypisanej osoby). */
export function KartaDojazdow({
  pozycje,
  nazwaDnia,
}: {
  pozycje: Wystapienie[];
  nazwaDnia: (data: string) => string;
}) {
  if (pozycje.length === 0) return null;
  return (
    <Card className="space-y-2">
      <CardTitle>Dojazdy</CardTitle>
      <ul className="space-y-1.5 text-sm">
        {pozycje.map((w) => {
          const Ikona = w.dojazd.rodzaj === "autobus" ? Bus : Car;
          return (
            <li key={`${w.dojazd.id}${w.data}`} className={`flex items-center gap-2 ${w.odwolany ? "text-gray-400 line-through" : ""}`}>
              <Ikona size={16} className="shrink-0 text-gray-500" />
              <span className="text-gray-500">
                {nazwaDnia(w.data)} {naCzas(w.start)}
                {w.koniec != null && `–${naCzas(w.koniec)}`}
              </span>
              <span className="font-medium">{w.dojazd.tytul}</span>
              {w.zmieniony && <span className="rounded bg-amber-100 px-1 text-[11px] text-amber-800 no-underline">zmiana</span>}
              {w.odwolany && <span className="text-[11px] no-underline">odwołany</span>}
            </li>
          );
        })}
      </ul>
      <Link href="/dojazdy" className="inline-block text-sm text-gray-500 underline">
        Wszystkie dojazdy
      </Link>
    </Card>
  );
}
