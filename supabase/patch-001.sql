-- patch 001 — run this once, after schema.sql
--
-- Two things the first run got wrong.
--
-- 1. `items.id` was `uuid`. The app makes ids with crypto.randomUUID(), which
--    only exists in a secure context — open the page over plain http on a LAN
--    and it falls back to a short string, which a uuid column refuses. The id
--    is never joined on or parsed, so text costs us nothing and can't fail.
--
-- 2. `handle` is unique, and it was derived from the email's local part. Two
--    friends whose addresses both start with "sid" would have collided, and
--    because the handle is created by a trigger on sign-up, the collision
--    would have failed the sign-up itself with an opaque error.

alter table public.items alter column id type text using id::text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := split_part(coalesce(new.email, 'guest'), '@', 1);
  cand text := base;
  n    int  := 1;
begin
  while exists (select 1 from public.profiles where handle = cand) loop
    n := n + 1;
    cand := base || n::text;
  end loop;
  insert into public.profiles (id, handle) values (new.id, cand)
    on conflict (id) do nothing;
  return new;
end $$;
