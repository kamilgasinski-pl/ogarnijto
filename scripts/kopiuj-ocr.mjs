// Kopiuje pliki OCR (Tesseract) z node_modules do public/tesseract, żeby
// rozpoznawanie tekstu ze zrzutów ekranu działało w całości lokalnie,
// bez pobierania czegokolwiek z zewnętrznych serwerów.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const cel = join("public", "tesseract");
mkdirSync(join(cel, "lang"), { recursive: true });

const pliki = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/pol/4.0.0_best_int/pol.traineddata.gz", "lang/pol.traineddata.gz"],
];

for (const [z, d] of pliki) {
  if (!existsSync(z)) {
    console.warn(`OCR: brak pliku ${z}, pomijam (import ze zrzutu może nie działać)`);
    continue;
  }
  cpSync(z, join(cel, d));
}
console.log("OCR: pliki skopiowane do public/tesseract");
