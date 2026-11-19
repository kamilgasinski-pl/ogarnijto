import { wymagajRodziny } from "@/lib/auth";
import { dodajDni, dzienMiesiac, dzisiaj, poniedzialek, tydzienISO } from "@/lib/dates";
import {
  DNI,
  KOLUMNY_SZABLONU,
  KOLUMNY_TYGODNIA,
  naCzas,
  zWiersza,
  type Przedmiot,
  type WierszBloku,
} from "@/lib/plan";
import { PrzyciskDruku } from "./przycisk-druku";

type Props = {
  searchParams: Promise<{ tydzien?: string; widok?: string }>;
};

export default async function DrukPlanu({ searchParams }: Props) {
  const { supabase } = await wymagajRodziny();
  const sp = await searchParams;
  const szablon = sp.widok === "szablon";
  const poprawna = sp.tydzien && /^\d{4}-\d{2}-\d{2}$/.test(sp.tydzien);
  const tydzien = poniedzialek(poprawna ? sp.tydzien! : dzisiaj());
  const info = tydzienISO(tydzien);

  const { data: przedmiotyDb } = await supabase.from("przedmioty").select("id, nazwa, kolor");
  const przedmioty = (przedmiotyDb ?? []) as Przedmiot[];

  let wiersze: WierszBloku[];
  if (szablon) {
    const { data } = await supabase.from("bloki_szablonu").select(KOLUMNY_SZABLONU);
    wiersze = (data ?? []) as WierszBloku[];
  } else {
    await supabase.rpc("zapewnij_tydzien", { p_tydzien_start: tydzien });
    const { data } = await supabase
      .from("bloki_planu")
      .select(KOLUMNY_TYGODNIA)
      .eq("tydzien_start", tydzien);
    wiersze = (data ?? []) as WierszBloku[];
  }
  const bloki = wiersze.map(zWiersza);

  const od = Math.floor(Math.min(7 * 60, ...bloki.map((b) => b.start)) / 60) * 60;
  const do_ = Math.ceil(Math.max(15 * 60, ...bloki.map((b) => b.koniec)) / 60) * 60;
  // Dobieramy skalę tak, by siatka zmieściła się na jednej stronie A4 (poziomo).
  const ppm = Math.min(1.3, 600 / (do_ - od));
  const wysokosc = (do_ - od) * ppm;
  const godziny: number[] = [];
  for (let m = od; m <= do_; m += 60) godziny.push(m);

  const dni = [1, 2, 3, 4, 5];
  if (bloki.some((b) => b.dzien === 6)) dni.push(6);
  if (bloki.some((b) => b.dzien === 7)) dni.push(7);

  const tytul = szablon
    ? "Plan zajęć (szablon)"
    : `Plan zajęć · tydzień ${info.numer} (${dzienMiesiac(info.start)}–${dzienMiesiac(info.koniec)})`;

  return (
    <main className="mx-auto max-w-[1100px] p-4 print:max-w-none print:p-0" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <style>{`@page { size: A4 landscape; margin: 10mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="mb-3 flex items-center justify-between print:mb-2">
        <h1 className="text-xl font-bold">{tytul}</h1>
        <div className="print:hidden">
          <PrzyciskDruku />
        </div>
      </div>

      <div className="flex border border-gray-400">
        <div className="w-10 shrink-0 border-r border-gray-300">
          <div className="h-7 border-b border-gray-300" />
          <div className="relative" style={{ height: wysokosc }}>
            {godziny.map((m) => (
              <span key={m} className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-600" style={{ top: (m - od) * ppm }}>
                {String(m / 60).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>
        {dni.map((n) => (
          <div key={n} className="min-w-0 flex-1 border-r border-gray-300 last:border-r-0">
            <div className="flex h-7 items-center justify-center border-b border-gray-300 text-xs font-semibold">
              {DNI[n - 1]}
              {!szablon && <span className="ml-1 font-normal text-gray-500">{dzienMiesiac(dodajDni(tydzien, n - 1))}</span>}
            </div>
            <div className="relative" style={{ height: wysokosc }}>
              {godziny.map((m) => (
                <div key={m} className="absolute inset-x-0 border-t border-gray-200" style={{ top: (m - od) * ppm }} />
              ))}
              {bloki
                .filter((b) => b.dzien === n)
                .map((b) => {
                  const p = przedmioty.find((x) => x.id === b.przedmiot_id);
                  const kolor = p?.kolor ?? "#9ca3af";
                  const wys = (b.koniec - b.start) * ppm;
                  const odwolana = b.status === "odwolana";
                  return (
                    <div
                      key={b.id}
                      className="absolute inset-x-0.5 overflow-hidden rounded-sm px-1 py-0.5 text-[10px] leading-tight text-gray-900"
                      style={{
                        top: (b.start - od) * ppm,
                        height: wys - 1,
                        backgroundColor: `${kolor}40`,
                        borderLeft: `3px solid ${kolor}`,
                        opacity: odwolana ? 0.55 : 1,
                      }}
                    >
                      <p className={`truncate font-semibold ${odwolana ? "line-through" : ""}`}>
                        {b.nr_lekcji != null && `${b.nr_lekcji}. `}
                        {p?.nazwa ?? "Lekcja"}
                      </p>
                      <p className="truncate text-gray-700">
                        {naCzas(b.start)}–{naCzas(b.koniec)}
                        {b.sala && ` · s. ${b.sala}`}
                      </p>
                      {wys >= 40 && b.nauczyciel && <p className="truncate text-gray-600">{b.nauczyciel}</p>}
                      {wys >= 52 && b.status !== "normalna" && (
                        <p className="font-medium">{b.status === "odwolana" ? "odwołana" : b.status}</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
