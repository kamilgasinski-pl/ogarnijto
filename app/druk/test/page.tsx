import { notFound } from "next/navigation";
import { wymagajRodziny } from "@/lib/auth";
import { NAZWY_CZESCI, type Odpowiedz, type Pytanie } from "@/lib/testy";
import { PrzyciskDruku } from "./przycisk-druku";

const LITERY = ["A", "B", "C", "D", "E"];
const CZESCI: Pytanie["typ"][] = ["wybor", "luka", "pf", "otwarte"];

export default async function DrukTestu({ searchParams }: { searchParams: Promise<{ id?: string; klucz?: string }> }) {
  const sp = await searchParams;
  const { supabase, osoba } = await wymagajRodziny();
  if (!sp.id) notFound();
  const { data: test } = await supabase.from("testy").select("id, tytul, przedmiot, pytania").eq("id", sp.id).maybeSingle();
  if (!test) notFound();
  const pytania = test.pytania as Pytanie[];

  // Klucz tylko dla rodziców (RLS i tak nie zwróci go dziecku).
  let odpowiedzi: Odpowiedz[] = [];
  if (sp.klucz === "1" && osoba.rola === "rodzic") {
    const { data } = await supabase.from("testy_klucz").select("odpowiedzi").eq("test_id", sp.id).maybeSingle();
    odpowiedzi = (data?.odpowiedzi ?? []) as Odpowiedz[];
  }

  let nr = 0;
  const numery = new Map<string, number>();
  const sekcje = CZESCI.map((typ) => ({ typ, lista: pytania.filter((p) => p.typ === typ) })).filter((s) => s.lista.length > 0);
  for (const s of sekcje) for (const p of s.lista) numery.set(p.id, ++nr);

  return (
    <main className="mx-auto w-full max-w-[800px] p-4 print:max-w-none print:p-0" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <style href="druk-testu" precedence="default">{`@page { size: A4 portrait; margin: 14mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="mb-3 flex justify-end print:hidden">
        <PrzyciskDruku />
      </div>

      <header className="mb-4 border-b-2 border-gray-800 pb-2">
        <h1 className="text-2xl font-bold">
          {test.przedmiot ? `${test.przedmiot}: ` : ""}
          {test.tytul}
        </h1>
        <div className="mt-2 flex justify-between gap-4 text-sm">
          <span>Imię: ______________________</span>
          <span>Data: ______________</span>
          <span>Wynik: ______ / {pytania.length}</span>
        </div>
      </header>

      <div className="space-y-5">
        {sekcje.map((s, ci) => (
          <section key={s.typ}>
            <h2 className="mb-1.5 border-b border-gray-400 text-sm font-bold uppercase tracking-wide text-gray-700">
              Część {String.fromCharCode(65 + ci)}{" "}
              <span className="font-normal normal-case text-gray-500">{NAZWY_CZESCI[s.typ]}</span>
            </h2>
            <ol className="space-y-3">
              {s.lista.map((p) => (
                <li key={p.id} className="break-inside-avoid text-[15px] leading-snug">
                  <p>
                    <span className="font-bold">{numery.get(p.id)}.</span> {p.tresc}
                  </p>
                  {p.typ === "wybor" && (
                    <ul className="mt-1 grid grid-cols-1 gap-y-0.5 pl-5">
                      {p.opcje.map((t, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-gray-800 text-center text-[9px] font-bold leading-[12px]">
                            {LITERY[i]}
                          </span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.typ === "pf" && (
                    <p className="mt-1 pl-5 text-sm">
                      <span className="mr-6 inline-block rounded border-2 border-gray-800 px-2 font-bold">P</span>
                      <span className="inline-block rounded border-2 border-gray-800 px-2 font-bold">F</span>
                    </p>
                  )}
                  {p.typ === "luka" && <p className="mt-1 pl-5 text-sm text-gray-500">Odpowiedź: ____________________________</p>}
                  {p.typ === "otwarte" && (
                    <div className="mt-1">
                      {Array.from({ length: p.linie }, (_, i) => (
                        <div key={i} className="h-7 border-b border-gray-400" />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {odpowiedzi.length > 0 && (
        <section className="mt-6 break-before-page border-t-2 border-gray-800 pt-3 print:mt-0 print:border-0 print:pt-0">
          <h2 className="mb-2 text-xl font-bold">Klucz odpowiedzi (dla rodzica)</h2>
          <ol className="space-y-1.5 text-sm">
            {sekcje.flatMap((s) => s.lista).map((p) => {
              const o = odpowiedzi.find((x) => x.id === p.id);
              if (!o) return null;
              const odp =
                p.typ === "wybor" && o.poprawna != null ? `${LITERY[o.poprawna]}. ${o.tekst}` : p.typ === "pf" ? (o.prawda ? "P (prawda)" : `F. ${o.tekst.replace(/^Fałsz\.\s*/, "")}`) : o.tekst;
              return (
                <li key={p.id} className="break-inside-avoid">
                  <span className="font-bold">{numery.get(p.id)}.</span> {odp}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}
