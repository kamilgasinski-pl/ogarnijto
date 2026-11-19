import Link from "next/link";
import { notFound } from "next/navigation";
import { wymagajRodziny } from "@/lib/auth";
import { TestPodglad } from "@/components/testy-podglad";
import type { Odpowiedz, Pytanie } from "@/lib/testy";
import { UsunTest } from "./usun-test";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, osoba } = await wymagajRodziny();
  const { data: test } = await supabase.from("testy").select("id, tytul, przedmiot, pytania").eq("id", id).maybeSingle();
  if (!test) notFound();
  // Klucz zwraca tylko rodzicom (reszta rodziny dostaje pusty wynik).
  const { data: klucz } = await supabase.from("testy_klucz").select("odpowiedzi").eq("test_id", id).maybeSingle();
  const rodzic = osoba.rola === "rodzic";
  const odpowiedzi = (klucz?.odpowiedzi ?? undefined) as Odpowiedz[] | undefined;
  const przycisk = "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/testy" className="text-sm text-gray-500 underline">← Testy</Link>
        <h1 className="mt-1 text-3xl font-bold">{test.tytul}</h1>
        {test.przedmiot && <p className="text-gray-500">{test.przedmiot}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/druk/test?id=${id}`} target="_blank" className={przycisk}>Drukuj test (PDF)</Link>
        {rodzic && odpowiedzi && (
          <Link href={`/druk/test?id=${id}&klucz=1`} target="_blank" className={przycisk}>Drukuj z kluczem</Link>
        )}
        {rodzic && <UsunTest id={id} />}
      </div>
      {rodzic && odpowiedzi && <p className="text-sm text-emerald-700">Klucz odpowiedzi jest widoczny tylko dla rodziców.</p>}
      <TestPodglad pytania={test.pytania as Pytanie[]} odpowiedzi={rodzic ? odpowiedzi : undefined} />
    </div>
  );
}
