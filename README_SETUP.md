# SUKO RPG - Setup MVP (Google Sheets + Apps Script + Gemini)

Este MVP crea un RPG narrativo web con guardado automático en Google Sheets.

## Alternativa de backend

Si quieres evitar OAuth de Google Apps Script, usa Supabase como backend:

- Guia: README_SUPABASE.md
- Esquema SQL: supabase/schema.sql

## 1) Crear Google Sheet

1. Crea una hoja nueva en Google Sheets.
2. Nómbrala, por ejemplo: `SUKO_RPG_DB`.

## 2) Abrir Apps Script

1. En la Sheet: `Extensiones > Apps Script`.
2. Se abrirá el editor de Apps Script ligado a la hoja.

## 3) Crear y pegar archivos

Crea estos archivos en Apps Script y pega el contenido exacto desde este proyecto:

- `Code.gs`
- `Gemini.gs`
- `SheetsDB.gs`
- `StateEngine.gs`
- `PromptBuilder.gs`
- `Setup.gs`
- `index.html`
- `style.html`
- `client.html`

Además, activa y pega el manifiesto así:

1. En Apps Script ve a `Project Settings`.
2. Activa `Show "appsscript.json" manifest file in editor`.
3. Abre `appsscript.json` en el panel izquierdo.
4. Reemplaza su contenido con el `appsscript.json` de este repo.

## 4) Inicializar base de datos

1. Guarda todo (`Ctrl+S`).
2. Ejecuta la función `setupDatabase()` desde el selector de funciones.
3. Acepta permisos de Google la primera vez.
4. Verifica que se creen las hojas requeridas.

## 5) Configurar Script Properties

1. En Apps Script: `Project Settings`.
2. En `Script Properties`, añade:
   - `GEMINI_API_KEY` = `TU_API_KEY_AQUI`

Opcional (solo si el script NO está ligado a una hoja):
- `SUKO_SHEET_ID` = `ID_DE_TU_GOOGLE_SHEET`

## 6) Desplegar Web App

1. `Deploy > New deployment`.
2. Tipo: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone with the link` (o la política que prefieras).
5. Deploy y copia la URL.

Nota: si editas `appsscript.json`, vuelve a desplegar una nueva versión para aplicar cambios de manifiesto.

## 7) Probar flujo

1. Abre la URL.
2. Crea campaña con nombre de jugador y personaje.
3. Verás escena inicial automática.
4. Escribe acciones en `¿Qué haces?`.

## Comandos en juego

- `/estado` resumen corto de estado actual.
- `/inventario` inventario actual.
- `/mapa` ubicación, rutas y peligro.
- `/rumores` rumores activos.
- `/relaciones` relación con NPCs.
- `/resumen` crea o devuelve resumen de campaña.
- `/imagen` devuelve prompt visual de la escena actual.

## Cambiar modelo Gemini

El modelo se define en hoja `settings`, clave `GEMINI_MODEL`.

Valor por defecto:
- `gemini-2.5-flash`

Para cambiarlo:
1. Abre hoja `settings`.
2. Edita el valor de `GEMINI_MODEL`.
3. Guarda y prueba un turno.

## Seguridad aplicada en este MVP

- La API key vive solo en Script Properties (`GEMINI_API_KEY`).
- El frontend nunca recibe la API key.
- Validación de `campaign_id`.
- Sanitización básica de texto.
- `LockService` para evitar conflictos de escritura.
- Fallback si Gemini devuelve JSON inválido.
- Registro de errores en hoja `logs`.

## Troubleshooting

### Error: "Falta GEMINI_API_KEY"
- Añade la propiedad en `Project Settings > Script Properties`.

### Error: "No hay hoja activa"
- Usa script ligado a Google Sheet, o define `SUKO_SHEET_ID`.

### La Web App no refleja cambios
- Haz `Deploy > Manage deployments > Edit > Deploy` para nueva versión.
- Si cambiaste `appsscript.json`, crea o actualiza el deployment después de guardar el manifiesto.

### JSON inválido de Gemini
- El sistema usa fallback y registra detalle en hoja `logs`.
- Verifica cuota, modelo, o intenta nuevamente.

### Permisos de ejecución
- Reejecuta `setupDatabase()` manualmente para refrescar permisos.

### Error: "Esta aplicación está bloqueada"
- Este mensaje viene del consentimiento OAuth de Google, no del código del juego.
- No necesitas crear una cuenta aparte de Google Cloud para usar Apps Script, pero sí necesitas acceso al proyecto de Cloud vinculado al script si vas a publicar la app.
- Verifica en el proyecto de Google Cloud asociado al Apps Script que la pantalla de consentimiento esté configurada correctamente.
- Si la app está en modo `Testing`, añade tu cuenta como `test user` o cambia a `Production`.
- Si la vas a compartir fuera de tu dominio, puede requerir verificación de la app porque usa scopes sensibles de Sheets y UrlFetch.
- Después de cambiar la configuración, vuelve a desplegar la web app.

### Pasos exactos si sigue bloqueado
1. Abre el proyecto de Google Cloud asociado al Apps Script.
2. Ve a `APIs y servicios > Pantalla de consentimiento OAuth`.
3. Completa nombre de la app, correo de soporte y dominios autorizados.
4. Si aparece `Testing`, agrega tu cuenta en `Test users`.
5. Publica la pantalla de consentimiento o pásala a `Production`.
6. Vuelve a `Deploy > Manage deployments` y crea un despliegue nuevo.
7. Abre la nueva URL del web app en una ventana privada para forzar la autorización correcta.

### Si no eres el propietario del proyecto
- Solo el propietario del proyecto de Google Cloud puede completar la verificación o cambiar el estado de publicación.
- Si el proyecto no te pertenece, la alternativa es copiar el código a un proyecto nuevo bajo tu control.

### Si solo la quieres usar tú
- Crea el script ligado a tu propia Google Sheet.
- Usa `Deploy > New deployment` solo para tu cuenta y abre la web app con esa misma cuenta.
- Si Google sigue bloqueando el acceso, la salida más rápida es mover el mismo juego a un backend que no dependa de OAuth de Google.

## Limpiar una campaña

Desde Apps Script, ejecuta:

```javascript
clearCampaignData('cmp_xxxxxxxxxxxxxxxx');
```

Esto borra datos narrativos y regenera escena inicial para esa campaña.

## Exportar backup de campaña

Desde Apps Script, ejecuta:

```javascript
const backupJson = exportCampaignBackup('cmp_xxxxxxxxxxxxxxxx');
Logger.log(backupJson);
```

Copia el JSON del log para respaldo externo.

## Notas de operación

- Si falta una hoja o columna, el sistema la crea automáticamente.
- El jugador solo usa la web app; no necesita tocar Google Sheets.
- Cada turno guarda cambios de estado, NPCs, inventario, heridas, rumores, facciones, relaciones y resumen si aplica.
