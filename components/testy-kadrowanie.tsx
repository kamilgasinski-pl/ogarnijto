"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Prostokat = { x: number; y: number; w: number; h: number };

/** Wycinanie fragmentów zdjęcia: przeciągnij palcem lub myszką po jednej kolumnie tekstu. */
export function Kadrowanie({
  plik,
  onDodaj,
  onZamknij,
}: {
  plik: File;
  onDodaj: (blob: Blob, wyciety: boolean) => void;
  onZamknij: () => void;
}) {
  const [adres, setAdres] = useState<string | null>(null);
  const [rect, setRect] = useState<Prostokat | null>(null);
  const [dodano, setDodano] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(plik);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdres(url);
    return () => URL.revokeObjectURL(url);
  }, [plik]);

  const punkt = (e: React.PointerEvent) => {
    const r = img.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
      y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
    };
  };

  function wDol(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = punkt(e);
    setRect({ ...start.current, w: 0, h: 0 });
  }
  function wRuchu(e: React.PointerEvent) {
    if (!start.current) return;
    const p = punkt(e);
    setRect({
      x: Math.min(start.current.x, p.x),
      y: Math.min(start.current.y, p.y),
      w: Math.abs(p.x - start.current.x),
      h: Math.abs(p.y - start.current.y),
    });
  }
  function wGore() {
    start.current = null;
  }

  async function dodajFragment() {
    const el = img.current;
    if (!el || !rect || rect.w < 20 || rect.h < 20) return;
    const skala = el.naturalWidth / el.getBoundingClientRect().width;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.w * skala);
    canvas.height = Math.round(rect.h * skala);
    canvas.getContext("2d")?.drawImage(el, rect.x * skala, rect.y * skala, rect.w * skala, rect.h * skala, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!blob) return;
    onDodaj(blob, true);
    setDodano((n) => n + 1);
    setRect(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3">
      <div className="flex flex-1 items-center justify-center overflow-auto">
        {adres && (
          <div className="relative inline-block touch-none select-none" onPointerDown={wDol} onPointerMove={wRuchu} onPointerUp={wGore} onPointerCancel={wGore}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={img} src={adres} alt="Zdjęcie strony" draggable={false} className="max-h-[70vh] max-w-full" />
            {rect && (
              <div
                className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/20"
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              />
            )}
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2 rounded-xl bg-white p-3">
        <p className="text-sm text-gray-600">
          Zaznacz <strong>jedną kolumnę lub jeden blok tekstu</strong> (bez zdjęć i tabel) i dodaj go. Możesz dodać wiele
          fragmentów ze zdjęcia, po kolei. {dodano > 0 && `Dodano: ${dodano}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={dodajFragment} disabled={!rect || rect.w < 20 || rect.h < 20}>
            Dodaj zaznaczony fragment
          </Button>
          <Button variant="outline" onClick={() => { onDodaj(plik, false); onZamknij(); }}>
            Użyj całego zdjęcia
          </Button>
          <Button variant="outline" onClick={onZamknij}>Gotowe</Button>
        </div>
      </div>
    </div>
  );
}
