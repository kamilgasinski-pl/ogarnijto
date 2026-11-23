"use client";

import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { kopiujObraz } from "@/lib/zdjecie";
import { SZEROKOSC_ZDJECIA } from "./planer";

/** Robi zdjęcie całego tygodniowego planu (wszystkie dni obok siebie), do wysłania komunikatorem. */
export function PrzyciskScreenPlanu({ tydzien, klasa }: { tydzien: string; klasa: string }) {
  const [stan, setStan] = useState<"" | "trwa" | "schowek" | "udostepnione" | "pobrane" | "blad">("");

  async function zrob() {
    const el = document.getElementById("planer-zdjecie");
    if (!el || stan === "trwa") return;
    setStan("trwa");
    // Na czas zdjęcia pokazujemy wszystkie dni obok siebie (na telefonie widać normalnie jeden).
    el.dataset.zdjecie = "1";
    el.style.width = `${SZEROKOSC_ZDJECIA}px`; // stała szerokość i proporcje A4 poziomo, jak na wydruku
    window.dispatchEvent(new CustomEvent("planer-zdjecie", { detail: true }));
    try {
      await new Promise((r) => setTimeout(r, 150));
      setStan(await kopiujObraz(el, `plan-tygodnia-${tydzien}.png`, "Plan zajęć"));
    } catch {
      setStan("blad");
    } finally {
      window.dispatchEvent(new CustomEvent("planer-zdjecie", { detail: false }));
      delete el.dataset.zdjecie;
      el.style.width = "";
    }
    setTimeout(() => setStan(""), 3500);
  }

  const komunikat =
    stan === "schowek" ? "Skopiowano. Wklej w komunikatorze."
    : stan === "pobrane" ? "Zapisano plik ze zdjęciem."
    : stan === "udostepnione" ? "Gotowe."
    : stan === "blad" ? "Nie udało się zrobić zdjęcia."
    : "";

  return (
    <>
      {komunikat && <span className="text-sm text-gray-600">{komunikat}</span>}
      <button type="button" onClick={zrob} disabled={stan === "trwa"} className={`${klasa} flex items-center gap-1.5 disabled:opacity-60`}>
        {stan === "schowek" || stan === "udostepnione" || stan === "pobrane" ? <Check size={15} /> : <Camera size={15} />}
        {stan === "trwa" ? "Chwila…" : "Zrób screen"}
      </button>
    </>
  );
}
