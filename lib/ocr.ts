// Rozpoznawanie tekstu ze zrzutu ekranu. Działa w całości w przeglądarce:
// obraz nie opuszcza komputera, a pliki Tesseract są serwowane z /tesseract.

async function przygotuj(plik: Blob, odwroc = false): Promise<Blob> {
  const bitmapa = await createImageBitmap(plik);
  // Małe zrzuty (np. z telefonu) powiększamy, bo OCR lepiej czyta większy tekst.
  const skala = bitmapa.width < 1400 ? Math.min(3, 1800 / bitmapa.width) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmapa.width * skala);
  canvas.height = Math.round(bitmapa.height * skala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return plik;
  ctx.filter = odwroc ? "grayscale(1) invert(1) contrast(1.15)" : "grayscale(1) contrast(1.15)";
  ctx.drawImage(bitmapa, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? plik), "image/png"));
}

export async function rozpoznajTekst(
  plik: Blob,
  postep: (ulamek: number) => void,
  opcje: { pasRodzaju?: boolean } = {},
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("pol", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract/lang",
    logger: (m) => {
      if (m.status === "recognizing text") postep(m.progress);
    },
  });
  try {
    const wynik = await worker.recognize(await przygotuj(plik));
    let tekst = wynik.data.text;
    // Nazwa rodzaju wpisu (np. "Sprawdzian") bywa białym napisem na kolorowym
    // tle, którego zwykły odczyt nie widzi. Gdy jej brak, czytamy odwrócone kolory.
    const RODZAJ = /sprawdzian|kartk[oó]wk\w*|praca\s+klasowa/i;
    if (opcje.pasRodzaju !== false && !RODZAJ.test(tekst)) {
      const druga = await worker.recognize(await przygotuj(plik, true));
      const trafienie = druga.data.text.match(RODZAJ);
      if (trafienie) tekst = `${trafienie[0]}\n${tekst}`;
    }
    return tekst;
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Odczyt stron podręcznika (moduł Testy): wiele bloków, filtr pewności słów.
// ---------------------------------------------------------------------------

/** Skala odcieni z rozciągnięciem histogramu: wyrównuje tło i podbija kontrast tekstu. */
async function przygotujStrone(plik: Blob): Promise<Blob> {
  const bitmapa = await createImageBitmap(plik);
  const skala = bitmapa.width < 1800 ? Math.min(3, 2000 / bitmapa.width) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmapa.width * skala);
  canvas.height = Math.round(bitmapa.height * skala);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return plik;
  ctx.drawImage(bitmapa, 0, 0, canvas.width, canvas.height);
  const obraz = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = obraz.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const lacznie = d.length / 4;
  let suma = 0;
  let nisko = 0;
  for (let i = 0; i < 256; i++) {
    suma += hist[i];
    if (suma >= lacznie * 0.02) {
      nisko = i;
      break;
    }
  }
  suma = 0;
  let wysoko = 255;
  for (let i = 255; i >= 0; i--) {
    suma += hist[i];
    if (suma >= lacznie * 0.1) {
      wysoko = i;
      break;
    }
  }
  const zakres = Math.max(30, wysoko - nisko);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - nisko) * 255) / zakres));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(obraz, 0, 0);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? plik), "image/png"));
}

export type WynikBloku = {
  tekst: string;
  /** Średnia pewność zachowanych słów (0–100). */
  pewnosc: number;
  /** Ile linii odrzucono jako nieczytelne. */
  odrzucone: number;
};

/**
 * Odczytuje kolejno bloki (fragmenty zdjęć). Słowa o niskiej pewności i linie, w których
 * większość słów jest niepewna, są odrzucane, dzięki czemu śmieci z tabel i zdjęć nie trafiają do testu.
 */
export async function rozpoznajBloki(
  bloki: { plik: Blob; wyciety: boolean }[],
  postep: (nr: number, ulamek: number) => void,
  prog = 62,
): Promise<WynikBloku[]> {
  const { createWorker } = await import("tesseract.js");
  let nr = 0;
  const worker = await createWorker("pol", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract/lang",
    logger: (m) => {
      if (m.status === "recognizing text") postep(nr, m.progress);
    },
  });
  const wyniki: WynikBloku[] = [];
  try {
    for (nr = 0; nr < bloki.length; nr++) {
      // Wycięty fragment to zwykle jedna kolumna: czytamy go jako jednolity blok.
      await worker.setParameters({ tessedit_pageseg_mode: bloki[nr].wyciety ? "6" : "3" } as never);
      const res = await worker.recognize(await przygotujStrone(bloki[nr].plik), {}, { blocks: true });
      let sumaPewnosci = 0;
      let slow = 0;
      let odrzucone = 0;
      const akapity: string[] = [];
      for (const blok of res.data.blocks ?? []) {
        for (const akapit of blok.paragraphs) {
          const linie: string[] = [];
          for (const linia of akapit.lines) {
            const wszystkie = linia.words.filter((w) => w.text.trim());
            const dobre = wszystkie.filter((w) => w.confidence >= prog && /[\p{L}\d]/u.test(w.text));
            if (wszystkie.length === 0) continue;
            if (dobre.length < Math.ceil(wszystkie.length * 0.6)) {
              odrzucone++;
              continue;
            }
            for (const w of dobre) {
              sumaPewnosci += w.confidence;
              slow++;
            }
            linie.push(dobre.map((w) => w.text).join(" "));
          }
          if (linie.length > 0) akapity.push(linie.join("\n"));
        }
      }
      wyniki.push({
        tekst: akapity.join("\n\n"),
        pewnosc: slow > 0 ? Math.round(sumaPewnosci / slow) : 0,
        odrzucone,
      });
    }
  } finally {
    await worker.terminate();
  }
  return wyniki;
}
