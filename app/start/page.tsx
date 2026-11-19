import { redirect } from "next/navigation";
import { pobierzOsobe } from "@/lib/auth";
import { StartForm } from "./start-form";

export default async function StartPage() {
  const { osoba } = await pobierzOsobe();
  if (osoba) redirect("/");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <StartForm />
    </main>
  );
}
