-- Wykonanego zadania nie da się ponownie otworzyć (odznaczyć), chyba że robi to rodzic.
-- Chroni też przed przypadkowym cofnięciem z nieaktualnego widoku na drugim urządzeniu.
create or replace function public.zadania_przed_zapisem()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'zrobione' and new.status = 'do_zrobienia'
     and not public.jestem_rodzicem() then
    raise exception 'Wykonane zadanie może ponownie otworzyć tylko rodzic';
  end if;
  new.updated_at := now();
  if new.status = 'zrobione' and (tg_op = 'INSERT' or old.status is distinct from 'zrobione') then
    new.wykonane_at := now();
    new.wykonane_przez := auth.uid();
  elsif new.status = 'do_zrobienia' then
    new.wykonane_at := null;
    new.wykonane_przez := null;
  end if;
  return new;
end
$$;
