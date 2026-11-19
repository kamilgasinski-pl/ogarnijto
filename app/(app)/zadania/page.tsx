import { wymagajRodziny } from "@/lib/auth";
import { Zadania } from "@/components/zadania/zadania";
import { dodajDni, dzisiaj, jutroDlaWidoku } from "@/lib/dates";
import {
  KOLUMNY_PODZADAN,
  KOLUMNY_ZADAN,
  type OsobaMini,
  type Podzadanie,
  type Zadanie,
} from "@/lib/zadania";

export default async function ZadaniaPage() {
  const { supabase, osoba } = await wymagajRodziny();
  const dzis = dzisiaj();

  await supabase.rpc("zapewnij_powtarzalne", { p_od: dodajDni(dzis, -14), p_do: dodajDni(dzis, 90) });
  const { data: osobyDb } = await supabase.from("osoby").select("id, imie, rola").order("created_at");

  // Niewykonane (wszystkie) oraz wykonane z ostatnich 14 dni i przyszłości.
  const { data } = await supabase
    .from("zadania")
    .select(KOLUMNY_ZADAN)
    .or(`status.eq.do_zrobienia,termin.gte.${dodajDni(dzis, -14)}`)
    .order("termin");
  const zadania = (data ?? []) as Zadanie[];

  let podzadania: Podzadanie[] = [];
  if (zadania.length > 0) {
    const { data: p } = await supabase
      .from("podzadania")
      .select(KOLUMNY_PODZADAN)
      .in("zadanie_id", zadania.map((z) => z.id))
      .order("kolejnosc");
    podzadania = (p ?? []) as Podzadanie[];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Zadania</h1>
        <p className="text-gray-500">Wszystko, co jeszcze przed nami.</p>
      </div>
      <Zadania
        zadania={zadania}
        podzadania={podzadania}
        rodzinaId={osoba.rodzina_id}
        osoby={(osobyDb ?? []) as OsobaMini[]}
        mojeId={osoba.id}
        dzis={dzis}
        jutro={jutroDlaWidoku(dzis)}
        widok="wszystkie"
      />
    </div>
  );
}
