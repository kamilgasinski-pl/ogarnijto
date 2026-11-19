"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { TestPodglad } from "@/components/testy-podglad";
import { EdytorPytania } from "@/components/testy-edytor";
import type { Odpowiedz, Pytanie } from "@/lib/testy";

/** Zapisany test z kluczem: rodzic może poprawiać i usuwać pytania. */
export function TestEdycja({ id, pytania: p0, odpowiedzi: o0 }: { id: string; pytania: Pytanie[]; odpowiedzi: Odpowiedz[] }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [pytania, setPytania] = useState(p0);
  const [odpowiedzi, setOdpowiedzi] = useState(o0);
  const [edytowane, setEdytowane] = useState<string | null>(null);
  const [zmieniono, setZmieniono] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function zapisz() {
    setBlad(null);
    setTrwa(true);
    const { error } = await supabase.from("testy").update({ pytania }).eq("id", id);
    const { error: e2 } = error ? { error: null } : await supabase.from("testy_klucz").update({ odpowiedzi }).eq("test_id", id);
    setTrwa(false);
    if (error || e2) return setBlad(tlumaczBlad((error ?? e2)!.message));
    setZmieniono(false);
    router.refresh();
  }

  const p = pytania.find((x) => x.id === edytowane);
  const o = odpowiedzi.find((x) => x.id === edytowane);

  return (
    <div className="space-y-4">
      <TestPodglad
        pytania={pytania}
        odpowiedzi={odpowiedzi}
        onEdytuj={setEdytowane}
        onUsun={(qid) => {
          if (!confirm("Usunąć to pytanie z testu?")) return;
          setPytania((s) => s.filter((x) => x.id !== qid));
          setOdpowiedzi((s) => s.filter((x) => x.id !== qid));
          setZmieniono(true);
        }}
      />
      {zmieniono && (
        <div className="sticky bottom-20 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg md:bottom-4">
          <span className="text-sm text-gray-600">Masz niezapisane zmiany.</span>
          <Button onClick={zapisz} disabled={trwa}>{trwa ? "Zapisuję…" : "Zapisz zmiany"}</Button>
        </div>
      )}
      {blad && <p className="text-sm text-red-600">{blad}</p>}
      {p && o && (
        <EdytorPytania
          key={p.id}
          pytanie={p}
          odpowiedz={o}
          onZapisz={(np, no) => {
            setPytania((s) => s.map((x) => (x.id === np.id ? np : x)));
            setOdpowiedzi((s) => s.map((x) => (x.id === no.id ? no : x)));
            setZmieniono(true);
          }}
          onZamknij={() => setEdytowane(null)}
        />
      )}
    </div>
  );
}
