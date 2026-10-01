-- Fix PostgreSQL ambiguity between RETURNS TABLE trainer_name and CTE trainer_name.
create or replace function public.get_leaderboard(
  p_category text,
  p_limit integer default 25
)
returns table (
  rank bigint,
  trainer_name text,
  score bigint,
  updated_at timestamptz,
  is_me boolean,
  player_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if p_category not in (
    'seen',
    'caught',
    'shiny',
    'achievements',
    'endless',
    'endless_bosses',
    'wins',
    'runs',
    'trainer_level'
  ) then
    raise exception 'Unknown leaderboard category';
  end if;

  return query
  with scores as (
    select
      l.user_id,
      l.trainer_name as trainer_name,
      case p_category
        when 'seen' then l.seen_count
        when 'caught' then l.caught_count
        when 'shiny' then l.shiny_caught_count
        when 'achievements' then l.achievement_count
        when 'endless' then l.endless_high_score
        when 'endless_bosses' then l.endless_boss_high_score
        when 'wins' then l.wins
        when 'runs' then l.total_runs
        when 'trainer_level' then l.trainer_level
        else 0::bigint
      end as score,
      l.updated_at
    from public.player_leaderboard l
    join public.profiles p
      on p.user_id = l.user_id
    where p.account_state = 'active'
  ),
  ranked as (
    select
      row_number() over (
        order by
          s.score desc,
          s.updated_at asc,
          lower(s.trainer_name),
          s.user_id
      )::bigint as rank,
      s.user_id,
      s.trainer_name,
      s.score,
      s.updated_at,
      (count(*) over ())::bigint as player_count
    from scores s
  )
  select
    r.rank,
    r.trainer_name,
    r.score,
    r.updated_at,
    (r.user_id = auth.uid()) as is_me,
    r.player_count
  from ranked r
  order by r.rank
  limit v_limit;
end;
$$;

revoke all on function public.get_leaderboard(text, integer) from public;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
