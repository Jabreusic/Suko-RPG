# Arranca SUKO RPG con Supabase - Pasos exactos

## 1. Crea proyecto en Supabase

Entra en https://supabase.com, crea un proyecto nuevo. Cuando se cree, copia:
- **Project URL** (Settings > API)
- **Service Role Key** (Settings > API)

## 2. Copia y rellena .env

```bash
cp .env.example .env
```

Abre `.env` y pega:
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GEMINI_API_KEY=tu-gemini-api-key
PORT=3000
```

## 3. Ejecuta schema en Supabase

1. En tu proyecto Supabase, ve a SQL Editor
2. Pega TODO el contenido de `supabase/schema.sql`
3. Ejecuta (click Play)

## 4. Arranca el servidor

```bash
npm install
npm start
```

Verás:
```
SUKO RPG backend escuchando en http://localhost:3000
```

## 5. Abre en navegador

```
http://localhost:3000
```

Listo. Ya funciona sin OAuth de Google bloqueando nada.

## Si algo falla

- ¿Falta .env? Copia `.env.example` a `.env`
- ¿Errores de Supabase? Verifica que copiaste bien la URL y key
- ¿Errores de Gemini? Verifica API key válida
- ¿No conecta a Supabase? Mira la consola del servidor (busca logs de error)
