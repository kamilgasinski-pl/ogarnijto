import { NAZWY_CZESCI, type Odpowiedz, type Pytanie } from "@/lib/testy";

const LITERY = ["A", "B", "C", "D", "E"];
const CZESCI: Pytanie["typ"][] = ["wybor", "luka", "pf", "otwarte"];

/** Test na ekranie; z `odpowiedzi` pokazuje też klucz (tylko dla rodziców). */
export function TestPodglad({ pytania, odpowiedzi }: { pytania: Pytanie[]; odpowiedzi?: Odpowiedz[] }) {
  let nr = 0;
  const odp = new Map((odpowiedzi ?? []).map((o) => [o.id, o]));
  return (
    <div className="space-y-5">
      {CZESCI.map((typ, ci) => {
        const lista = pytania.filter((p) => p.typ === typ);
        if (lista.length === 0) return null;
        return (
          <section key={typ} className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Część {String.fromCharCode(65 + ci)}. <span className="font-normal text-gray-500">{NAZWY_CZESCI[typ]}</span>
            </h2>
            <ol className="space-y-3">
              {lista.map((p) => {
                nr++;
                const o = odp.get(p.id);
                return (
                  <li key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                    <p>
                      <span className="font-semibold">{nr}.</span> {p.tresc}
                    </p>
                    {p.typ === "wybor" && (
                      <ul className="mt-1.5 space-y-0.5 pl-4">
                        {p.opcje.map((t, i) => (
                          <li key={i} className={o?.poprawna === i ? "font-semibold text-emerald-700" : ""}>
                            {LITERY[i]}. {t}
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.typ === "pf" && <p className="mt-1 text-gray-500">P / F</p>}
                    {o && p.typ !== "wybor" && <p className="mt-1.5 rounded bg-emerald-50 px-2 py-1 text-emerald-800">Klucz: {o.tekst}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
