-- Dzień, w którym zadanie ma się pojawić na liście "do zrobienia" (przed terminem).
-- Puste = domyślnie: zadania na poniedziałek pokazują się już w niedzielę.
alter table public.zadania add column if not exists na_dzien date;
