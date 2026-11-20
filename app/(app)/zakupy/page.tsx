import { wymagajRodziny } from "@/lib/auth";
import { dodajDni, dzisiaj } from "@/lib/dates";
import { KOLUMNY_PODZADAN, KOLUMNY_ZADAN, type OsobaMini, type Podzadanie, type Zadanie } from "@/lib/zadania";
import { Zakupy } from "./zakupy";

export default async function ZakupyPage() {
  const { supabase, osoba } = await wymagajRodziny();
  const dzis = dzisiaj();
  const { data: osobyDb } = await supabase.from("osoby").select("id, imie, rola").order("created_at");
  // Otwarte listy (także po terminie) i zakończone z ostatnich dwóch tygodni.
  const { data: zad } = await supabase
    .from("zadania")
    .select(KOLUMNY_ZADAN)
    .eq("kategoria", "zakupy")
    .or(`status.eq.do_zrobienia,termin.gte.${dodajDni(dzis, -14)}`)
    .order("termin");
  const listy = (zad ?? []) as Zadanie[];
  let pozycje: Podzadanie[] = [];
  if (listy.length > 0) {
    const { data } = await supabase
      .from("podzadania")
      .select(KOLUMNY_PODZADAN)
      .in("zadanie_id", listy.map((z) => z.id))
      .order("kolejnosc");
    pozycje = (data ?? []) as Podzadanie[];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Zakupy</h1>
        <p className="text-gray-500">
          Wspólne listy zakupów. Każdy dopisuje, czego potrzebuje, a osoba robiąca zakupy ma wszystko w jednym miejscu.
        </p>
      </div>
      <Zakupy
        listy={listy}
        pozycje={pozycje}
        osoby={(osobyDb ?? []) as OsobaMini[]}
        rodzinaId={osoba.rodzina_id}
        mojeId={osoba.id}
        dzis={dzis}
      />
    </div>
  );
}
