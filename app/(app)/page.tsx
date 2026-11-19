import { wymagajRodziny } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { dataSlownie, dzisiaj, jutroDlaWidoku, tydzienISO } from "@/lib/dates";

export default async function Pulpit() {
  const { osoba } = await wymagajRodziny();
  const dzis = dzisiaj();
  const jutro = jutroDlaWidoku(dzis);
  const tydzien = tydzienISO(dzis);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cześć, {osoba.imie}!</h1>
        <p className="text-gray-500">
          {dataSlownie(dzis)} · tydzień {tydzien.numer}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Zadania na dziś</CardTitle>
          <CardDescription>Wkrótce: zadania, zaległe na górze z ikoną opóźnienia.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Zadania na {dataSlownie(jutro)}</CardTitle>
          <CardDescription>Wkrótce.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Plan zajęć</CardTitle>
          <CardDescription>Wkrótce: tygodniowy plan z szablonem i edycją.</CardDescription>
        </Card>
        <Card>
          <CardTitle>Import z Librusa</CardTitle>
          <CardDescription>Wkrótce: wklej wpis lub zrzut ekranu.</CardDescription>
        </Card>
      </div>
    </div>
  );
}
