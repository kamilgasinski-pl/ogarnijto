/** Kolorowa pastylka z imieniem osoby (kolor z kolorOsoby). */
export function ZnacznikOsoby({ kolor, imie }: { kolor: string; imie: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: kolor + "22", color: kolor }}>
      {imie}
    </span>
  );
}
