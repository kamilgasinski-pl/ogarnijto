-- Zmiana pojedynczego dnia dojazdu może też zmienić środek transportu i osobę. Można uruchomić wiele razy.
alter table public.dojazdy_wyjatki add column if not exists rodzaj text check (rodzaj in ('autobus', 'samochod'));
alter table public.dojazdy_wyjatki add column if not exists przypisano_id uuid;
alter table public.dojazdy_wyjatki add column if not exists tytul text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dojazdy_wyjatki_przypisano_fk') then
    alter table public.dojazdy_wyjatki
      add constraint dojazdy_wyjatki_przypisano_fk
      foreign key (rodzina_id, przypisano_id)
      references public.osoby (rodzina_id, id) on delete set null (przypisano_id);
  end if;
end $$;
