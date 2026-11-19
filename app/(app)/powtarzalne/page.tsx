import { wymagajRodziny } from "@/lib/auth";
import { dzisiaj } from "@/lib/dates";
import { KOLUMNY_REGUL, type OsobaMini, type Regula } from "@/lib/zadania";
import { Powtarzalne } from "./powtarzalne";

export default async function PowtarzalnePage() {
  const { supabase, osoba } = await wymagajRodziny();
  const [{ data: reguly }, { data: osoby }] = await Promise.all([
    supabase.from("zadania_powtarzalne").select(KOLUMNY_REGUL).order("created_at"),
    supabase.from("osoby").select("id, imie, rola").order("created_at"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Powtarzalne</h1>
        <p className="text-gray-500">
          Zadania, które wracają co tydzień, np. odbiór dziecka ze szkoły. Same pojawiają się na
          pulpicie, dopóki ich nie odwołasz.
        </p>
      </div>
      <Powtarzalne
        reguly={(reguly ?? []) as Regula[]}
        osoby={(osoby ?? []) as OsobaMini[]}
        rodzinaId={osoba.rodzina_id}
        mojeId={osoba.id}
        dzis={dzisiaj()}
      />
    </div>
  );
}
