with ranked_sessions as (
  select
    ctid,
    row_number() over (
      partition by session_id
      order by "timestamp" desc nulls last, ctid desc
    ) as row_number
  from public.feed_sessions
  where session_id is not null
)
delete from public.feed_sessions as target
using ranked_sessions
where target.ctid = ranked_sessions.ctid
  and ranked_sessions.row_number > 1;

alter table public.feed_sessions
  add constraint feed_sessions_session_id_key unique (session_id);
