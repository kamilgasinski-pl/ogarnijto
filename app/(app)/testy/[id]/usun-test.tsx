"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UsunTest({ id }: { id: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  async function usun() {
    if (!confirm("Usunąć ten test razem z kluczem odpowiedzi?")) return;
    const { error } = await supabase.from("testy").delete().eq("id", id);
    if (!error) router.push("/testy");
  }
  return (
    <button onClick={usun} className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100">
      Usuń
    </button>
  );
}
