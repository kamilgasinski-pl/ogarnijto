import Link from "next/link";
import { CalendarDays, Home, ListChecks, LogOut, Users } from "lucide-react";
import { wymagajRodziny } from "@/lib/auth";

const linki = [
  { href: "/", etykieta: "Pulpit", ikona: Home },
  { href: "/zadania", etykieta: "Zadania", ikona: ListChecks },
  { href: "/plan", etykieta: "Plan zajęć", ikona: CalendarDays },
  { href: "/rodzina", etykieta: "Rodzina", ikona: Users },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { osoba } = await wymagajRodziny();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white p-4 md:flex">
        <p className="mb-6 text-xl font-bold">OgarnijTo!</p>
        <nav className="flex flex-1 flex-col gap-1">
          {linki.map(({ href, etykieta, ikona: Ikona }) => (
            <Link key={href} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Ikona size={16} /> {etykieta}
            </Link>
          ))}
        </nav>
        <p className="mb-2 px-3 text-sm text-gray-500">{osoba.imie}</p>
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
            <LogOut size={16} /> Wyloguj
          </button>
        </form>
      </aside>

      <div className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-gray-200 bg-white py-2 md:hidden">
        {linki.map(({ href, etykieta, ikona: Ikona }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-0.5 px-4 text-xs text-gray-700">
            <Ikona size={20} /> {etykieta}
          </Link>
        ))}
        <form action="/auth/signout" method="post">
          <button className="flex flex-col items-center gap-0.5 px-4 text-xs text-gray-700">
            <LogOut size={20} /> Wyloguj
          </button>
        </form>
      </nav>
    </div>
  );
}
