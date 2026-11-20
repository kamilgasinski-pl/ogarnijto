-- Rozróżnienie dowozu (zawiezienie) i odwozu (odebranie): trzeci rodzaj dojazdu.
-- Dotychczasowe wpisy "odwoz" zostają odwozami (odbiór).
alter table public.dojazdy drop constraint if exists dojazdy_rodzaj_check;
alter table public.dojazdy
  add constraint dojazdy_rodzaj_check check (rodzaj in ('autobus', 'dowoz', 'odwoz'));
