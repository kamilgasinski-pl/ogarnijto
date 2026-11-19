"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Zaproszenie = { kod: string; rola: string; wygasa_at: string };

export function Zaproszenia({ poczatkowe }: { poczatkowe: Zaproszenie[] }) {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);

  async function utworz(rola: "uczen" | "rodzic") {
    setBlad(null);
    const { error } = await createClient().rpc("utworz_zaproszenie", { p_rola: rola });
    if (error) return setBlad(tlumaczBlad(error.message));
    router.refresh();
  }

  async function usun(kod: string) {
    const { error } = await createClient().from("zaproszenia").delete().eq("kod", kod);
    if (error) return setBlad(tlumaczBlad(error.message));
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <div>
        <CardTitle>Zaproszenia</CardTitle>
        <CardDescription>Kod jest ważny 7 dni i działa jednorazowo. Druga osoba wpisuje go po założeniu konta.</CardDescription>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => utworz("uczen")}>Zaproś ucznia</Button>
        <Button size="sm" variant="outline" onClick={() => utworz("rodzic")}>Zaproś rodzica</Button>
      </div>
      {blad && <p className="text-sm text-red-600">{blad}</p>}
      <ul className="divide-y divide-gray-100">
        {poczatkowe.map((z) => (
          <li key={z.kod} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-mono font-semibold">{z.kod}</span>{" "}
              <span className="text-gray-500">({z.rola === "rodzic" ? "rodzic" : "uczeń"}, do {new Date(z.wygasa_at).toLocaleDateString("pl-PL")})</span>
            </span>
            <button aria-label="Usuń zaproszenie" onClick={() => usun(z.kod)} className="text-gray-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
