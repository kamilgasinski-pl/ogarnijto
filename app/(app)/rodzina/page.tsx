import { wymagajRodziny } from "@/lib/auth";
import { Card, CardTitle } from "@/components/ui/card";
import { Zaproszenia } from "./zaproszenia";

export default async function RodzinaPage() {
  const { supabase, osoba } = await wymagajRodziny();
  const { data: osoby } = await supabase.from("osoby").select("id, imie, rola").order("created_at");
  const { data: zaproszenia } =
    osoba.rola === "rodzic"
      ? await supabase
          .from("zaproszenia")
          .select("kod, rola, wygasa_at")
          .is("uzyte_at", null)
          .gt("wygasa_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rodzina</h1>
        <p className="text-gray-500">Osoby korzystające z aplikacji.</p>
      </div>
      <Card>
        <CardTitle className="mb-3">Członkowie</CardTitle>
        <ul className="divide-y divide-gray-100">
          {(osoby ?? []).map((o) => (
            <li key={o.id} className="flex justify-between py-2 text-sm">
              <span>{o.imie}</span>
              <span className="text-gray-500">{o.rola === "rodzic" ? "Rodzic" : "Uczeń"}</span>
            </li>
          ))}
        </ul>
      </Card>
      {osoba.rola === "rodzic" && <Zaproszenia poczatkowe={zaproszenia ?? []} />}
    </div>
  );
}
