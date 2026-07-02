# SUKO RPG con Supabase

Esta guia reemplaza el backend de Apps Script/Sheets por Supabase (PostgreSQL + API).

## 1) Crear proyecto en Supabase

1. Crea un proyecto nuevo en Supabase.
2. Copia Project URL y anon key desde Settings > API.
3. En SQL Editor, ejecuta el contenido de supabase/schema.sql.

## 2) Elegir estrategia de backend

Opcion recomendada (segura):
- Cliente web llama a una API propia.
- Esa API usa service role key para operaciones sensibles y llamada a Gemini.
- El cliente nunca recibe service role key ni Gemini API key.

Opcion rapida (desarrollo):
- Cliente usa supabase-js con anon key y autenticacion por email.
- Usa politicas RLS de desarrollo del schema.

## 3) Variables de entorno minimas

Backend/API (o Edge Function):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY

Frontend:
- SUPABASE_URL
- SUPABASE_ANON_KEY

## 4) Mapeo desde Apps Script

- createCampaign -> insert en campaigns, characters, campaign_state
- getCampaignData -> select campaigns + campaign_state + messages
- handlePlayerMessage -> insert user message, llamar Gemini, aplicar patches, insertar assistant message
- getBootstrapData -> listar campaigns activas ordenadas por updated_at

## 5) Primer endpoint sugerido

Crear endpoint POST /api/message:
1. Valida campaign_id y texto.
2. Inserta mensaje de usuario.
3. Lee estado + contexto reciente.
4. Llama Gemini.
5. Aplica cambios en tablas.
6. Inserta respuesta del asistente.
7. Regresa narracion.

## 6) Siguiente paso en este repo

Si quieres, en el siguiente paso te monto:
- cliente.js para reemplazar google.script.run por fetch
- api minimal con Node + Express
- adaptador de queries para las tablas de supabase/schema.sql
