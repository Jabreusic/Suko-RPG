# SUKO RPG - Migración a Supabase (resumen rápido)

Tenías Apps Script bloqueado por OAuth. Ahora vamos con Supabase + Node.js backend.

## Paso 1: Crear proyecto en Supabase

1. Crea una cuenta en [supabase.com](https://supabase.com)
2. Nuevo proyecto
3. Copia Project URL y Service Role Key desde Settings > API

## Paso 2: Configurar variables de entorno

Copia `.env.example` a `.env` y rellena:
- `SUPABASE_URL` - URL de tu proyecto
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `GEMINI_API_KEY` - Tu API key de Gemini

```bash
cp .env.example .env
# Edita .env con tus valores
```

## Paso 3: Crear esquema SQL en Supabase

1. Abre SQL Editor en tu proyecto Supabase
2. Copia todo el contenido de `supabase/schema.sql`
3. Ejecuta

## Paso 4: Instalar y arrancar servidor

```bash
npm install
npm start
```

Abre `http://localhost:3000` en tu navegador.

## Archivos claves

- `server.js` - Backend con Express + Supabase + Gemini
- `web/index.html` - Frontend UI (estático)
- `web/client.js` - Cliente que reemplaza google.script.run
- `web/style.css` - Estilos
- `supabase/schema.sql` - Esquema de base de datos
- `.env` - Variables de entorno (crea desde .env.example)

## Endpoints disponibles

- POST `/api/campaign` - Crear campaña
- GET `/api/campaign/:id` - Cargar campaña
- GET `/api/bootstrap` - Listar campañas
- POST `/api/message` - Enviar mensaje y obtener respuesta de Gemini
- POST `/api/log` - Registrar errores del cliente

## Flujo simplificado vs Apps Script

- **Antes**: google.script.run -> Apps Script -> Sheets
- **Ahora**: fetch -> Node.js server -> Supabase (PostgreSQL)

Las funciones son idénticas, solo cambia dónde corren.

## Siguientes pasos

- Agregar más comandos (`/mapa`, `/inventario`, etc.)
- Agregar autenticación de usuarios
- Desplegar a la nube (Vercel, Railway, etc.)
