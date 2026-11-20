"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check } from "lucide-react";
import { toBlob } from "html-to-image";
import { Card, CardTitle } from "@/components/ui/card";
import { IkonaDojazdu } from "@/components/dojazdy/ikona";
import { STYL_KIERUNKU, type Kierunek, type Rodzaj } from "@/lib/dojazdy";
import { naCzas } from "@/lib/plan";

export type PozycjaDnia =
  | {
      rodzaj: "lekcja";
      id: string;
      start: number;
      koniec: number;
      nazwa: string;
      sala: string | null;
      status: string;
      /** Co się zmieniło względem planu, np. "było 09:40–10:25". */
      zmiany: string[];
      uwagi: string | null;
    }
  | {
      rodzaj: "dojazd";
      id: string;
      start: number;
      koniec: number | null;
      nazwa: string;
      pojazd: Rodzaj;
      kierunek: Kierunek;
      odwolany: boolean;
      zmieniony: boolean;
      bylo: string | null;
      imie: string | null;
      kolor: string | null;
      opis: string | null;
    };

const PASKI = "repeating-linear-gradient(45deg, transparent 0 6px, rgba(220,38,38,0.12) 6px 12px)";
const ETYKIETY: Record<string, string> = {
  zastepstwo: "Zastępstwo",
  przesunieta: "Przesunięta",
  dodatkowa: "Dodatkowa",
};

/** Kopiuje element jako obraz PNG do schowka; gdy się nie da, udostępnia lub pobiera plik. */
async function kopiujObraz(el: HTMLElement, nazwa: string): Promise<"schowek" | "udostepnione" | "pobrane"> {
  const zrob = async () => {
    const b = await toBlob(el, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      filter: (n) => !(n instanceof HTMLElement && n.dataset.bezZdjecia !== undefined),
    });
    if (!b) throw new Error("Nie udało się zrobić zdjęcia");
    return b;
  };
  // Obietnica trafia do schowka od razu, żeby przeglądarka uznała to za reakcję na kliknięcie (Safari, iOS).
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": zrob() })]);
      return "schowek";
    } catch {
      /* próbujemy dalej */
    }
  }
  const blob = await zrob();
  const plik = new File([blob], nazwa, { type: "image/png" });
  if (navigator.canShare?.({ files: [plik] })) {
    try {
      await navigator.share({ files: [plik], title: "Plan na dziś" });
      return "udostepnione";
    } catch {
      /* anulowano: pobierz */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nazwa;
  a.click();
  URL.revokeObjectURL(url);
  return "pobrane";
}

export function PlanDnia({ tytul, data, pozycje, pusto }: { tytul: string; data: string; pozycje: PozycjaDnia[]; pusto: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stan, setStan] = useState<"" | "trwa" | "schowek" | "udostepnione" | "pobrane" | "blad">("");

  async function kopiuj() {
    if (!ref.current || stan === "trwa") return;
    setStan("trwa");
    try {
      setStan(await kopiujObraz(ref.current, `plan-${data.replace(/\W+/g, "-")}.png`));
    } catch {
      setStan("blad");
    }
    setTimeout(() => setStan(""), 3000);
  }

  const komunikat =
    stan === "schowek" ? "Skopiowano. Wklej w komunikatorze."
    : stan === "pobrane" ? "Zapisano plik ze zdjęciem."
    : stan === "udostepnione" ? "Gotowe."
    : stan === "blad" ? "Nie udało się zrobić zdjęcia."
    : "";

  return (
    <Card className="h-fit space-y-3">
      <div ref={ref} className="space-y-3 bg-white p-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{tytul}</CardTitle>
            <p className="text-xs text-gray-500">{data}</p>
          </div>
          <button
            type="button"
            data-bez-zdjecia
            onClick={kopiuj}
            disabled={stan === "trwa"}
            title="Skopiuj plan jako obraz do schowka"
            aria-label="Skopiuj plan jako obraz"
            className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            {stan === "schowek" || stan === "udostepnione" || stan === "pobrane" ? <Check size={14} /> : <Camera size={14} />}
            {stan === "trwa" ? "Chwila…" : "Kopiuj obraz"}
          </button>
        </div>

        {pozycje.length === 0 ? (
          <p className="text-sm text-gray-500">{pusto}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {pozycje.map((x) => {
              if (x.rodzaj === "lekcja") {
                const odw = x.status === "odwolana";
                const zmiana = !odw && (x.status !== "normalna" || x.zmiany.length > 0);
                const etykieta = odw ? "Odwołana" : ETYKIETY[x.status] ?? (zmiana ? "Zmiana" : null);
                return (
                  <li
                    key={x.id}
                    className={`rounded-md px-2 py-1 ${odw ? "border border-red-300 bg-red-50" : zmiana ? "border border-amber-400 bg-amber-100" : ""}`}
                    style={odw ? { backgroundImage: PASKI } : undefined}
                  >
                    <div className="flex flex-wrap items-center gap-x-1.5">
                      <span className={odw ? "text-red-700/70 line-through" : "text-gray-500"}>
                        {naCzas(x.start)}–{naCzas(x.koniec)}
                      </span>
                      <span className={`font-medium ${odw ? "text-gray-500 line-through" : ""}`}>{x.nazwa}</span>
                      {x.sala && <span className={odw ? "text-gray-400 line-through" : "text-gray-500"}>· s. {x.sala}</span>}
                      {etykieta && (
                        <span className={`rounded px-1.5 text-[11px] font-bold uppercase ${odw ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
                          {etykieta}
                        </span>
                      )}
                    </div>
                    {(x.zmiany.length > 0 || x.uwagi) && (
                      <p className={`text-xs ${odw ? "text-red-700" : "text-amber-900"}`}>{[...x.zmiany, x.uwagi].filter(Boolean).join(" · ")}</p>
                    )}
                  </li>
                );
              }
              const stylK = STYL_KIERUNKU[x.kierunek];
              const wyrozniony = x.odwolany || x.zmieniony;
              return (
                <li
                  key={x.id}
                  className={`flex flex-wrap items-center gap-x-1.5 rounded-md border border-dashed px-2 py-1 ${
                    x.odwolany ? "border-red-400 bg-red-50" : x.zmieniony ? "border-amber-500 bg-amber-100" : stylK.pulpit
                  }`}
                  style={x.odwolany ? { backgroundImage: PASKI } : undefined}
                >
                  <IkonaDojazdu rodzaj={x.pojazd} kierunek={x.kierunek} size={14} className={wyrozniony ? "text-gray-700" : stylK.ikona} />
                  <span className={x.odwolany ? "text-gray-500 line-through" : stylK.czas}>
                    {naCzas(x.start)}
                    {x.koniec != null && `–${naCzas(x.koniec)}`}
                  </span>
                  <span className={`font-medium ${x.odwolany ? "text-gray-500 line-through" : ""}`}>{x.nazwa}</span>
                  {x.imie && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={x.kolor ? { backgroundColor: x.kolor + "22", color: x.kolor } : { backgroundColor: "#f3f4f6", color: "#374151" }}
                    >
                      {x.imie}
                    </span>
                  )}
                  {x.odwolany && <span className="rounded bg-red-600 px-1.5 text-[11px] font-bold uppercase text-white">Odwołany</span>}
                  {x.zmieniony && !x.odwolany && (
                    <span className="rounded bg-amber-500 px-1.5 text-[11px] font-bold uppercase text-white">Zmiana</span>
                  )}
                  {x.zmieniony && x.bylo && <span className="text-xs text-amber-900">było {x.bylo}</span>}
                  {x.opis && <p className="w-full whitespace-pre-line pl-5 text-xs text-gray-500">{x.opis}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between gap-2" data-bez-zdjecia>
        <Link href="/plan" className="inline-block text-sm text-gray-500 underline">
          Cały plan
        </Link>
        {komunikat && (
          <span role="status" className="text-xs text-gray-600">
            {komunikat}
          </span>
        )}
      </div>
    </Card>
  );
}
