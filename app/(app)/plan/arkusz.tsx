"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  DNI,
  KOLORY,
  STATUSY,
  naCzas,
  naMinuty,
  type Blok,
  type Przedmiot,
  type Status,
} from "@/lib/plan";

export type Szkic = Omit<Blok, "id"> & { id?: string };

type Props = {
  szkic: Szkic;
  przedmioty: Przedmiot[];
  tydzien: boolean;
  onZapisz: (s: Szkic) => Promise<string | null>;
  onUsun?: () => Promise<void>;
  onNowyPrzedmiot: (nazwa: string, kolor: string) => Promise<Przedmiot | null>;
  onZamknij: () => void;
};

export function Arkusz({
  szkic,
  przedmioty,
  tydzien,
  onZapisz,
  onUsun,
  onNowyPrzedmiot,
  onZamknij,
}: Props) {
  const [dzien, setDzien] = useState(szkic.dzien);
  const [od, setOd] = useState(naCzas(szkic.start));
  const [do_, setDo] = useState(naCzas(szkic.koniec));
  const [przedmiotId, setPrzedmiotId] = useState(szkic.przedmiot_id ?? "");
  const [nr, setNr] = useState(szkic.nr_lekcji?.toString() ?? "");
  const [sala, setSala] = useState(szkic.sala);
  const [nauczyciel, setNauczyciel] = useState(szkic.nauczyciel);
  const [status, setStatus] = useState<Status>(szkic.status);
  const [uwagi, setUwagi] = useState(szkic.uwagi);
  const [nowy, setNowy] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function dodajPrzedmiot() {
    const nazwa = nowy.trim();
    if (!nazwa) return;
    const kolor = KORY(przedmioty.length);
    const p = await onNowyPrzedmiot(nazwa, kolor);
    if (p) {
      setPrzedmiotId(p.id);
      setNowy("");
    }
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    const start = naMinuty(od);
    const koniec = naMinuty(do_);
    if (!(koniec > start)) return setBlad("Koniec musi być później niż początek.");
    setTrwa(true);
    const wynik = await onZapisz({
      id: szkic.id,
      dzien,
      start,
      koniec,
      przedmiot_id: przedmiotId || null,
      sala: sala.trim(),
      nauczyciel: nauczyciel.trim(),
      nr_lekcji: nr === "" ? null : Number(nr),
      status,
      uwagi: uwagi.trim(),
    });
    setTrwa(false);
    if (wynik) setBlad(wynik);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={(e) => e.target === e.currentTarget && onZamknij()}
    >
      <form
        onSubmit={zapisz}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 md:max-w-md md:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {szkic.id ? "Edytuj lekcję" : "Nowa lekcja"}
          </h2>
          {szkic.id && onUsun && (
            <button
              type="button"
              aria-label="Usuń lekcję"
              className="text-gray-400 hover:text-red-600"
              onClick={() => onUsun()}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="przedmiot">Przedmiot</Label>
          <Select id="przedmiot" value={przedmiotId} onChange={(e) => setPrzedmiotId(e.target.value)}>
            <option value="">— bez przedmiotu —</option>
            {przedmioty.map((p) => (
              <option key={p.id} value={p.id}>{p.nazwa}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="Nowy przedmiot…"
              value={nowy}
              onChange={(e) => setNowy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dodajPrzedmiot();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={dodajPrzedmiot}>Dodaj</Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dzien">Dzień</Label>
            <Select id="dzien" value={dzien} onChange={(e) => setDzien(Number(e.target.value))}>
              {DNI.map((n, i) => (
                <option key={n} value={i + 1}>{n.slice(0, 3)}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="od">Od</Label>
            <Input id="od" type="time" step={300} required value={od} onChange={(e) => setOd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do">Do</Label>
            <Input id="do" type="time" step={300} required value={do_} onChange={(e) => setDo(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nr">Nr lekcji</Label>
            <Input id="nr" type="number" min={0} max={20} value={nr} onChange={(e) => setNr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sala">Sala</Label>
            <Input id="sala" value={sala} onChange={(e) => setSala(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nauczyciel">Nauczyciel</Label>
            <Input id="nauczyciel" value={nauczyciel} onChange={(e) => setNauczyciel(e.target.value)} />
          </div>
        </div>

        {tydzien && (
          <div className="space-y-3 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Zmiana dotyczy tylko tego tygodnia.</p>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUSY.map((s) => (
                  <option key={s.wartosc} value={s.wartosc}>{s.etykieta}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uwagi">Uwagi</Label>
              <Input id="uwagi" placeholder="np. zastępuje p. Nowak" value={uwagi} onChange={(e) => setUwagi(e.target.value)} />
            </div>
          </div>
        )}

        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={trwa}>
            {trwa ? "Zapisuję…" : "Zapisz"}
          </Button>
          <Button type="button" variant="outline" onClick={onZamknij}>Anuluj</Button>
        </div>
      </form>
    </div>
  );
}

function KORY(n: number) {
  return KOLORY[n % KOLORY.length];
}
