"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { ListaZakupow } from "@/components/zakupy/lista-zakupow";
import { Czas } from "@/components/ui/czas";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { WyborKategorii } from "@/components/zadania/wybor-kategorii";
import {
  KOLUMNY_PODZADAN,
  kategoriaZadania,
  typDlaKategorii,
  krotkaGodzina,
  polaWykonawcy,
  wartoscOsoby,
  type OsobaMini,
  type Podzadanie,
  type Zadanie,
} from "@/lib/zadania";

type Props = {
  zadanie: Zadanie;
  podzadania: Podzadanie[];
  rodzinaId: string;
  osoby: OsobaMini[];
  onZapisz: (z: Zadanie) => void;
  onUsun: (id: string) => void;
  onPodzadania: (zadanieId: string, lista: Podzadanie[]) => void;
  onZamknij: () => void;
};

export function ArkuszZadania({
  zadanie,
  podzadania,
  rodzinaId,
  osoby,
  onZapisz,
  onUsun,
  onPodzadania,
  onZamknij,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [z, setZ] = useState<Zadanie>(() => ({ ...zadanie, kategoria: kategoriaZadania(zadanie) }));
  const [od, setOd] = useState(krotkaGodzina(zadanie.godz_start) ?? "");
  const [do_, setDo] = useState(krotkaGodzina(zadanie.godz_koniec) ?? "");
  const [osoba, setOsoba] = useState(wartoscOsoby(zadanie));
  const [lista, setLista] = useState(podzadania);
  const [nowe, setNowe] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  const test = typDlaKategorii(z.kategoria) !== "zwykle";
  const umiem = lista.filter((p) => p.wykonane).length;

  function zmienListe(l: Podzadanie[]) {
    setLista(l);
    onPodzadania(zadanie.id, l);
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!z.tytul.trim()) return setBlad("Podaj tytuł zadania.");
    if (do_ && !od) return setBlad("Ustaw godzinę „od”, jeśli podajesz „do”.");
    if (od && do_ && do_ <= od) return setBlad("Koniec musi być później niż początek.");
    setTrwa(true);
    const wykonawca = polaWykonawcy(osoba, osoby);
    const pola = {
      tytul: z.tytul.trim(),
      typ: typDlaKategorii(z.kategoria),
      termin: z.termin,
      na_dzien: z.na_dzien && z.na_dzien <= z.termin ? z.na_dzien : null,
      sklep: z.kategoria === "zakupy" ? z.sklep?.trim() || null : null,
      przedmiot: z.przedmiot?.trim() || null,
      pokaz_na_pulpicie: z.pokaz_na_pulpicie,
      oznacz_na_planerze: z.oznacz_na_planerze,
      kategoria: z.kategoria,
      opis: z.opis?.trim() || null,
      godz_start: od || null,
      godz_koniec: do_ || null,
      ...wykonawca,
    };
    const { error } = await supabase.from("zadania").update(pola).eq("id", z.id);
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    onZapisz({
      ...z,
      ...pola,
      godz_start: od ? `${od}:00` : null,
      godz_koniec: do_ ? `${do_}:00` : null,
    });
    onZamknij();
  }

  async function usunZadanie() {
    const powtarzalne = !!z.powtarzalne_id;
    if (
      !confirm(
        powtarzalne
          ? "To zadanie powtarza się co tydzień. Pominąć tylko ten termin? (Całą regułę możesz usunąć w zakładce Powtarzalne.)"
          : "Usunąć to zadanie razem z zadaniami cząstkowymi?",
      )
    )
      return;
    const { error } = powtarzalne
      ? await supabase.rpc("pomin_termin", { p_zadanie: z.id })
      : await supabase.from("zadania").delete().eq("id", z.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    onUsun(z.id);
    onZamknij();
  }

  async function dodajPodzadania() {
    // Wklejona lista (po jednej pozycji w wierszu) dodaje wiele podzadań naraz.
    const teksty = nowe.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    if (teksty.length === 0) return;
    const start = lista.reduce((m, p) => Math.max(m, p.kolejnosc), 0);
    const wiersze = teksty.map((tresc, i) => ({
      rodzina_id: rodzinaId,
      zadanie_id: z.id,
      tresc,
      kolejnosc: start + i + 1,
    }));
    const { data, error } = await supabase
      .from("podzadania")
      .insert(wiersze)
      .select(KOLUMNY_PODZADAN);
    if (error) return setBlad(tlumaczBlad(error.message));
    zmienListe([...lista, ...((data ?? []) as Podzadanie[])]);
    setNowe("");
  }

  async function przelaczPodzadanie(p: Podzadanie) {
    const nowa = lista.map((x) => (x.id === p.id ? { ...x, wykonane: !x.wykonane } : x));
    zmienListe(nowa);
    const { error } = await supabase
      .from("podzadania")
      .update({ wykonane: !p.wykonane })
      .eq("id", p.id);
    if (error) {
      zmienListe(lista);
      setBlad(tlumaczBlad(error.message));
    }
  }

  async function usunPodzadanie(p: Podzadanie) {
    const { error } = await supabase.from("podzadania").delete().eq("id", p.id);
    if (error) return setBlad(tlumaczBlad(error.message));
    zmienListe(lista.filter((x) => x.id !== p.id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={(e) => e.target === e.currentTarget && onZamknij()}
    >
      <form
        onSubmit={zapisz}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zadanie</h2>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Usuń zadanie" className="text-gray-400 hover:text-red-600" onClick={usunZadanie}>
              <Trash2 size={18} />
            </button>
            <button type="button" aria-label="Zamknij" className="text-gray-400 hover:text-gray-900" onClick={onZamknij}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tytul">Tytuł</Label>
          <Input id="tytul" value={z.tytul} onChange={(e) => setZ({ ...z, tytul: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="termin">Termin</Label>
            <Input id="termin" type="date" required value={z.termin} onChange={(e) => setZ({ ...z, termin: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="na_dzien">Zrobię w dniu (opcjonalnie)</Label>
            <Input
              id="na_dzien"
              type="date"
              max={z.termin}
              value={z.na_dzien ?? ""}
              onChange={(e) => setZ({ ...z, na_dzien: e.target.value || null })}
            />
            <p className="text-xs text-gray-500">Np. sobota. Puste: zadanie na poniedziałek pokaże się już w niedzielę.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="przedmiot">Przedmiot</Label>
            <Input id="przedmiot" value={z.przedmiot ?? ""} onChange={(e) => setZ({ ...z, przedmiot: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="kategoria">Kategoria</Label>
            <WyborKategorii
              id="kategoria"
              wartosc={z.kategoria}
              rodzinaId={rodzinaId}
              onZmien={(k) => {
                const jestTest = typDlaKategorii(k) !== "zwykle";
                // Wybór sprawdzianu, kartkówki lub odp. ustnej od razu włącza obie opcje widoczności.
                setZ({ ...z, kategoria: k, typ: typDlaKategorii(k), ...(jestTest ? { pokaz_na_pulpicie: true, oznacz_na_planerze: true } : {}) });
              }}
            />
          </div>
          <div className="col-span-2 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={z.pokaz_na_pulpicie} onChange={(e) => setZ({ ...z, pokaz_na_pulpicie: e.target.checked })} />
              Pokazuj na pulpicie w „Pilnych zadaniach”
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={z.oznacz_na_planerze} onChange={(e) => setZ({ ...z, oznacz_na_planerze: e.target.checked })} />
              Oznacz przedmiot wykrzyknikiem na planerze w dniu terminu
            </label>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="osoba">Kto ma to zrobić</Label>
            <Select id="osoba" value={osoba} onChange={(e) => setOsoba(e.target.value)}>
              {osoby.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.imie} ({o.rola === "rodzic" ? "rodzic" : "uczeń"})
                </option>
              ))}
              <option value="oba">Oboje</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Godzina od</Label>
            <Czas opcjonalny wartosc={od} onZmien={(v) => { setOd(v); if (v === "") setDo(""); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Godzina do</Label>
            <Czas opcjonalny wartosc={do_} onZmien={setDo} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opis">Opis</Label>
          <Textarea id="opis" value={z.opis ?? ""} onChange={(e) => setZ({ ...z, opis: e.target.value })} />
        </div>

        {z.kategoria === "zakupy" ? (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="sklep">Sklep</Label>
              <Input id="sklep" placeholder="np. Biedronka, Lidl, apteka" value={z.sklep ?? ""} onChange={(e) => setZ({ ...z, sklep: e.target.value })} />
            </div>
            <Label>Lista zakupów</Label>
            <ListaZakupow zadanieId={z.id} rodzinaId={rodzinaId} pozycje={lista} osoby={osoby} onZmiana={zmienListe} />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>{test ? "Umiem (zakres materiału)" : "Zadania cząstkowe"}</Label>
              {lista.length > 0 && (
                <span className="text-xs text-gray-500">
                  {umiem}/{lista.length}
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {lista.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    aria-label={p.wykonane ? "Odznacz" : "Zaznacz"}
                    onClick={() => przelaczPodzadanie(p)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${p.wykonane ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}
                  >
                    {p.wykonane && <Check size={14} />}
                  </button>
                  <span className={`flex-1 ${p.wykonane ? "text-gray-400 line-through" : ""}`}>{p.tresc}</span>
                  <button type="button" aria-label="Usuń zadanie cząstkowe" className="text-gray-300 hover:text-red-600" onClick={() => usunPodzadanie(p)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Textarea
                rows={1}
                className="min-h-10"
                placeholder="Dodaj pozycję (kilka linii = kilka pozycji)"
                value={nowe}
                onChange={(e) => setNowe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    dodajPodzadania();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" className="h-10 w-10" aria-label="Dodaj" onClick={dodajPodzadania}>
                <Plus size={16} />
              </Button>
            </div>
          </div>
        )}

        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={trwa}>
            {trwa ? "Zapisuję…" : "Zapisz"}
          </Button>
          <Button type="button" variant="outline" onClick={onZamknij}>Zamknij</Button>
        </div>
      </form>
    </div>
  );
}
