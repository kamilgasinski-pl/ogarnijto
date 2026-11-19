import { wymagajRodziny } from "@/lib/auth";
import { NowyTest } from "./nowy-test";

export default async function NowyTestPage() {
  const { osoba } = await wymagajRodziny();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nowy test</h1>
        <p className="text-gray-500">Zdjęcia → tekst → test do wydruku.</p>
      </div>
      <NowyTest rodzinaId={osoba.rodzina_id} rola={osoba.rola} />
    </div>
  );
}
