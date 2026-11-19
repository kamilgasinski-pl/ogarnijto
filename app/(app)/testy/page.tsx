import Link from "next/link";
import { wymagajRodziny } from "@/lib/auth";
import { dzienMiesiac } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import type { Pytanie } from "@/lib/testy";

export default async function TestyPage() {
  const { supabase } = await wymagajRodziny();
  const { data } = await supabase
    .from("testy")
    .select("id, tytul, przedmiot, pytania, created_at")
    .order("created_at", { ascending: false });
  const testy = (data ?? []) as { id: string; tytul: string; przedmiot: string | null; pytania: Pytanie[]; created_at: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Testy</h1>
        <p className="text-gray-500">
          Zrób zdjęcia rozdziału z podręcznika, a aplikacja ułoży z nich test do samodzielnego
          sprawdzenia wiedzy przed sprawdzianem.
        </p>
      </div>
      <Link href="/testy/nowy">
        <Button>Nowy test ze zdjęć</Button>
      </Link>
      {testy.length === 0 ? (
        <p className="text-sm text-gray-400">Nie ma jeszcze żadnego testu.</p>
      ) : (
        <ul className="space-y-2">
          {testy.map((t) => (
            <li key={t.id}>
              <Link href={`/testy/${t.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                <p className="text-sm font-medium">{t.tytul}</p>
                <p className="text-xs text-gray-500">
                  {t.przedmiot && `${t.przedmiot} · `}
                  {t.pytania.length} pytań · {dzienMiesiac(t.created_at.slice(0, 10))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
