import Link from "next/link";
import { wymagajRodziny } from "@/lib/auth";
import { dodajDni, dzienMiesiac, dzisiaj, poniedzialek, tydzienISO } from "@/lib/dates";
import { KOLUMNY_DOJAZDOW, KOLUMNY_WYJATKOW, type Dojazd, type Wyjatek } from "@/lib/dojazdy";
import type { OsobaMini } from "@/lib/zadania";
import { Dojazdy } from "./dojazdy";

export default async function DojazdyPage({
  searchParams,
}: {
  searchParams: Promise<{ tydzien?: string }>;
}) {
  const { supabase, osoba } = await wymagajRodziny();
  const sp = await searchParams;
  const dzis = dzisiaj();
  const poprawna = sp.tydzien && /^\d{4}-\d{2}-\d{2}$/.test(sp.tydzien);
  const tydzien = poniedzialek(poprawna ? sp.tydzien! : dzis);
  const info = tydzienISO(tydzien);

  const [{ data: dojazdy }, { data: wyjatki }, { data: osoby }] = await Promise.all([
    supabase.from("dojazdy").select(KOLUMNY_DOJAZDOW).order("godz_start"),
    supabase
      .from("dojazdy_wyjatki")
      .select(KOLUMNY_WYJATKOW)
      .gte("data", tydzien)
      .lte("data", dodajDni(tydzien, 6)),
    supabase.from("osoby").select("id, imie, rola").order("created_at"),
  ]);

  const nawig = "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dojazdy</h1>
        <p className="text-gray-500">
          Stały rozkład autobusów i odwozów, np. do szkoły muzycznej. Gdy zajęcia są odwołane lub
          zmienia się godzina, popraw to tylko na wybrany dzień.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/dojazdy?tydzien=${dodajDni(tydzien, -7)}`} className={nawig} aria-label="Poprzedni tydzień">←</Link>
        <Link href={`/dojazdy?tydzien=${poniedzialek(dzis)}`} className={nawig}>Ten tydzień</Link>
        <Link href={`/dojazdy?tydzien=${dodajDni(tydzien, 7)}`} className={nawig} aria-label="Następny tydzień">→</Link>
        <span className="text-sm text-gray-500">
          Tydzień {info.numer} · {dzienMiesiac(info.start)}–{dzienMiesiac(info.koniec)}
        </span>
      </div>
      <Dojazdy
        key={tydzien}
        tydzien={tydzien}
        dojazdy={(dojazdy ?? []) as Dojazd[]}
        wyjatki={(wyjatki ?? []) as Wyjatek[]}
        osoby={(osoby ?? []) as OsobaMini[]}
        rodzinaId={osoba.rodzina_id}
        mojeId={osoba.id}
        dzis={dzis}
      />
    </div>
  );
}
