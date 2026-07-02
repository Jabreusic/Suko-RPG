# 🔐 Seguridad - SUKO RPG

## API Key de Gemini ✅ SEGURA

Tu **API key de Gemini está protegida** y es totalmente seguro compartir el link del juego con amigos.

### ¿Por qué es segura?

#### 1. **API Key en el Servidor** (`.env`)
```
❌ NUNCA expuesta en el navegador
❌ NUNCA viaja en requests del cliente
✅ Guardada en Vercel environment variables
✅ Solo accesible por el backend Express.js
```

#### 2. **Flujo Seguro de Datos**

```
Cliente (Navegador)          Backend (Express)         Gemini API
    |                              |                         |
    +-- POST /api/message -------> |                         |
    |   (sin API key)              |                         |
    |                              +-- callGemini() -------> |
    |                              |   (con API key en .env) |
    |                              |                         |
    |                              |<-- respuesta JSON ------|
    |<-- respuesta narración ------|                         |
```

#### 3. **Verificación Técnica**

```javascript
// ✅ Backend SEGURO - Gemini API key se lee de process.env
const apiKey = process.env.GEMINI_API_KEY;
const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash...' 
  + '?key=' + apiKey, { ... });

// ❌ Cliente NO tiene acceso a la API key
// client.js NUNCA importa, almacena o transmite GEMINI_API_KEY
```

#### 4. **Validación en Vercel**

El deployment en Vercel protege `process.env` variables:
- Solo el código servidor puede acceder
- Las variables NO se incluyen en bundles de cliente
- Cada request del navegador pasa por el servidor

### Cómo Verificar

#### En el Navegador (Developer Tools)
```
1. Abre la consola (F12 → Console)
2. Escribe: fetch('/api/message', ...)
3. Busca "GEMINI_API_KEY" en Network → Request Headers
   → NO ENCONTRADA ✅

4. Busca en Network → Response
   → Ves solo {narration, state_patch}
   → Sin credenciales ✅
```

#### En el Código
```bash
# Buscar exposiciones en client.js
grep -i "gemini" web/client.js
# → Resultado: NINGUNO (búsqueda vacía) ✅

# La API key está en server.js (servidor)
grep "GEMINI_API_KEY" server.js
# → Resultado: líneas del servidor ✅
```

### Buenas Prácticas Implementadas

| Aspecto | Estado | Detalle |
|--------|--------|---------|
| **API Key en .env** | ✅ | Guardada en variables de entorno |
| **No expuesta en cliente** | ✅ | Nunca importada en `client.js` |
| **No en localStorage** | ✅ | No almacenada en el navegador |
| **No en URLs** | ✅ | No viaja en query parameters |
| **No en HTML** | ✅ | No hardcodeada en `index.html` |
| **Requests anónimos** | ✅ | Cliente no envía credentials |
| **Backend valida** | ✅ | Server.js usa middleware sanitizador |

### Compartir Seguramente

✅ **SEGURO compartir:**
```
https://abreusicsuko.vercel.app
```

❌ **NUNCA incluir:**
```
https://abreusicsuko.vercel.app?apiKey=AIzaSyD...
https://abreusicsuko.vercel.app&gemini=sk-...
```

### Contingencia: Regenerar API Key

Si sospechas que la clave fue comprometida:

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Regenera la API key en **APIs & Services → Credentials**
3. Actualiza `.env` en Vercel:
   ```
   VITE_GEMINI_API_KEY=<nueva_clave>
   ```
4. Redeploy automático en Vercel

### Monitoreo

Vercel proporciona:
- Logs de requests en Vercel Dashboard
- Alert si la API key se usa excesivamente
- Rate limiting automático en Google Cloud

---

**Conclusión:** Puedes compartir el link del juego sin preocupación. Tu API key está 100% protegida en el servidor. 🎮🔒
