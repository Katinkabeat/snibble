-- sn_recent_match_rule_ids
--
-- Returns the base_rule_ids for the most recent N matches involving
-- any of the supplied user IDs. Used by createMatch to dedup rule
-- pairs the players have already seen, so back-to-back matches don't
-- repeat combos.
--
-- security definer because RLS on sn_match_rounds restricts opponent
-- match data to participants only, but for friend-invite dedup we
-- need to peek at the invitee's history. Only the rule IDs are
-- returned — letters, scores, and submissions stay protected.

create or replace function public.sn_recent_match_rule_ids(
  p_user_ids uuid[],
  p_limit    int default 15
)
returns table(rule_ids text[])
language sql
security definer
stable
set search_path = public
as $$
  with target_users as (
    select unnest(p_user_ids) as uid
  ),
  per_user_recent as (
    select
      tu.uid,
      m.id,
      m.created_at,
      row_number() over (partition by tu.uid order by m.created_at desc) as rn
    from target_users tu
    join public.sn_matches m
      on (m.creator_id = tu.uid or m.opponent_id = tu.uid)
  ),
  recent_matches as (
    select distinct id from per_user_recent where rn <= p_limit
  )
  select r.base_rule_ids as rule_ids
  from public.sn_match_rounds r
  where r.match_id in (select id from recent_matches);
$$;

grant execute on function public.sn_recent_match_rule_ids(uuid[], int) to authenticated;
