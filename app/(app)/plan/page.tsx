import Link from "next/link";
import type { OsobaMini } from "@/lib/zadania";
import { wymagajRodziny } from "@/lib/auth";
import {
  dodajDni,
  dzienMiesiac,
  dzisiaj,
  poniedzialek,
  tydzienISO,
} from "@/lib/dates";
import {
  KOLUMNY_SZABLONU,
  KOLUMNY_TYGODNIA,
  type Przedmiot,
  type WierszBloku,
} from "@/lib/plan";
import { KOLUMNY_DOJAZDOW, KOLUMNY_WYJATKOW, koniecNaPlanie, wystapienia, type Dojazd, type Wyjatek } from "@/lib/dojazdy";
import { Planer, type TestNaPlanie } from "./planer";
import { PrzyciskScreenPlanu } from "./przycisk-screen";

type Props = {
  searchParams: Promise<{ tydzien?: string; widok?: string }>;
};

export default async function PlanPage({ searchParams }: Props) {
  const { supabase, osoba } = await wymagajRodziny();
  const sp = await searchParams;
  const dzis = dzisiaj();
  const szablon = sp.widok === "szablon";
  const poprawna = sp.tydzien && /^\d{4}-\d{2}-\d{2}$/.test(sp.tydzien);
  const tydzien = poniedzialek(poprawna ? sp.tydzien! : dzis);
  const info = tydzienISO(tydzien);

  const { data: osobyDb } = await supabase.from("osoby").select("id, imie, rola").order("created_at");
  const { data: przedmioty } = await supabase
    .from("przedmioty")
    .select("id, nazwa, kolor")
    .order("nazwa");

  // Sprawdziany, kartkówki i odpowiedzi ustne tygodnia (oznaczane na lekcjach danego przedmiotu).
  let testy: TestNaPlanie[] = [];
  if (!szablon) {
    const { data } = await supabase
      .from("zadania")
      .select("termin, typ, przedmiot, tytul")
      .neq("typ", "zwykle")
      .gte("termin", tydzien)
      .lte("termin", dodajDni(tydzien, 6));
    testy = (data ?? []) as TestNaPlanie[];
  }

  let bloki: WierszBloku[] = [];
  if (szablon) {
    const { data } = await supabase
      .from("bloki_szablonu")
      .select(KOLUMNY_SZABLONU);
    bloki = (data ?? []) as WierszBloku[];
  } else {
    await supabase.rpc("zapewnij_tydzien", { p_tydzien_start: tydzien });
    const { data } = await supabase
      .from("bloki_planu")
      .select(KOLUMNY_TYGODNIA)
      .eq("tydzien_start", tydzien);
    bloki = (data ?? []) as WierszBloku[];
  }

  // Dojazdy (tylko do odczytu) w widoku tygodnia.
  let dojazdy: ReturnType<typeof wystapienia> = [];
  if (!szablon) {
    const [{ data: d }, { data: w }] = await Promise.all([
      supabase.from("dojazdy").select(KOLUMNY_DOJAZDOW),
      supabase.from("dojazdy_wyjatki").select(KOLUMNY_WYJATKOW).gte("data", tydzien).lte("data", dodajDni(tydzien, 6)),
    ]);
    dojazdy = wystapienia((d ?? []) as Dojazd[], (w ?? []) as Wyjatek[], tydzien, dodajDni(tydzien, 6));
  }

  const poprzedni = dodajDni(tydzien, -7);
  const nastepny = dodajDni(tydzien, 7);
  const aktualny = poniedzialek(dzis);
  const nawig = "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100";

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Plan zajęć</h1>
        <p className="text-gray-500">
          {szablon
            ? "Szablon: powtarza się co tydzień."
            : `Tydzień ${info.numer} · ${dzienMiesiac(info.start)}–${dzienMiesiac(info.koniec)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-gray-200 p-0.5 text-sm">
          <Link
            href={`/plan?tydzien=${tydzien}`}
            className={`rounded-full px-4 py-1.5 ${!szablon ? "bg-gray-900 text-white" : "text-gray-700"}`}
          >
            Tydzień
          </Link>
          <Link
            href={`/plan?widok=szablon`}
            className={`rounded-full px-4 py-1.5 ${szablon ? "bg-gray-900 text-white" : "text-gray-700"}`}
          >
            Szablon
          </Link>
        </div>
        {!szablon && (
          <div className="flex items-center gap-2">
            <Link href={`/plan?tydzien=${poprzedni}`} className={nawig} aria-label="Poprzedni tydzień">←</Link>
            <Link href={`/plan?tydzien=${aktualny}`} className={nawig}>Ten tydzień</Link>
            <Link href={`/plan?tydzien=${nastepny}`} className={nawig} aria-label="Następny tydzień">→</Link>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PrzyciskScreenPlanu tydzien={szablon ? "szablon" : tydzien} klasa={nawig} />
          <Link href={`/druk/plan?${szablon ? "widok=szablon" : `tydzien=${tydzien}`}`} target="_blank" className={nawig}>
            Drukuj / PDF
          </Link>
        </div>
      </div>

      <Planer
        key={`${szablon ? "s" : "t"}-${tydzien}`}
        tryb={szablon ? "szablon" : "tydzien"}
        tydzien={tydzien}
        rodzinaId={osoba.rodzina_id}
        dzis={dzis}
        osoby={(osobyDb ?? []) as OsobaMini[]}
        przedmioty={(przedmioty ?? []) as Przedmiot[]}
        testy={testy}
        bloki={bloki}
        dojazdy={dojazdy.map((x) => ({
          id: `${x.dojazd.id}${x.data}`,
          rodzaj: x.dojazd.rodzaj,
          kierunek: x.dojazd.kierunek,
          przypisano_id: x.dojazd.przypisano_id,
          tytul: x.dojazd.tytul,
          dzien: x.dzien,
          start: x.start,
          koniec: koniecNaPlanie(x),
          odwolany: x.odwolany,
        }))}
      />
    </div>
  );
}
