"use client";

import { Button } from "@/components/ui/button";

export function PrzyciskDruku() {
  return (
    <Button onClick={() => window.print()}>Drukuj / zapisz jako PDF</Button>
  );
}
