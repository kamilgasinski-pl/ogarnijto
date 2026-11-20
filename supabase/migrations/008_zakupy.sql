-- Zakupy: lista zakupów to zadanie z kategorią "zakupy", a pozycje to zadania cząstkowe.
-- Każda pozycja pamięta, kto ją dopisał (dodal), i może mieć ilość (np. "2 l", "3 szt.").
alter table public.zadania drop constraint if exists zadania_kategoria_check;
alter table public.zadania
  add constraint zadania_kategoria_check
  check (kategoria in ('lekcje', 'do_szkoly', 'platnosc', 'transport', 'inne', 'zakupy'));

alter table public.podzadania add column if not exists ilosc text;
alter table public.podzadania
  add column if not exists dodal uuid default auth.uid() references public.osoby (id) on delete set null;
