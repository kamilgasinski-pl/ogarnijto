import { wymagajRodziny } from "@/lib/auth";
import { dzisiaj } from "@/lib/dates";
import { ImportLibrus } from "./import-librus";

export default async function ImportPage() {
  const { supabase, osoba } = await wymagajRodziny();
  const { data: przedmioty } = await supabase.from("przedmioty").select("nazwa");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import z Librusa</h1>
        <p className="text-gray-500">
          Wklej zrzut ekranu lub tekst wpisu z kalendarza. Nic nie wychodzi poza Twoją przeglądarkę
          i bazę aplikacji, a hasła do Librusa aplikacja nie zna.
        </p>
      </div>
      <ImportLibrus
        rodzinaId={osoba.rodzina_id}
        dzis={dzisiaj()}
        znanePrzedmioty={(przedmioty ?? []).map((p) => p.nazwa as string)}
      />
    </div>
  );
}
