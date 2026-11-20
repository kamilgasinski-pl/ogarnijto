import { Bus, PlaneLanding, PlaneTakeoff } from "lucide-react";
import type { Rodzaj } from "@/lib/dojazdy";

/** Autobus: autobus. Dowóz (zawiezienie): startujący samolot. Odwóz (odebranie): lądujący samolot. */
export function IkonaDojazdu({ rodzaj, size = 16, className }: { rodzaj: Rodzaj; size?: number; className?: string }) {
  const Ikona = rodzaj === "autobus" ? Bus : rodzaj === "dowoz" ? PlaneTakeoff : PlaneLanding;
  return <Ikona size={size} className={className} aria-label={rodzaj === "autobus" ? "Autobus" : rodzaj === "dowoz" ? "Dowóz" : "Odwóz"} />;
}
