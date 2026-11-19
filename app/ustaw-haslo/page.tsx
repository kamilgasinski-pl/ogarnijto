"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function UstawHaslo() {
  const [haslo, setHaslo] = useState("");
  const [powtorz, setPowtorz] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    if (haslo !== powtorz) return setBlad("Hasła nie są takie same.");
    setTrwa(true);
    const { error } = await createClient().auth.updateUser({ password: haslo });
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    window.location.assign("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-5 p-6">
        <div>
          <h1 className="text-3xl font-bold">Nowe hasło</h1>
          <p className="text-gray-500">Ustaw hasło do swojego konta.</p>
        </div>
        <form onSubmit={zapisz} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="haslo">Nowe hasło</Label>
            <Input id="haslo" type="password" required minLength={6} autoComplete="new-password" value={haslo} onChange={(e) => setHaslo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="powtorz">Powtórz hasło</Label>
            <Input id="powtorz" type="password" required minLength={6} autoComplete="new-password" value={powtorz} onChange={(e) => setPowtorz(e.target.value)} />
          </div>
          {blad && <p className="text-sm text-red-600">{blad}</p>}
          <Button type="submit" className="w-full" disabled={trwa}>
            {trwa ? "Zapisuję…" : "Zapisz hasło"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
