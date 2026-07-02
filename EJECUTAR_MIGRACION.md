# 🔧 Migración de Extensiones de Schema - SUKO RPG

Las tablas para el sistema avanzado de presión narrativa necesitan ser creadas en tu base de datos Supabase.

**Tablas a crear:**
- `narrative_pressure` - Presión narrativa activa sobre el jugador
- `faction_activity` - Actividad de facciones sin el jugador
- `npc_goals` - Objetivos personales de NPCs
- `off_screen_events` - Eventos que ocurren sin el jugador
- `bending_abilities` - Técnicas de bendición del personaje
- `relationships` - Dinámicas con NPCs

## 🚀 Opción 1: Asistente Interactivo (Recomendado)

El script te guía paso a paso:

```bash
node migrate_schema_interactive.js
```

Te pedirá tu connection string de Supabase y ejecutará todo automáticamente.

---

## 🔌 Opción 2: Script Automático

Si ya tienes tu connection string:

```bash
# Reemplaza YOUR_PASSWORD con tu contraseña de PostgreSQL
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.supabase.co:5432/postgres"
node migrate_schema_extensions.js
```

---

## 📋 Opción 3: Manual (Via Dashboard)

1. Ve a tu [Supabase Dashboard](https://app.supabase.com)
2. Proyecto: **ugkzdbldwgtktgzdtzld**
3. Ve a **SQL Editor** → **New Query**
4. Copia el contenido de `supabase/schema_extensions.sql`
5. Pega en el editor y haz click **Run**
6. ¡Listo!

---

## 📍 ¿Dónde obtener la Connection String?

1. Supabase Dashboard > Project Settings > Database > Connection strings
2. Copia la versión **URI** (postgresql://...)
3. Reemplaza `[YOUR-PASSWORD]` con tu contraseña

---

## ✅ Verificar Creación

Ejecuta en SQL Editor:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'narrative_pressure',
    'faction_activity', 
    'npc_goals',
    'off_screen_events',
    'bending_abilities',
    'relationships'
  )
ORDER BY table_name;
```

Deberías ver 6 tablas listadas.

---

## 🎯 Recomendación

**Para usuarios sin experiencia con línea de comandos:**
→ Usa Opción 3 (Manual en Dashboard)

**Para usuarios con Node.js:**
→ Usa Opción 1 (Asistente Interactivo)

**Para CI/CD o automatización:**
→ Usa Opción 2 (Script con DATABASE_URL)

---

## 🆘 Troubleshooting

**Error: "role "postgres" does not exist"**
- Tu contraseña es incorrecta
- Verifica en Supabase Dashboard

**Error: "already exists"**
- Las tablas ya están creadas ✅
- Es seguro ejecutar de nuevo

**Error: "permission denied"**
- Tu usuario no tiene permisos
- Usa el usuario `postgres` (default)

---

## 📚 Próximos Pasos

Después de ejecutar las migraciones:

1. **Integrar Gemini Prompt Mejorado**
   - Ver: `docs/GEMINI_PROMPT_MEJORADO.md`
   - Reemplazar prompt en `server.js`

2. **Agregar Endpoints Backend**
   - `/api/pressure/:campaignId` - Obtener presión narrativa
   - `/api/factions/:campaignId` - Obtener estado de facciones
   - `/api/npc-goals/:campaignId` - Obtener objetivos de NPCs

3. **Actualizar Frontend**
   - Nuevo panel "Presión" en sidebar
   - Mostrar presiones activas
   - Indicadores visuales de facciones

4. **Implementar Generador de Off-Screen Events**
   - Eventos aleatorios entre turnos del jugador
   - Impacto en presión y relaciones

---

¿Preguntas? Ver `docs/SCHEMA_EXTENSIONS.md` para detalles completos.
