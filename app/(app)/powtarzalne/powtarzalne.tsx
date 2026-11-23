"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { dzienMiesiac, dzienTygodnia } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Czas } from "@/components/ui/czas";
import { WyborKategorii } from "@/components/zadania/wybor-kategorii";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  DNI_KROTKO,
  krotkaGodzina,
  nazwaWykonawcy,
  opisDni,
  polaWykonawcy,
  wartoscOsoby,
  type Kategoria,
  type OsobaMini,
  type Regula,
} from "@/lib/zadania";

type Props = {
  reguly: Regula[];
  osoby: OsobaMini[];
  rodzinaId: string;
  mojeId: string;
  dzis: string;
};

type Szkic = {
  id?: string;
  tytul: string;
  opis: string;
  kategoria: Kategoria;
  kto: string;
  dni: number[];
  od_godz: string;
  do_godz: string;
  od: string;
  do_dnia: string;
};

export function Powtarzalne({ reguly, osoby, rodzinaId, mojeId, dzis }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [szkic, setSzkic] = useState<Szkic | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  const aktywne = reguly.filter((r) => !r.do_dnia || r.do_dnia >= dzis);
  const zakonczone = reguly.filter((r) => r.do_dnia && r.do_dnia < dzis);

  function nowa() {
    setBlad(null);
    setSzkic({
      tytul: "",
      opis: "",
      kategoria: "transport",
      kto: mojeId,
      dni: [dzienTygodnia(dzis)],
      od_godz: "",
      do_godz: "",
      od: dzis,
      do_dnia: "",
    });
  }

  function edytuj(r: Regula) {
    setBlad(null);
    setSzkic({
      id: r.id,
      tytul: r.tytul,
      opis: r.opis ?? "",
      kategoria: r.kategoria,
      kto: wartoscOsoby(r),
      dni: r.dni,
      od_godz: krotkaGodzina(r.godz_start) ?? "",
      do_godz: krotkaGodzina(r.godz_koniec) ?? "",
      od: r.od,
      do_dnia: r.do_dnia ?? "",
    });
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!szkic) return;
    if (!szkic.tytul.trim()) return setBlad("Podaj nazwę zadania.");
    if (szkic.dni.length === 0) return setBlad("Zaznacz co najmniej jeden dzień tygodnia.");
    if (szkic.do_godz && !szkic.od_godz) return setBlad("Ustaw godzinę „od”, jeśli podajesz „do”.");
    if (szkic.od_godz && szkic.do_godz && szkic.do_godz <= szkic.od_godz)
      return setBlad("Koniec musi być później niż początek.");
    if (szkic.do_dnia && szkic.do_dnia < szkic.od)
      return setBlad("Data zakończenia nie może być przed datą początku.");

    setBlad(null);
    setTrwa(true);
    const pola = {
      tytul: szkic.tytul.trim(),
      opis: szkic.opis.trim() || null,
      kategoria: szkic.kategoria,
      dni: [...szkic.dni].sort((a, b) => a - b),
      godz_start: szkic.od_godz || null,
      godz_koniec: szkic.do_godz || null,
      od: szkic.od,
      do_dnia: szkic.do_dnia || null,
      ...polaWykonawcy(szkic.kto, osoby),
    };

    if (szkic.id) {
      const { error } = await supabase.from("zadania_powtarzalne").update(pola).eq("id", szkic.id);
      if (!error) {
        // Przyszłe, jeszcze niewykonane wystąpienia powstaną od nowa według zmienionej reguły.
        await supabase
          .from("zadania")
          .delete()
          .eq("powtarzalne_id", szkic.id)
          .gte("termin", dzis)
          .eq("status", "do_zrobienia");
      }
      if (error) {
        setTrwa(false);
        return setBlad(tlumaczBlad(error.message));
      }
    } else {
      const { error } = await supabase
        .from("zadania_powtarzalne")
        .insert({ rodzina_id: rodzinaId, ...pola });
      if (error) {
        setTrwa(false);
        return setBlad(tlumaczBlad(error.message));
      }
    }
    setTrwa(false);
    setSzkic(null);
    router.refresh();
  }

  async function odwolaj(r: Regula) {
    const poczatekPozniej = r.od > dzis;
    const pytanie = poczatekPozniej
      ? `Usunąć regułę „${r.tytul}”?`
      : `Odwołać „${r.tytul}”? Dzisiejsze zadanie zostaje, kolejne znikną.`;
    if (!confirm(pytanie)) return;
    setBlad(null);
    const { error } = poczatekPozniej
      ? await supabase.from("zadania_powtarzalne").delete().eq("id", r.id)
      : await supabase.rpc("odwolaj_powtarzalne", { p_id: r.id, p_ostatni: dzis });
    if (error) return setBlad(tlumaczBlad(error.message));
    router.refresh();
  }

  // Usunięcie całkowite: reguła znika razem z jej zaplanowanymi, niewykonanymi zadaniami od dziś.
  // Wykonane zadania i te z przeszłości zostają jako historia.
  async function usun(r: Regula) {
    if (
      !confirm(
        `Usunąć „${r.tytul}” całkowicie? Znikną też jej zaplanowane, niewykonane zadania od dziś. Wykonane i dawne zadania zostaną w historii.`,
      )
    )
      return;
    setBlad(null);
    const { error: e1 } = await supabase
      .from("zadania")
      .delete()
      .eq("powtarzalne_id", r.id)
      .eq("status", "do_zrobienia")
      .gte("termin", dzis);
    if (e1) return setBlad(tlumaczBlad(e1.message));
    const { error: e2 } = await supabase.from("zadania_powtarzalne").delete().eq("id", r.id);
    if (e2) return setBlad(tlumaczBlad(e2.message));
    router.refresh();
  }

  function wiersz(r: Regula, koniec: boolean) {
    const od = krotkaGodzina(r.godz_start);
    const do_ = krotkaGodzina(r.godz_koniec);
    return (
      <li key={r.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <Repeat size={18} className="mt-0.5 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{r.tytul}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {opisDni(r.dni)}
            {od && ` · ${od}${do_ ? `–${do_}` : ""}`} · {nazwaWykonawcy(r, osoby)}
          </p>
          <p className="text-xs text-gray-400">
            od {dzienMiesiac(r.od)}
            {r.do_dnia ? `, do ${dzienMiesiac(r.do_dnia)}` : ", bez końca"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!koniec && (
            <button aria-label="Edytuj regułę" title="Edytuj" onClick={() => edytuj(r)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
              <Pencil size={16} />
            </button>
          )}
          {!koniec && r.od <= dzis && (
            <Button size="sm" variant="outline" title="Kończy powtarzanie od jutra; dzisiejsze zadanie zostaje" onClick={() => odwolaj(r)}>
              Odwołaj
            </Button>
          )}
          <Button size="sm" variant="outline" title="Usuwa regułę i jej zaplanowane zadania" onClick={() => usun(r)}>
            Usuń
          </Button>
        </div>
      </li>
    );
  }

  function przelaczDzien(n: number) {
    if (!szkic) return;
    setSzkic({
      ...szkic,
      dni: szkic.dni.includes(n) ? szkic.dni.filter((d) => d !== n) : [...szkic.dni, n],
    });
  }

  return (
    <div className="space-y-5">
      <Button onClick={nowa}>Nowe zadanie powtarzalne</Button>
      {blad && !szkic && <p className="text-sm text-red-600">{blad}</p>}

      {aktywne.length === 0 ? (
        <p className="text-sm text-gray-400">Brak powtarzalnych zadań.</p>
      ) : (
        <ul className="space-y-2">{aktywne.map((r) => wiersz(r, false))}</ul>
      )}

      {zakonczone.length > 0 && (
        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer">Zakończone ({zakonczone.length})</summary>
          <ul className="mt-2 space-y-2">{zakonczone.map((r) => wiersz(r, true))}</ul>
        </details>
      )}

      {szkic && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={(e) => e.target === e.currentTarget && setSzkic(null)}
        >
          <form
            onSubmit={zapisz}
            className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-lg md:rounded-2xl"
          >
            <h2 className="text-lg font-semibold">
              {szkic.id ? "Edytuj zadanie powtarzalne" : "Nowe zadanie powtarzalne"}
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="tytul">Co trzeba zrobić</Label>
              <Input id="tytul" placeholder="np. Odebrać dziecko ze szkoły" value={szkic.tytul} onChange={(e) => setSzkic({ ...szkic, tytul: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Dni tygodnia</Label>
              <div className="flex flex-wrap gap-1.5">
                {DNI_KROTKO.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => przelaczDzien(i + 1)}
                    className={`h-9 w-11 rounded-full text-sm ${szkic.dni.includes(i + 1) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Godzina od</Label>
                <Czas opcjonalny wartosc={szkic.od_godz} onZmien={(v) => setSzkic({ ...szkic, od_godz: v, do_godz: v === "" ? "" : szkic.do_godz })} />
              </div>
              <div className="space-y-1.5">
                <Label>Godzina do</Label>
                <Czas opcjonalny wartosc={szkic.do_godz} onZmien={(v) => setSzkic({ ...szkic, do_godz: v })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="kto">Kto ma to zrobić</Label>
                <Select id="kto" value={szkic.kto} onChange={(e) => setSzkic({ ...szkic, kto: e.target.value })}>
                  {osoby.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.imie} ({o.rola === "rodzic" ? "rodzic" : "uczeń"})
                    </option>
                  ))}
                  <option value="oba">Oboje</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="od">Od dnia</Label>
                <Input id="od" type="date" required value={szkic.od} onChange={(e) => setSzkic({ ...szkic, od: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="do">Do dnia (opcjonalnie)</Label>
                <Input id="do" type="date" value={szkic.do_dnia} onChange={(e) => setSzkic({ ...szkic, do_dnia: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="kategoria">Kategoria</Label>
                <WyborKategorii id="kategoria" zTestami={false} rodzinaId={rodzinaId} wartosc={szkic.kategoria} onZmien={(k) => setSzkic({ ...szkic, kategoria: k })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opis">Opis</Label>
              <Textarea id="opis" value={szkic.opis} onChange={(e) => setSzkic({ ...szkic, opis: e.target.value })} />
            </div>

            <p className="text-xs text-gray-500">
              Puste „Do dnia” oznacza powtarzanie bez końca, dopóki nie klikniesz „Odwołaj”.
              {szkic.id && " Zmiana dotyczy zadań od dziś wzwyż."}
            </p>
            {blad && <p className="text-sm text-red-600">{blad}</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={trwa}>{trwa ? "Zapisuję…" : "Zapisz"}</Button>
              <Button type="button" variant="outline" onClick={() => setSzkic(null)}>Anuluj</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
