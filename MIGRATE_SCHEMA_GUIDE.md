# 🗄️ Ejecutar Extensiones de Schema en Supabase

## 📋 Opción 1: Manual (Recomendado - Más Rápido)

### Paso 1: Obtén la Connection String

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto **ugkzdbldwgtktgzdtzld**
3. Ve a **Project Settings** → **Database** → **Connection String**
4. Copia la versión **URI** (empieza con `postgresql://`)
5. Reemplaza `[YOUR-PASSWORD]` con tu contraseña de PostgreSQL

### Paso 2: Ejecuta el Script

```bash
# Linux/Mac
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.supabase.co:5432/postgres"
node migrate_schema_extensions.js

# O en una sola línea:
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.supabase.co:5432/postgres" node migrate_schema_extensions.js
```

### Paso 3: Verifica los Resultados

Deberías ver:
```
✅ narrative_pressure
✅ faction_activity
✅ npc_goals
✅ off_screen_events
✅ bending_abilities
✅ relationships
```

---

## 📋 Opción 2: Via Dashboard (Si no quieres usar script)

### En Supabase SQL Editor:

1. Ve a **SQL Editor** en tu dashboard
2. Haz click en **New Query**
3. Copia este SQL:

```sql
-- Crear todas las tablas de extensión
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
```

4. Haz click en **Run** (o `Cmd+Enter`)
5. ¡Listo! Las tablas se han creado.

---

## ✅ Verificar Creación

Ejecuta esto en SQL Editor para confirmar:

```sql
SELECT 
  'narrative_pressure' as table_name, COUNT(*) as row_count 
FROM narrative_pressure
UNION ALL
SELECT 'faction_activity', COUNT(*) FROM faction_activity
UNION ALL
SELECT 'npc_goals', COUNT(*) FROM npc_goals
UNION ALL
SELECT 'off_screen_events', COUNT(*) FROM off_screen_events
UNION ALL
SELECT 'bending_abilities', COUNT(*) FROM bending_abilities
UNION ALL
SELECT 'relationships', COUNT(*) FROM relationships;
```

Deberías ver 6 filas con 0 rows (nuevas y vacías).

---

## 🎯 ¿Cuál Usar?

| Opción | Ventaja | Desventaja |
|--------|---------|-----------|
| **Script** | Automatizado, futuro-proof | Requiere connection string |
| **Dashboard** | Visual, sin código | Manual, error-prone |

Recomendación: **Script** si tienes la connection string, **Dashboard** si prefieres no trabajar con terminales.
