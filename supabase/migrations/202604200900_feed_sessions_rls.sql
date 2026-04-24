begin;

do $$
declare
  existing_policy text;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_sessions'
  loop
    execute format('drop policy if exists %I on public.feed_sessions', existing_policy);
  end loop;
end
$$;

alter table public.feed_sessions enable row level security;

revoke all on table public.feed_sessions from public;
revoke all on table public.feed_sessions from anon;
revoke all on table public.feed_sessions from authenticated;

grant insert on table public.feed_sessions to anon;
grant insert on table public.feed_sessions to authenticated;

create policy "feed_sessions_insert_only"
on public.feed_sessions
for insert
to anon, authenticated
with check (
  session_id is not null
  and session_id <> ''
  and "timestamp" is not null
  and total_time >= 0
  and humor_ms >= 0
  and berita_ms >= 0
  and wisata_ms >= 0
  and makanan_ms >= 0
  and olahraga_ms >= 0
  and game_ms >= 0
  and app_version is not null
  and app_version <> ''
);

comment on policy "feed_sessions_insert_only" on public.feed_sessions is
  'Allows anonymous participant clients to insert completed study session reports without read, update, or delete access.';

commit;
