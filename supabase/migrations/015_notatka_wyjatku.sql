-- Notatka do zmiany pojedynczego dnia dojazdu. Można uruchomić wiele razy.
alter table public.dojazdy_wyjatki add column if not exists notatka text;
