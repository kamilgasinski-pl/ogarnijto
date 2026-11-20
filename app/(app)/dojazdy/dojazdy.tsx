"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { IkonaDojazdu } from "@/components/dojazdy/ikona";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { dodajDni, dzienMiesiac, dzienTygodnia, poniedzialek } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Czas } from "@/components/ui/czas";
import { ArkuszWyjatku } from "@/components/dojazdy/arkusz-wyjatku";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { naCzas } from "@/lib/plan";
import { KIERUNKI, RODZAJE, wystapienia, type Dojazd, type Kierunek, type Rodzaj, type Wyjatek, type Wystapienie } from "@/lib/dojazdy";
import { DNI_KROTKO, krotkaGodzina, opisDni, type OsobaMini } from "@/lib/zadania";

type Props = {
  tydzien: string;
  dojazdy: Dojazd[];
  wyjatki: Wyjatek[];
  osoby: OsobaMini[];
  rodzinaId: string;
  mojeId: string;
  dzis: string;
};

type Szkic = {
  id?: string;
  rodzaj: Rodzaj;
  kierunek: Kierunek;
  tytul: string;
  opis: string;
  dni: number[];
  od_godz: string;
  do_godz: string;
  kto: string; // id osoby albo "" = nikt
  od: string;
  do_dnia: string;
};

type Zmiana = { w: Wystapienie };

export function Dojazdy({ tydzien, dojazdy, wyjatki, osoby, rodzinaId, mojeId, dzis }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [szkic, setSzkic] = useState<Szkic | null>(null);
  const [zmiana, setZmiana] = useState<Zmiana | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  const aktywne = dojazdy.filter((d) => !d.do_dnia || d.do_dnia >= dzis);
  const zakonczone = dojazdy.filter((d) => d.do_dnia && d.do_dnia < dzis);
  const wTygodniu = wystapienia(dojazdy, wyjatki, tydzien, dodajDni(tydzien, 6));
  const imie = (id: string | null) => osoby.find((o) => o.id === id)?.imie ?? null;

  function nowy() {
    setBlad(null);
    setSzkic({
      rodzaj: "autobus",
      kierunek: "odjazd",
      tytul: "",
      opis: "",
      dni: [dzienTygodnia(dzis)],
      od_godz: "15:00",
      do_godz: "",
      kto: "",
      od: poniedzialek(dzis), // by objąć też bieżący tydzień
      do_dnia: "",
    });
  }

  function edytuj(d: Dojazd) {
    setBlad(null);
    setSzkic({
      id: d.id,
      rodzaj: d.rodzaj,
      kierunek: d.kierunek,
      tytul: d.tytul,
      opis: d.opis ?? "",
      dni: d.dni,
      od_godz: krotkaGodzina(d.godz_start) ?? "15:00",
      do_godz: krotkaGodzina(d.godz_koniec) ?? "",
      kto: d.przypisano_id ?? "",
      od: d.od,
      do_dnia: d.do_dnia ?? "",
    });
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!szkic) return;
    if (!szkic.tytul.trim()) return setBlad("Podaj nazwę, np. „Autobus 12 do szkoły muzycznej”.");
    if (szkic.dni.length === 0) return setBlad("Zaznacz co najmniej jeden dzień tygodnia.");
    if (szkic.do_godz && szkic.do_godz <= szkic.od_godz) return setBlad("Koniec musi być później niż początek.");
    if (szkic.do_dnia && szkic.do_dnia < szkic.od) return setBlad("Data zakończenia nie może być przed datą początku.");
    setBlad(null);
    setTrwa(true);
    const pola = {
      rodzaj: szkic.rodzaj,
      kierunek: szkic.kierunek,
      tytul: szkic.tytul.trim(),
      opis: szkic.opis.trim() || null,
      dni: [...szkic.dni].sort((a, b) => a - b),
      godz_start: szkic.od_godz,
      godz_koniec: szkic.do_godz || null,
      przypisano_id: szkic.kto || null,
      od: szkic.od,
      do_dnia: szkic.do_dnia || null,
    };
    const { error } = szkic.id
      ? await supabase.from("dojazdy").update(pola).eq("id", szkic.id)
      : await supabase.from("dojazdy").insert({ rodzina_id: rodzinaId, ...pola });
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    setSzkic(null);
    router.refresh();
  }

  async function usun(d: Dojazd) {
    if (!confirm(`Usunąć dojazd „${d.tytul}” z rozkładu? Znikną też jego wyjątki.`)) return;
    const { error } = await supabase.from("dojazdy").delete().eq("id", d.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    router.refresh();
  }

  function przelaczDzien(n: number) {
    if (!szkic) return;
    setSzkic({ ...szkic, dni: szkic.dni.includes(n) ? szkic.dni.filter((d) => d !== n) : [...szkic.dni, n] });
  }

  const ikona = (r: Rodzaj, k: Kierunek) => <IkonaDojazdu rodzaj={r} kierunek={k} size={18} className="mt-0.5 shrink-0 text-gray-500" />;

  return (
    <div className="space-y-6">
      {blad && !szkic && !zmiana && <p className="text-sm text-red-600">{blad}</p>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">W tym tygodniu</h2>
        {wTygodniu.length === 0 ? (
          <p className="text-sm text-gray-400">Brak dojazdów w tym tygodniu.</p>
        ) : (
          <ul className="space-y-2">
            {wTygodniu.map((w) => (
              <li
                key={`${w.dojazd.id}${w.data}`}
                className={`flex items-start gap-3 rounded-lg border bg-white p-3 ${w.odwolany ? "border-gray-200 opacity-60" : "border-gray-200"}`}
              >
                {ikona(w.dojazd.rodzaj, w.dojazd.kierunek)}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${w.odwolany ? "line-through" : ""}`}>{w.dojazd.tytul}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {DNI_KROTKO[w.dzien - 1]} {dzienMiesiac(w.data)} · {naCzas(w.start)}
                    {w.koniec != null && `–${naCzas(w.koniec)}`}
                    {imie(w.dojazd.przypisano_id) && ` · ${imie(w.dojazd.przypisano_id)}`}
                    {w.odwolany && " · odwołany"}
                    {w.zmieniony && " · zmieniona godzina"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZmiana({ w })}
                >
                  Zmień
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stały rozkład</h2>
          <Button onClick={nowy}>Dodaj dojazd</Button>
        </div>
        {aktywne.length === 0 ? (
          <p className="text-sm text-gray-400">Rozkład jest pusty.</p>
        ) : (
          <ul className="space-y-2">
            {aktywne.map((d) => (
              <li key={d.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
                {ikona(d.rodzaj, d.kierunek)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{d.tytul}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {opisDni(d.dni)} · {krotkaGodzina(d.godz_start)}
                    {d.godz_koniec && `–${krotkaGodzina(d.godz_koniec)}`}
                    {imie(d.przypisano_id) && ` · ${imie(d.przypisano_id)}`}
                  </p>
                  {d.opis && <p className="text-xs text-gray-400">{d.opis}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button aria-label="Edytuj dojazd" title="Edytuj" onClick={() => edytuj(d)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
                    <Pencil size={16} />
                  </button>
                  <Button size="sm" variant="outline" onClick={() => usun(d)}>Usuń</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {zakonczone.length > 0 && (
          <details className="text-sm text-gray-500">
            <summary className="cursor-pointer">Zakończone ({zakonczone.length})</summary>
            <ul className="mt-2 space-y-1">
              {zakonczone.map((d) => (
                <li key={d.id}>{d.tytul} · do {dzienMiesiac(d.do_dnia!)}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {zmiana && (
        <ArkuszWyjatku
          key={zmiana.w.dojazd.id + zmiana.w.data}
          onZamknij={() => setZmiana(null)}
          cel={{
            rodzinaId,
            dojazdId: zmiana.w.dojazd.id,
            tytul: zmiana.w.dojazd.tytul,
            data: zmiana.w.data,
            start: naCzas(zmiana.w.start),
            koniec: zmiana.w.koniec != null ? naCzas(zmiana.w.koniec) : null,
            odwolany: zmiana.w.odwolany,
            maWyjatek: !!zmiana.w.wyjatek,
          }}
        />
      )}

      {szkic && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={(e) => e.target === e.currentTarget && setSzkic(null)}>
          <form onSubmit={zapisz} className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-lg md:rounded-2xl">
            <h2 className="text-lg font-semibold">{szkic.id ? "Edytuj dojazd" : "Nowy dojazd"}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rodzaj">Pojazd</Label>
                <Select id="rodzaj" value={szkic.rodzaj} onChange={(e) => setSzkic({ ...szkic, rodzaj: e.target.value as Rodzaj })}>
                  {RODZAJE.map((r) => (
                    <option key={r.wartosc} value={r.wartosc}>{r.etykieta}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kierunek">Kierunek</Label>
                <Select id="kierunek" value={szkic.kierunek} onChange={(e) => setSzkic({ ...szkic, kierunek: e.target.value as Kierunek })}>
                  {KIERUNKI.map((k) => (
                    <option key={k.wartosc} value={k.wartosc}>{k.etykieta}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tytul">Nazwa</Label>
              <Input id="tytul" placeholder="np. Autobus 12 do szkoły muzycznej" value={szkic.tytul} onChange={(e) => setSzkic({ ...szkic, tytul: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Dni tygodnia</Label>
              <div className="flex flex-wrap gap-1.5">
                {DNI_KROTKO.map((d, i) => (
                  <button key={d} type="button" onClick={() => przelaczDzien(i + 1)} className={`h-9 w-11 rounded-full text-sm ${szkic.dni.includes(i + 1) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Godzina od</Label>
                <Czas wartosc={szkic.od_godz} onZmien={(v) => setSzkic({ ...szkic, od_godz: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Godzina do (opcjonalnie)</Label>
                <Czas opcjonalny wartosc={szkic.do_godz} onZmien={(v) => setSzkic({ ...szkic, do_godz: v })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="kto">Kto odpowiada (wozi / odbiera)</Label>
                <Select id="kto" value={szkic.kto} onChange={(e) => setSzkic({ ...szkic, kto: e.target.value })}>
                  <option value="">Nikt konkretny</option>
                  {osoby.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.imie} ({o.rola === "rodzic" ? "rodzic" : "uczeń"}){o.id === mojeId ? " – ja" : ""}
                    </option>
                  ))}
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opis">Notatka</Label>
              <Textarea id="opis" placeholder="np. przystanek Szkolna, zabrać instrument" value={szkic.opis} onChange={(e) => setSzkic({ ...szkic, opis: e.target.value })} />
            </div>

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
