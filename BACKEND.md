# SUKO RPG Backend (Supabase + Node.js + Gemini)

Backend mínimo con Express que reemplaza Apps Script.

## Setup rápido

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Crear archivo `.env` en la raíz del proyecto:**
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
   GEMINI_API_KEY=tu-gemini-api-key-aqui
   PORT=3000
   ```

3. **Ejecutar schema SQL en Supabase:**
   - Abre el SQL Editor de tu proyecto Supabase
   - Copia y ejecuta el contenido de `supabase/schema.sql`

4. **Iniciar servidor:**
   ```bash
   npm start
   ```

   O en desarrollo (con auto-reload):
   ```bash
   npm run dev
   ```

5. **Abrir en navegador:**
   ```
   http://localhost:3000
   ```

## Endpoints disponibles

### GET /api/bootstrap
Carga lista de campañas y configuración inicial.

Response:
```json
{
  "ok": true,
  "appName": "SUKO RPG",
  "campaigns": [...]
}
```

### POST /api/campaign
Crea una nueva campaña.

Body:
```json
{
  "playerName": "Juan",
  "characterName": "Suko"
}
```

Response:
```json
{
  "ok": true,
  "campaign_id": "cmp_...",
  "player_name": "Juan",
  "character_name": "Suko"
}
```

### GET /api/campaign/:campaignId
Carga datos de una campaña.

Response:
```json
{
  "ok": true,
  "campaign": {...},
  "state": {...},
  "messages": [...]
}
```

### POST /api/message
Envía mensaje del jugador y obtiene respuesta de Gemini.

Body:
```json
{
  "campaignId": "cmp_...",
  "message": "Intento abrir la puerta"
}
```

Response:
```json
{
  "ok": true,
  "campaign_id": "cmp_...",
  "narration": "La puerta cede..."
}
```

## Estructura

- `server.js` - Servidor Express con todas las rutas
- `web/index.html` - Frontend UI
- `web/client.js` - Cliente JavaScript (fetch-based, no google.script.run)
- `web/style.css` - Estilos
- `supabase/schema.sql` - Esquema de base de datos
- `.env` - Variables de entorno (no versionado)
