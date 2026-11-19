// Rozpoznawanie tekstu ze zrzutu ekranu. Działa w całości w przeglądarce:
// obraz nie opuszcza komputera, a pliki Tesseract są serwowane z /tesseract.

async function przygotuj(plik: Blob): Promise<Blob> {
  const bitmapa = await createImageBitmap(plik);
  // Małe zrzuty (np. z telefonu) powiększamy, bo OCR lepiej czyta większy tekst.
  const skala = bitmapa.width < 1400 ? Math.min(3, 1800 / bitmapa.width) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmapa.width * skala);
  canvas.height = Math.round(bitmapa.height * skala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return plik;
  ctx.filter = "grayscale(1) contrast(1.15)";
  ctx.drawImage(bitmapa, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? plik), "image/png"));
}

export async function rozpoznajTekst(
  plik: Blob,
  postep: (ulamek: number) => void,
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
    return wynik.data.text;
  } finally {
    await worker.terminate();
  }
}
