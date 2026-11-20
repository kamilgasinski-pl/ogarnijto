-- Dojazdy: pojazd (autobus / samochód rodzica) i kierunek (odjazd / przyjazd).
-- Dotychczasowy rodzaj "odwoz" (samochód, odbiór) staje się: samochód + przyjazd.
alter table public.dojazdy drop constraint if exists dojazdy_rodzaj_check;
alter table public.dojazdy add column if not exists kierunek text not null default 'odjazd';
update public.dojazdy set kierunek = 'przyjazd' where rodzaj = 'odwoz';
update public.dojazdy set rodzaj = 'samochod' where rodzaj in ('odwoz', 'dowoz');
alter table public.dojazdy add constraint dojazdy_rodzaj_check check (rodzaj in ('autobus', 'samochod'));
alter table public.dojazdy drop constraint if exists dojazdy_kierunek_check;
alter table public.dojazdy add constraint dojazdy_kierunek_check check (kierunek in ('odjazd', 'przyjazd'));
