"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tlumaczBlad } from "@/lib/bledy";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [rejestracja, setRejestracja] = useState(false);
  const [email, setEmail] = useState("");
  const [haslo, setHaslo] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [trwa, setTrwa] = useState(false);

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    setInfo(null);
    setTrwa(true);
    const supabase = createClient();

    if (rejestracja) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: haslo,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setTrwa(false);
      if (error) return setBlad(tlumaczBlad(error.message));
      if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setInfo("Konto utworzone. Kliknij link potwierdzający w wiadomości e-mail, a potem się zaloguj.");
        setRejestracja(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: haslo,
    });
    setTrwa(false);
    if (error) return setBlad(tlumaczBlad(error.message));
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-5 p-6">
        <div>
          <h1 className="text-3xl font-bold">OgarnijTo!</h1>
          <p className="text-gray-500">
            {rejestracja ? "Załóż konto" : "Zaloguj się, żeby ogarnąć dzień"}
          </p>
        </div>
        <form onSubmit={wyslij} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="haslo">Hasło</Label>
            <Input id="haslo" type="password" required minLength={6} autoComplete={rejestracja ? "new-password" : "current-password"} value={haslo} onChange={(e) => setHaslo(e.target.value)} />
          </div>
          {blad && <p className="text-sm text-red-600">{blad}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}
          <Button type="submit" className="w-full" disabled={trwa}>
            {trwa ? "Chwileczkę…" : rejestracja ? "Załóż konto" : "Zaloguj"}
          </Button>
        </form>
        <button type="button" className="text-sm text-gray-500 underline" onClick={() => { setRejestracja(!rejestracja); setBlad(null); setInfo(null); }}>
          {rejestracja ? "Mam już konto" : "Nie mam konta"}
        </button>
      </Card>
    </main>
  );
}
