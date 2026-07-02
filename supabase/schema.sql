-- SUKO RPG schema for Supabase (PostgreSQL)
-- Execute in Supabase SQL editor

create extension if not exists pgcrypto;

-- Core campaign tables
create table if not exists campaigns (
  campaign_id text primary key,
  player_name text not null,
  character_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active'
);

create table if not exists messages (
  id bigserial primary key,
  timestamp timestamptz not null default now(),
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  summary_flag boolean not null default false
);

create table if not exists campaign_state (
  campaign_id text primary key references campaigns(campaign_id) on delete cascade,
  location text not null default '',
  region text not null default '',
  season text not null default '',
  ability text not null default '',
  ability_limits text not null default '',
  fatigue text not null default 'leve',
  current_pressure text not null default '',
  next_hook text not null default '',
  money text not null default '10',
  updated_at timestamptz not null default now()
);

create table if not exists characters (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  character_name text not null,
  origin text not null default '',
  ability text not null default '',
  personality_notes text not null default '',
  visual_profile text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists npcs (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  npc_name text not null,
  role text not null default '',
  location text not null default '',
  trust text not null default '',
  mood text not null default '',
  goal text not null default '',
  fear text not null default '',
  secret text not null default '',
  last_seen text not null default '',
  next_move text not null default '',
  notes text not null default ''
);

create table if not exists relationships (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  npc_name text not null,
  relationship_status text not null default '',
  trust_text text not null default '',
  debt text not null default '',
  promise text not null default '',
  hard_line text not null default '',
  last_change text not null default ''
);

create table if not exists factions (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  faction_name text not null,
  interest_level text not null default '',
  knowledge text not null default '',
  attitude text not null default '',
  next_move text not null default '',
  clock text not null default '',
  notes text not null default ''
);

create table if not exists inventory (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  item text not null,
  quantity text not null default '',
  condition text not null default '',
  notes text not null default ''
);

create table if not exists injuries (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  injury text not null,
  severity text not null default '',
  effect text not null default '',
  recovery_path text not null default '',
  active boolean not null default true
);

create table if not exists rumors (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  rumor text not null,
  source text not null default '',
  reliability text not null default '',
  active boolean not null default true
);

create table if not exists locations (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  location_name text not null,
  region text not null default '',
  known_routes text not null default '',
  danger_level text not null default '',
  notes text not null default ''
);

create table if not exists chapter_summaries (
  id bigserial primary key,
  campaign_id text not null references campaigns(campaign_id) on delete cascade,
  chapter_number text not null,
  summary text not null,
  unresolved_threads text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists visual_continuity (
  campaign_id text primary key references campaigns(campaign_id) on delete cascade,
  subject text not null default '',
  visual_description text not null default '',
  clothing text not null default '',
  injuries text not null default '',
  mood text not null default '',
  last_prompt text not null default ''
);

create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists logs (
  id bigserial primary key,
  timestamp timestamptz not null default now(),
  campaign_id text not null default '',
  level text not null default 'INFO',
  message text not null default '',
  raw text not null default ''
);

-- Defaults
insert into settings(key, value) values
  ('GEMINI_MODEL', 'gemini-2.5-flash'),
  ('MAX_CONTEXT_MESSAGES', '10'),
  ('SUMMARY_TURN_INTERVAL', '10'),
  ('APP_NAME', 'SUKO RPG')
on conflict (key) do nothing;

-- Useful indexes
create index if not exists idx_messages_campaign_time on messages (campaign_id, timestamp);
create index if not exists idx_logs_campaign_time on logs (campaign_id, timestamp);
create index if not exists idx_npcs_campaign on npcs (campaign_id);
create index if not exists idx_inventory_campaign on inventory (campaign_id);
create index if not exists idx_injuries_campaign on injuries (campaign_id);
create index if not exists idx_rumors_campaign on rumors (campaign_id);
create index if not exists idx_locations_campaign on locations (campaign_id);

-- Keep campaign updated_at fresh when messages arrive
create or replace function touch_campaign_updated_at()
returns trigger
language plpgsql
as $$
begin
  update campaigns set updated_at = now() where campaign_id = new.campaign_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_campaign_on_message on messages;
create trigger trg_touch_campaign_on_message
after insert on messages
for each row execute function touch_campaign_updated_at();

-- RLS baseline (adjust for your auth model)
alter table campaigns enable row level security;
alter table messages enable row level security;
alter table campaign_state enable row level security;
alter table characters enable row level security;
alter table npcs enable row level security;
alter table relationships enable row level security;
alter table factions enable row level security;
alter table inventory enable row level security;
alter table injuries enable row level security;
alter table rumors enable row level security;
alter table locations enable row level security;
alter table chapter_summaries enable row level security;
alter table visual_continuity enable row level security;
alter table settings enable row level security;
alter table logs enable row level security;

-- Development policy: authenticated users can read/write everything.
-- Tighten this before production if multiple players share the same project.
drop policy if exists dev_all_campaigns on campaigns;
create policy dev_all_campaigns on campaigns for all to authenticated using (true) with check (true);

drop policy if exists dev_all_messages on messages;
create policy dev_all_messages on messages for all to authenticated using (true) with check (true);

drop policy if exists dev_all_campaign_state on campaign_state;
create policy dev_all_campaign_state on campaign_state for all to authenticated using (true) with check (true);

drop policy if exists dev_all_characters on characters;
create policy dev_all_characters on characters for all to authenticated using (true) with check (true);

drop policy if exists dev_all_npcs on npcs;
create policy dev_all_npcs on npcs for all to authenticated using (true) with check (true);

drop policy if exists dev_all_relationships on relationships;
create policy dev_all_relationships on relationships for all to authenticated using (true) with check (true);

drop policy if exists dev_all_factions on factions;
create policy dev_all_factions on factions for all to authenticated using (true) with check (true);

drop policy if exists dev_all_inventory on inventory;
create policy dev_all_inventory on inventory for all to authenticated using (true) with check (true);

drop policy if exists dev_all_injuries on injuries;
create policy dev_all_injuries on injuries for all to authenticated using (true) with check (true);

drop policy if exists dev_all_rumors on rumors;
create policy dev_all_rumors on rumors for all to authenticated using (true) with check (true);

drop policy if exists dev_all_locations on locations;
create policy dev_all_locations on locations for all to authenticated using (true) with check (true);

drop policy if exists dev_all_chapter_summaries on chapter_summaries;
create policy dev_all_chapter_summaries on chapter_summaries for all to authenticated using (true) with check (true);

drop policy if exists dev_all_visual_continuity on visual_continuity;
create policy dev_all_visual_continuity on visual_continuity for all to authenticated using (true) with check (true);

drop policy if exists dev_read_settings on settings;
create policy dev_read_settings on settings for select to authenticated using (true);

drop policy if exists dev_insert_logs on logs;
create policy dev_insert_logs on logs for insert to authenticated with check (true);
