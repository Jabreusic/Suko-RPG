# Extensiones de Schema SQL - Presión Narrativa y Sistemas Avanzados

## Tablas Sugeridas a Agregar

### 1. narrative_pressure
Rastrea presión activa sobre el jugador en la campaña.

```sql
CREATE TABLE narrative_pressure (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  pressure_type TEXT NOT NULL, -- 'time', 'resource', 'relation', 'secret', 'pursuit'
  description TEXT,
  severity INT DEFAULT 1, -- 1-10
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  UNIQUE(campaign_id, pressure_type, description)
);

CREATE INDEX idx_pressure_campaign ON narrative_pressure(campaign_id, resolved_at);
```

### 2. faction_activity
Rastrea objetivos y progresos de facciones sin el jugador.

```sql
CREATE TABLE faction_activity (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  faction_name TEXT NOT NULL, -- 'Ember Court', 'Lotus Vigil', etc.
  current_goal TEXT,
  next_step TEXT,
  progress_pct INT DEFAULT 0, -- 0-100
  revealed BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);

CREATE INDEX idx_faction_campaign ON faction_activity(campaign_id);
```

### 3. npc_goals
NPCs con objetivos personales que evolucionan.

```sql
CREATE TABLE npc_goals (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  goal TEXT,
  motivation TEXT, -- Corto: por qué lo quiere
  current_status TEXT, -- 'pursuing', 'resolved', 'abandoned'
  user_influence BOOLEAN DEFAULT FALSE, -- ¿El jugador afectó?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);

CREATE INDEX idx_npc_goals_campaign ON npc_goals(campaign_id);
```

### 4. off_screen_events
Eventos que ocurren cuando el jugador NO está mirando.

```sql
CREATE TABLE off_screen_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'faction_progress', 'npc_action', 'world_change', 'consequence'
  description TEXT,
  impact TEXT, -- Cómo afecta al jugador indirectamente
  timing TEXT, -- 'immediate', 'delayed', 'random'
  rumor_text TEXT, -- Cómo se enteraría el jugador
  revealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);

CREATE INDEX idx_events_campaign ON off_screen_events(campaign_id, revealed);
```

### 5. bending_abilities
Registro de técnicas de doblado que el personaje conoce.

```sql
CREATE TABLE bending_abilities (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  nation TEXT NOT NULL, -- 'Fire', 'Water', 'Earth', 'Air'
  ability_name TEXT NOT NULL, -- 'Lightning', 'Healing', 'Bloodbending', etc.
  proficiency INT DEFAULT 1, -- 1-5 (novice to master)
  techniques TEXT, -- JSON array de movimientos específicos
  limitations TEXT, -- Requisitos para usar
  cost TEXT, -- En términos narrativos/stamina
  source TEXT, -- De dónde aprendió
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
);

CREATE INDEX idx_abilities_campaign ON bending_abilities(campaign_id);
```

### 6. relationships
Seguimiento de relaciones con NPCs y factores que las afectan.

```sql
CREATE TABLE relationships (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campaign_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  relationship_status TEXT, -- 'ally', 'neutral', 'rival', 'enemy', 'lover', 'mentor'
  affinity INT DEFAULT 0, -- -100 to 100 (enemy to ally)
  history TEXT, -- Breve resumen de interacciones
  last_interaction TIMESTAMPTZ,
  favor_owed TEXT, -- Si el NPC debe al jugador
  debt TEXT, -- Si el jugador debe al NPC
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  UNIQUE(campaign_id, npc_name)
);

CREATE INDEX idx_relationships_campaign ON relationships(campaign_id);
```

## Migración SQL Completa

```sql
-- Ejecutar TODOS estos SELECTs primero para validar que existen las tablas base:
SELECT COUNT(*) FROM campaigns;
SELECT COUNT(*) FROM campaign_state;

-- Luego ejecutar INSERTs para las nuevas tablas:

INSERT INTO narrative_pressure (campaign_id, pressure_type, description, severity)
SELECT id, 'time', 'Recursos escasos - necesitas dinero en 3 días', 5
FROM campaigns
WHERE status = 'active'
LIMIT 1;

INSERT INTO faction_activity (campaign_id, faction_name, current_goal, next_step, progress_pct)
SELECT id, 'Ember Court Remnant', 'Sabotage del Conciliador', 'Reclutar generales militares', 40
FROM campaigns
WHERE status = 'active'
LIMIT 1;

INSERT INTO npc_goals (campaign_id, npc_name, goal, motivation)
SELECT id, 'Toma Ashgrave', 'Ganar campeonato de duelos ilegales', 'Orgullo y reputación', 
FROM campaigns
WHERE status = 'active'
LIMIT 1;
```

## Instrucciones de Implementación en Backend

### Paso 1: Ejecutar schema en Supabase SQL Editor
Copia el contenido de `supabase/schema_extensions.sql` y ejecuta.

### Paso 2: Actualizar server.js
Agregar endpoint `/api/pressure` que retorna presión narrativa:

```javascript
app.get('/api/pressure/:campaignId', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);
    
    const { data: pressures } = await supabase
      .from('narrative_pressure')
      .select('*')
      .eq('campaign_id', campaignId)
      .is('resolved_at', null);
    
    const { data: factions } = await supabase
      .from('faction_activity')
      .select('*')
      .eq('campaign_id', campaignId);
    
    res.json({ ok: true, pressures, factions });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

### Paso 3: Actualizar prompt de Gemini
Incluir referencias a presión narrativa activa en cada respuesta:

```
Si hay presión narrativa activa, menciona cómo la escena la refleja.
Las facciones avanzan sus objetivos. Si es relevante, muestra signos.
Los NPCs tienen metas - reflejar progreso o fricción con el jugador.
```

## Ejemplo de Uso en Campaña

**Turno 1**: 
- Presión: "Tienes 3 días para pagar deuda a Lantern Road"
- Facción: "Ember Court recluta exmilitares (20% completado)"
- NPC: "Toma Ashgrave gana su primer duelo ilegal"

**Turno 5**:
- Jugador actúa: Paga deuda pero pierde dinero crítico
- Presión evoluciona: "Recursos críticos - debes trabajar o robar"
- Facción avanza: "Ember Court tiene 50% de generales - próximo: sabotaje"
- Off-screen: "Se rumorea que hay un conspirador en la corte"

**Turno 10**:
- Jugador descubre: "Toma Ashgrave fue ofrecido dinero para asesinar a rival"
- Nueva presión: "¿Advertir a rival? ¿Chantajear a Toma?"
- Facción crítica: "Ember Court está 80% listo para golpe"
- Relación: Toma ve al jugador - ¿Rival o aliado? Depende de decisiones previas

---

## Notas Implementación

- **No cargar TODO en cada mensaje**: Mantener contexto, mostrar presión relevante
- **Avanzar facciones silenciosamente**: El jugador descubre efectos, no el motor
- **Relaciones duraderas**: Si el jugador ayuda a Toma, recuerda. Si lo ignora, también.
- **Ruinas múltiples**: Cada NPC tiene vida propia; no espera al jugador para actuar

