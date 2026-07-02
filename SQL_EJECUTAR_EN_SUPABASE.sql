-- COPIAR TODO ESTO AL SUPABASE SQL EDITOR Y EJECUTAR
-- https://app.supabase.com → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS narrative_pressure (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  pressure_type TEXT NOT NULL,
  description TEXT,
  severity INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  UNIQUE(campaign_id, pressure_type, description)
);
CREATE INDEX IF NOT EXISTS idx_pressure_campaign ON narrative_pressure(campaign_id, resolved_at);

CREATE TABLE IF NOT EXISTS faction_activity (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  faction_name TEXT NOT NULL,
  current_goal TEXT,
  next_step TEXT,
  progress_pct INT DEFAULT 0,
  revealed BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_faction_campaign ON faction_activity(campaign_id);

CREATE TABLE IF NOT EXISTS npc_goals (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  goal TEXT,
  motivation TEXT,
  current_status TEXT DEFAULT 'pursuing',
  user_influence BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_goals_campaign ON npc_goals(campaign_id);

CREATE TABLE IF NOT EXISTS off_screen_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  impact TEXT,
  timing TEXT,
  rumor_text TEXT,
  revealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_events_campaign ON off_screen_events(campaign_id, revealed);

CREATE TABLE IF NOT EXISTS bending_abilities (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  nation TEXT NOT NULL,
  ability_name TEXT NOT NULL,
  proficiency INT DEFAULT 1,
  techniques TEXT,
  limitations TEXT,
  cost TEXT,
  source TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_abilities_campaign ON bending_abilities(campaign_id);

CREATE TABLE IF NOT EXISTS relationships (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  relationship_status TEXT DEFAULT 'neutral',
  affinity INT DEFAULT 0,
  history TEXT,
  last_interaction TIMESTAMPTZ,
  favor_owed TEXT,
  debt TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  UNIQUE(campaign_id, npc_name)
);
CREATE INDEX IF NOT EXISTS idx_relationships_campaign ON relationships(campaign_id);
