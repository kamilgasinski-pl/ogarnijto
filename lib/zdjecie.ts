import { toBlob } from "html-to-image";

/** Kopiuje element jako obraz PNG do schowka; gdy się nie da, udostępnia lub pobiera plik. */
export async function kopiujObraz(el: HTMLElement, nazwa: string, tytul = "Plan"): Promise<"schowek" | "udostepnione" | "pobrane"> {
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
      await navigator.share({ files: [plik], title: tytul });
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
