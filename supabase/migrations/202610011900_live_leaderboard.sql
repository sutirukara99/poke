-- PokéRegions live leaderboard
-- Extracts public ranking stats from cloud saves whenever they are synced.

create table if not exists public.player_leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trainer_name text not null default 'Trainer',
  seen_count bigint not null default 0 check (seen_count >= 0),
  caught_count bigint not null default 0 check (caught_count >= 0),
  shiny_caught_count bigint not null default 0 check (shiny_caught_count >= 0),
  achievement_count bigint not null default 0 check (achievement_count >= 0),
  endless_high_score bigint not null default 0 check (endless_high_score >= 0),
  endless_boss_high_score bigint not null default 0 check (endless_boss_high_score >= 0),
  wins bigint not null default 0 check (wins >= 0),
  total_runs bigint not null default 0 check (total_runs >= 0),
  trainer_level bigint not null default 1 check (trainer_level >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists player_leaderboard_seen_idx
  on public.player_leaderboard (seen_count desc, updated_at asc);

create index if not exists player_leaderboard_caught_idx
  on public.player_leaderboard (caught_count desc, updated_at asc);

create index if not exists player_leaderboard_shiny_idx
  on public.player_leaderboard (shiny_caught_count desc, updated_at asc);

create index if not exists player_leaderboard_endless_idx
  on public.player_leaderboard (endless_high_score desc, updated_at asc);

create index if not exists player_leaderboard_wins_idx
  on public.player_leaderboard (wins desc, updated_at asc);

alter table public.player_leaderboard enable row level security;

-- The raw table contains auth UUIDs, so players do not query it directly.
-- Public leaderboard access happens only through get_leaderboard().
revoke all on public.player_leaderboard from anon, authenticated;

drop policy if exists "Admins can read leaderboard rows"
on public.player_leaderboard;

create policy "Admins can read leaderboard rows"
on public.player_leaderboard
for select
to authenticated
using (public.current_user_is_admin());

grant select on public.player_leaderboard to authenticated;


create or replace function public.leaderboard_json_array_length(
  p_value jsonb
)
returns bigint
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_value) = 'array'
      then jsonb_array_length(p_value)::bigint
    else 0::bigint
  end;
$$;


create or replace function public.leaderboard_json_nonnegative_bigint(
  p_value jsonb,
  p_key text,
  p_default bigint default 0
)
returns bigint
language plpgsql
immutable
as $$
declare
  v_text text;
  v_number bigint;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    return greatest(0, p_default);
  end if;

  v_text := p_value ->> p_key;

  if v_text is null or v_text !~ '^[0-9]+$' then
    return greatest(0, p_default);
  end if;

  begin
    v_number := v_text::bigint;
  exception
    when numeric_value_out_of_range then
      return greatest(0, p_default);
  end;

  return greatest(0, v_number);
end;
$$;


create or replace function public.sync_leaderboard_from_cloud_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
  v_name text;
  v_seen bigint;
  v_caught bigint;
  v_shiny bigint;
  v_achievements bigint;
  v_endless bigint;
  v_endless_bosses bigint;
  v_wins bigint;
  v_runs bigint;
  v_level bigint;
begin
  v_profile := case
    when jsonb_typeof(new.save_data -> 'profile') = 'object'
      then new.save_data -> 'profile'
    else '{}'::jsonb
  end;

  select coalesce(
    nullif(trim(v_profile ->> 'name'), ''),
    nullif(trim(p.trainer_name), ''),
    'Trainer'
  )
  into v_name
  from public.profiles p
  where p.user_id = new.user_id;

  if v_name is null then
    v_name := coalesce(nullif(trim(v_profile ->> 'name'), ''), 'Trainer');
  end if;

  v_seen := public.leaderboard_json_array_length(new.save_data -> 'seen');
  v_caught := public.leaderboard_json_array_length(new.save_data -> 'caught');
  v_shiny := public.leaderboard_json_array_length(new.save_data -> 'shinyCaught');
  v_achievements := public.leaderboard_json_array_length(new.save_data -> 'achievements');
  v_endless := public.leaderboard_json_nonnegative_bigint(
    new.save_data,
    'endlessHighScore',
    0
  );
  v_endless_bosses := public.leaderboard_json_nonnegative_bigint(
    new.save_data,
    'endlessBossHighScore',
    0
  );
  v_wins := public.leaderboard_json_nonnegative_bigint(v_profile, 'wins', 0);
  v_level := greatest(
    1,
    public.leaderboard_json_nonnegative_bigint(v_profile, 'level', 1)
  );

  v_runs := public.leaderboard_json_nonnegative_bigint(v_profile, 'totalRuns', 0);
  if v_runs = 0 then
    v_runs := public.leaderboard_json_array_length(new.save_data -> 'history');
  end if;

  insert into public.player_leaderboard (
    user_id,
    trainer_name,
    seen_count,
    caught_count,
    shiny_caught_count,
    achievement_count,
    endless_high_score,
    endless_boss_high_score,
    wins,
    total_runs,
    trainer_level,
    updated_at
  )
  values (
    new.user_id,
    left(v_name, 32),
    v_seen,
    v_caught,
    v_shiny,
    v_achievements,
    v_endless,
    v_endless_bosses,
    v_wins,
    v_runs,
    v_level,
    new.updated_at
  )
  on conflict (user_id)
  do update set
    trainer_name = excluded.trainer_name,
    seen_count = greatest(public.player_leaderboard.seen_count, excluded.seen_count),
    caught_count = greatest(public.player_leaderboard.caught_count, excluded.caught_count),
    shiny_caught_count = greatest(public.player_leaderboard.shiny_caught_count, excluded.shiny_caught_count),
    achievement_count = greatest(public.player_leaderboard.achievement_count, excluded.achievement_count),
    endless_high_score = greatest(public.player_leaderboard.endless_high_score, excluded.endless_high_score),
    endless_boss_high_score = greatest(public.player_leaderboard.endless_boss_high_score, excluded.endless_boss_high_score),
    wins = greatest(public.player_leaderboard.wins, excluded.wins),
    total_runs = greatest(public.player_leaderboard.total_runs, excluded.total_runs),
    trainer_level = greatest(public.player_leaderboard.trainer_level, excluded.trainer_level),
    updated_at = excluded.updated_at;

  return new;
end;
$$;


drop trigger if exists cloud_saves_sync_leaderboard on public.cloud_saves;

create trigger cloud_saves_sync_leaderboard
after insert or update of save_data, updated_at
on public.cloud_saves
for each row
execute function public.sync_leaderboard_from_cloud_save();


create or replace function public.sync_leaderboard_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_leaderboard
  set
    trainer_name = left(new.trainer_name, 32),
    updated_at = greatest(updated_at, new.updated_at)
  where user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists profiles_sync_leaderboard_name on public.profiles;

create trigger profiles_sync_leaderboard_name
after update of trainer_name
on public.profiles
for each row
when (old.trainer_name is distinct from new.trainer_name)
execute function public.sync_leaderboard_name_from_profile();


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
      l.trainer_name,
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
        order by score desc, updated_at asc, lower(trainer_name), user_id
      )::bigint as rank,
      user_id,
      trainer_name,
      score,
      updated_at,
      (count(*) over ())::bigint as player_count
    from scores
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


-- Backfill all existing cloud saves immediately.
insert into public.player_leaderboard (
  user_id,
  trainer_name,
  seen_count,
  caught_count,
  shiny_caught_count,
  achievement_count,
  endless_high_score,
  endless_boss_high_score,
  wins,
  total_runs,
  trainer_level,
  updated_at
)
select
  cs.user_id,
  left(
    coalesce(
      nullif(trim(cs.save_data -> 'profile' ->> 'name'), ''),
      nullif(trim(p.trainer_name), ''),
      'Trainer'
    ),
    32
  ),
  public.leaderboard_json_array_length(cs.save_data -> 'seen'),
  public.leaderboard_json_array_length(cs.save_data -> 'caught'),
  public.leaderboard_json_array_length(cs.save_data -> 'shinyCaught'),
  public.leaderboard_json_array_length(cs.save_data -> 'achievements'),
  public.leaderboard_json_nonnegative_bigint(cs.save_data, 'endlessHighScore', 0),
  public.leaderboard_json_nonnegative_bigint(cs.save_data, 'endlessBossHighScore', 0),
  public.leaderboard_json_nonnegative_bigint(
    case
      when jsonb_typeof(cs.save_data -> 'profile') = 'object'
        then cs.save_data -> 'profile'
      else '{}'::jsonb
    end,
    'wins',
    0
  ),
  greatest(
    public.leaderboard_json_nonnegative_bigint(
      case
        when jsonb_typeof(cs.save_data -> 'profile') = 'object'
          then cs.save_data -> 'profile'
        else '{}'::jsonb
      end,
      'totalRuns',
      0
    ),
    public.leaderboard_json_array_length(cs.save_data -> 'history')
  ),
  greatest(
    1,
    public.leaderboard_json_nonnegative_bigint(
      case
        when jsonb_typeof(cs.save_data -> 'profile') = 'object'
          then cs.save_data -> 'profile'
        else '{}'::jsonb
      end,
      'level',
      1
    )
  ),
  cs.updated_at
from public.cloud_saves cs
left join public.profiles p
  on p.user_id = cs.user_id
on conflict (user_id)
do update set
  trainer_name = excluded.trainer_name,
  seen_count = greatest(public.player_leaderboard.seen_count, excluded.seen_count),
  caught_count = greatest(public.player_leaderboard.caught_count, excluded.caught_count),
  shiny_caught_count = greatest(public.player_leaderboard.shiny_caught_count, excluded.shiny_caught_count),
  achievement_count = greatest(public.player_leaderboard.achievement_count, excluded.achievement_count),
  endless_high_score = greatest(public.player_leaderboard.endless_high_score, excluded.endless_high_score),
  endless_boss_high_score = greatest(public.player_leaderboard.endless_boss_high_score, excluded.endless_boss_high_score),
  wins = greatest(public.player_leaderboard.wins, excluded.wins),
  total_runs = greatest(public.player_leaderboard.total_runs, excluded.total_runs),
  trainer_level = greatest(public.player_leaderboard.trainer_level, excluded.trainer_level),
  updated_at = excluded.updated_at;


insert into public.feature_flags (
  flag_key,
  enabled,
  public_visible,
  description,
  config
)
values (
  'live_leaderboard',
  true,
  true,
  'Öffentliches Live-Leaderboard aus synchronisierten Cloud-Spielständen.',
  '{"refresh_seconds":10,"top_limit":25}'::jsonb
)
on conflict (flag_key) do update set
  enabled = excluded.enabled,
  public_visible = excluded.public_visible,
  description = excluded.description,
  config = excluded.config;
