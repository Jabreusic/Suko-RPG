import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import fs from 'fs';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Leer index.html al iniciar
let indexHtmlContent = '';
try {
  indexHtmlContent = fs.readFileSync(join(__dirname, 'web', 'index.html'), 'utf-8');
} catch (err) {
  console.error('Error leyendo index.html:', err.message);
}

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde 'web'
app.use(express.static(join(__dirname, 'web'), {
  extensions: ['html', 'js', 'css']
}));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helpers
function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeId(id) {
  const clean = sanitizeText(id);
  if (!/^cmp_[a-zA-Z0-9]{8,40}$/.test(clean)) {
    throw new Error('campaign_id inválido.');
  }
  return clean;
}

function generateCampaignId() {
  return 'cmp_' + crypto.randomBytes(10).toString('hex').slice(0, 20);
}

async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en .env');
  }

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [{
      role: 'user',
      parts: [{ text: promptText }]
    }],
    generationConfig: {
      responseMimeType: 'text/plain',
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    // Gemini devolvió respuesta vacía - retornar algo sensible
    return {
      narration: 'El momento queda suspendido, como si el mundo contuviera el aliento.',
      state_patch: {}
    };
  }

  try {
    // Try JSON parse first (in case we got JSON back)
    return JSON.parse(text);
  } catch (err) {
    // JSON parse failed - just use the text as plain narration
    // This is expected in text/plain mode
    return {
      narration: text.trim() || 'La escena queda suspendida un instante.',
      state_patch: {}
    };
  }
}

async function ensureDatabaseIntegrity() {
  // Verificar que exista configuración inicial
  const { data } = await supabase
    .from('settings')
    .select('key')
    .eq('key', 'APP_NAME')
    .single();

  if (!data) {
    const defaultSettings = [
      { key: 'GEMINI_MODEL', value: 'gemini-2.5-flash' },
      { key: 'MAX_CONTEXT_MESSAGES', value: '10' },
      { key: 'SUMMARY_TURN_INTERVAL', value: '10' },
      { key: 'APP_NAME', value: 'SUKO RPG' }
    ];
    await supabase.from('settings').upsert(defaultSettings);
  }
}

async function getSetting(key) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value || '';
}

async function logEvent(campaignId, level, message, raw) {
  await supabase.from('logs').insert({
    campaign_id: campaignId || '',
    level: level || 'INFO',
    message: message || '',
    raw: raw ? String(raw).slice(0, 45000) : ''
  });
}

// Generar presión narrativa dinámica durante gameplay
async function triggerDynamicPressure(campaignId) {
  // 40% de probabilidad de generar nueva presión
  if (Math.random() > 0.4) return;

  const pressureTypes = [
    { type: 'political', desc: 'Concilio detecta movimiento de Tribunal Ember en tu región' },
    { type: 'economic', desc: 'Precio de alimentos aumenta por restricción comercial' },
    { type: 'personal', desc: 'Un NPC te busca con urgencia' },
    { type: 'magical', desc: 'Anomalía espiritual reportada en las cercanías' },
    { type: 'time', desc: 'Plazo importante se acerca rápidamente' }
  ];

  const chosen = pressureTypes[Math.floor(Math.random() * pressureTypes.length)];
  
  try {
    await supabase.from('narrative_pressure').insert({
      campaign_id: campaignId,
      pressure_type: chosen.type,
      description: chosen.desc,
      severity: Math.floor(Math.random() * 5) + 1,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.log('[TRIGGER PRESSURE ERROR]', err.message);
  }
}

// Generar actividad factional
async function triggerFactionActivity(campaignId) {
  // 25% de probabilidad
  if (Math.random() > 0.25) return;

  const factions = [
    { faction: 'Tribunal Ember', goal: 'Recluta en mercados por la noche' },
    { faction: 'Concilio Reconciliación', goal: 'Establece oficina de gobierno local' },
    { faction: 'Vigilia del Loto', goal: 'Investiga corrupción en templos' },
    { faction: 'Recolectores de Arboledas', goal: 'Protesta contra minería ilegal' },
    { faction: 'Linterna Road', goal: 'Expande red de tráfico de favores' }
  ];

  const chosen = factions[Math.floor(Math.random() * factions.length)];

  try {
    await supabase.from('faction_activity').insert({
      campaign_id: campaignId,
      faction_name: chosen.faction,
      current_goal: chosen.goal,
      next_step: 'Monitorear desarrollo',
      progress_pct: Math.floor(Math.random() * 40) + 10,
      revealed: false,
      last_updated: new Date().toISOString()
    });
  } catch (err) {
    console.log('[TRIGGER FACTION ERROR]', err.message);
  }
}

function processCommandAction(message, state) {
  // Procesa comandos básicos y avanzados
  const msg = message.toLowerCase().trim();
  
  // COMANDOS BÁSICOS
  if (msg.startsWith('/decir')) {
    const text = message.slice(6).trim();
    return text ? `Dices en voz alta: "${text}"` : 'Abres la boca pero ningún sonido sale.';
  }
  
  if (msg.startsWith('/examinar')) {
    const target = message.slice(9).trim();
    return target ? `Examinas cuidadosamente ${target}. Notas detalles interesantes...` : 'Miras a tu alrededor, pero no ves nada particular.';
  }
  
  if (msg.startsWith('/atacar')) {
    const target = message.slice(7).trim();
    return target ? `Te lanzas al ataque contra ${target} con toda tu furia!` : 'Pero... ¿atacar a qué?';
  }
  
  if (msg.startsWith('/usar')) {
    const item = message.slice(5).trim();
    return item ? `Usas ${item}. Algo sucede...` : 'Necesitas especificar qué usar.';
  }
  
  if (msg.startsWith('/hablar')) {
    const target = message.slice(7).trim();
    return target ? `Inicias una conversación con ${target}.` : 'No hay nadie aquí para hablar.';
  }
  
  if (msg.startsWith('/buscar')) {
    const thing = message.slice(7).trim();
    return thing ? `Buscas ${thing} cuidadosamente. Quizás encuentres algo...` : 'Hurgues sin rumbo fijo en los alrededores.';
  }
  
  if (msg.startsWith('/hacer')) {
    const action = message.slice(6).trim();
    return action ? `Intentas ${action}. La situación cambia sutilmente.` : 'Permaneces quieto, reflexionando.';
  }
  
  // COMANDOS AVANZADOS
  if (msg.startsWith('/combate')) {
    const enemy = message.slice(8).trim();
    if (!enemy) return 'Especifica contra quién combatirás: /combate [enemigo]';
    return `⚔️ Combate iniciado contra ${enemy}.\nRolada (1-20): ${Math.floor(Math.random() * 20) + 1}\n${enemy} resiste. Describe tu próximo movimiento.`;
  }
  
  if (msg.startsWith('/negociar')) {
    const target = message.slice(9).trim();
    if (!target) return 'Con quién negociarás: /negociar [NPC/facción]';
    return `💬 Abres negociación con ${target}.\n"Escucho lo que propones..." dice ${target}.\nPresenta tu oferta o argumento.`;
  }
  
  if (msg.startsWith('/estudiar')) {
    const tech = message.slice(9).trim();
    if (!tech) return 'Qué técnica quieres estudiar: /estudiar [técnica]';
    return `📖 Comienzas a estudiar ${tech}.\nTe sumergirás en entrenamiento intenso durante días. Los progresos requieren práctica y mentoring de alguien experimentado.`;
  }
  
  if (msg.startsWith('/viajar')) {
    const destination = message.slice(7).trim();
    if (!destination) return 'Adónde viajas: /viajar [destino]';
    return `🛣️ Inicias viaje hacia ${destination}.\nEl camino es largo. Describe qué sucede en ruta o si buscas hospedaje en algún pueblo.`;
  }
  
  if (msg.startsWith('/investigar')) {
    const target = message.slice(11).trim();
    if (!target) return 'Qué investigarás: /investigar [objetivo]';
    return `🔍 Comienzas investigación sobre ${target}.\nReunes información localmente. Los rumores hablan de... algo que necesita más profundidad. ¿Dónde buscarás?`;
  }
  
  return 'Comando no reconocido. Intenta: /hacer, /decir, /examinar, /atacar, /usar, /hablar, /buscar, /combate, /negociar, /estudiar, /viajar, /investigar';
}

// Routes

app.get('/api/bootstrap', async (req, res) => {
  try {
    await ensureDatabaseIntegrity();
    
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(30);

    const appName = await getSetting('APP_NAME') || 'SUKO RPG';

    res.json({
      ok: true,
      appName,
      campaigns: campaigns || []
    });
  } catch (err) {
    await logEvent('', 'ERROR', 'bootstrap failed', err.message);
    res.status(500).json({
      ok: false,
      error: 'No pude cargar la aplicación ahora.'
    });
  }
});

app.post('/api/campaign', async (req, res) => {
  try {
    const { playerName, characterName } = req.body;
    const pName = sanitizeText(playerName).slice(0, 60);
    const cName = sanitizeText(characterName).slice(0, 60);

    if (!pName || !cName) {
      return res.status(400).json({
        ok: false,
        error: 'Nombre de jugador y personaje son obligatorios.'
      });
    }

    const campaignId = generateCampaignId();
    const now = new Date().toISOString();

    // Insert campaign
    await supabase.from('campaigns').insert({
      campaign_id: campaignId,
      player_name: pName,
      character_name: cName,
      created_at: now,
      updated_at: now,
      status: 'active'
    });

    // Insert character
    await supabase.from('characters').insert({
      campaign_id: campaignId,
      character_name: cName,
      origin: '',
      ability: '',
      personality_notes: '',
      visual_profile: '',
      created_at: now
    });

    // Insert campaign_state
    await supabase.from('campaign_state').insert({
      campaign_id: campaignId,
      location: 'Metrópolis de Convergencia - Distrito Mercantil',
      region: 'Tierras Neutrales',
      season: 'Otoño tardío',
      ability: '',
      ability_limits: '',
      fatigue: 'leve',
      current_pressure: 'Rumores de movimiento factional en las sombras',
      next_hook: '',
      money: '15',
      updated_at: now
    });

    // Insert initial NPCs with drama
    await supabase.from('npcs').insert([
      {
        campaign_id: campaignId,
        npc_name: 'Sifu Wren Kobo',
        role: 'Maestro de Combate',
        goal: 'Recrutar a quienes resistirán el Tribunal Ember',
        personality: 'Áspero pero justo. Sospecha de extraños. Cicatrices de fuego antiguas.',
        location: 'Gimnasio en los muelles'
      },
      {
        campaign_id: campaignId,
        npc_name: 'Elder Panya',
        role: 'Sabia & Médica',
        goal: 'Desentrañar una visión que la persigue: futuro sangrentiento',
        personality: 'Calmada pero urgida. Ve más de lo que debería. Te observa intensamente.',
        location: 'Santuario del Loto, templo en la montaña'
      },
      {
        campaign_id: campaignId,
        npc_name: 'Ren Calloway',
        role: 'Capitán del Camino de la Linterna',
        goal: 'Expandir territorio de tráfico. Busca "colaboradores".',
        personality: 'Encantador. Sonrisa falsa. Cicatriz atravesando media cara.',
        location: 'Taberna "Ancora Rota" en muelles'
      }
    ]);

    // Insert initial pressures
    await supabase.from('narrative_pressure').insert([
      {
        campaign_id: campaignId,
        pressure_type: 'political',
        description: 'Tribunal Ember recluta en secreto generales descontentos. Pagan bien por información.',
        severity: 5,
        created_at: now
      },
      {
        campaign_id: campaignId,
        pressure_type: 'time',
        description: 'Caravana comercial importante llega en 3 días. Facciones rivales buscan sabotaje.',
        severity: 4,
        created_at: now
      }
    ]);

    // Insert opening scene message - MUCHO MAS INMERSIVA
    const openingScene = `
Abres los ojos. La metrópolis de Convergencia rodea: una masa de madera, piedra y fuego mágico que ilumina tiendas de tela andrajosa. Hueles: especias quemadas, agua estancada, sangre seca.

SITUACIÓN INMEDIATA:
Te encuentras en el Mercado Mercantil, borde de la plaza principal. Es atardecer. Una riña acaba de terminar: dos guardias de la Reconciliación arrastran un mercader sangrando hacia un callejón. Nadie interviene. Nadie mira.

TU BOLSA: 15 monedas (herencia de viaje). Ropa de viajero. Nada de valor.

OPCIONES INMEDIATAS:
1. Intervenir (riesgo: enfrentar guardias)
2. Seguir (aprender más sobre quién era el mercader)
3. Huir (buscar refugio seguro antes del anochecer)

¿Qué haces en este momento oscuro, ${cName}?`;

    await supabase.from('messages').insert({
      campaign_id: campaignId,
      role: 'assistant',
      content: openingScene.trim(),
      summary_flag: false
    });

    res.json({
      ok: true,
      campaign_id: campaignId,
      player_name: pName,
      character_name: cName
    });
  } catch (err) {
    await logEvent('', 'ERROR', 'createCampaign failed', err.message);
    res.status(500).json({
      ok: false,
      error: 'No pude crear la campaña.'
    });
  }
});

app.get('/api/campaign/:campaignId', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaña no encontrada.'
      });
    }

    const { data: state } = await supabase
      .from('campaign_state')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: true });

    // Get inventory items
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('campaign_id', campaignId);

    // Get locations
    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .eq('campaign_id', campaignId);

    res.json({
      ok: true,
      campaign,
      state: state || {},
      messages: messages || [],
      inventory: (inventory || []).map(i => ({ name: i.item_name })),
      locations: (locations || []).map(l => ({ name: l.location_name }))
    });
  } catch (err) {
    await logEvent(req.params.campaignId || '', 'ERROR', 'getCampaignData failed', err.message);
    res.status(500).json({
      ok: false,
      error: 'No pude cargar esa campaña.'
    });
  }
});

app.post('/api/message', async (req, res) => {
  try {
    const { campaignId, message: userMessage } = req.body;
    const id = sanitizeId(campaignId);
    const cleanMessage = sanitizeText(userMessage).slice(0, 1200);

    if (!cleanMessage) {
      return res.status(400).json({
        ok: false,
        error: 'El mensaje está vacío.'
      });
    }

    // Check campaign exists
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', id)
      .single();

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaña inválida.'
      });
    }

    // Get current state
    const { data: state } = await supabase
      .from('campaign_state')
      .select('*')
      .eq('campaign_id', id)
      .single();

    // Get inventory and locations
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('campaign_id', id);

    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .eq('campaign_id', id);

    // Check for special commands
    const isSpecialCommand = cleanMessage.startsWith('/');
    let narration = '';

    if (isSpecialCommand) {
      if (cleanMessage.includes('inventario')) {
        narration = 'Tu mochila contiene: ' + 
          (inventory && inventory.length > 0 
            ? inventory.map(i => i.item_name).join(', ') 
            : 'nada de valor');
      } else if (cleanMessage.includes('mapa') || cleanMessage.includes('ubicaciones')) {
        narration = 'Ubicaciones conocidas: ' + 
          (locations && locations.length > 0 
            ? locations.map(l => l.location_name).join(', ') 
            : 'solo el lugar actual');
      } else if (cleanMessage.includes('estado')) {
        narration = `Estado actual:\nUbicación: ${state?.location || 'desconocida'}\nRegión: ${state?.region || 'sin definir'}\nDinero: ${state?.money || '0'}\nFatiga: ${state?.fatigue || 'normal'}`;
      } else {
        // Comandos combinables: /hacer, /decir, /examinar, /atacar, /usar, /hablar, /buscar
        narration = processCommandAction(cleanMessage, state);
      }
    } else {
      // Normal message - insert user message first
      await supabase.from('messages').insert({
        campaign_id: id,
        role: 'user',
        content: cleanMessage,
        summary_flag: false
      });

      // Get context for Gemini
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('campaign_id', id)
        .order('timestamp', { ascending: false })
        .limit(10);

      const { data: npcs } = await supabase
        .from('npcs')
        .select('*')
        .eq('campaign_id', id)
        .limit(12);

      // Count total messages to determine response variability
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id);

      // Variability: early game = short, mid game = medium, late game = LONG
      let lengthGuide = '2-3 párrafos cortos';
      if (totalMessages >= 10 && totalMessages < 25) {
        lengthGuide = '3-4 párrafos moderados con más detalles';
      } else if (totalMessages >= 25) {
        lengthGuide = '4-6 párrafos largos. Profundo. Múltiples perspectivas (NPC, facción, rumores). Consecuencias complejas';
      }

      // Build prompt for Gemini - text/plain mode for better quality
      const prompt = `ERES NARRADOR. MUNDO AVATAR POST-GUERRA. AÑO 19 DEL CONCORD.

TURNO #${totalMessages || 1}. VARIABILIDAD NARRATIVA: ${lengthGuide}
      
UBICACIÓN: ${state?.location || 'Metrópolis de Convergencia'}
REGIÓN: ${state?.region || 'Tierras Neutrales'}
ESTADO: Dinero ${state?.money || '10'} | Fatiga ${state?.fatigue || 'leve'} | Presión: ${state?.current_pressure || 'ninguna'}

NPCs VIVOS (sus propios objetivos):
${(npcs || []).slice(0, 2).map(n => `${n.npc_name}: ${n.goal || 'objetivo desconocido'}`).join('\n')}

CONTEXTO RECIENTE:
${(recentMessages || []).slice(0, 3).reverse().map(m => `${m.role === 'user' ? 'Jugador' : 'Mundo'}: ${m.content.slice(0, 60)}`).join('\n')}

ACCIÓN DEL JUGADOR: "${cleanMessage}"

REGLAS:
1. Vivida. Texturas, aromas, temperaturas, emociones.
2. Muestra CONSECUENCIAS: ¿Quién reacciona? ¿Qué cambia?
3. El mundo EXISTE sin el jugador - NPCs avanzan objetivos propios
4. ESPECÍFICO: moneda ardiente, no pista genérica
5. Presión: recursos bajos, peligro, tiempo, relaciones tensas
6. TONO: Oscuro pero con esperanza
7. ESPAÑOL. Tercera persona para el jugador.`;

      let structured;
      try {
        const geminiResponse = await callGemini(prompt);
        structured = geminiResponse;
      } catch (apiErr) {
        await logEvent(id, 'ERROR', 'Gemini call failed', apiErr.message);
        structured = {
          narration: 'La bruma espiritual interfiere. El mundo contiene el aliento. Intenta reformular tu acción o busca cobijo.'
        };
      }

      narration = sanitizeText(structured.narration) || 'El momento queda suspendido.';

      // Trigger dynamic pressures and factions based on gameplay
      await triggerDynamicPressure(id);
      await triggerFactionActivity(id);

      // Insert assistant message
      await supabase.from('messages').insert({
        campaign_id: id,
        role: 'assistant',
        content: narration,
        summary_flag: false
      });

      // Apply state patch if exists
      if (structured.state_patch && Object.keys(structured.state_patch).length > 0) {
        const patch = structured.state_patch;
        const updates = {};
        if (patch.location) updates.location = sanitizeText(patch.location);
        if (patch.region) updates.region = sanitizeText(patch.region);
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase
            .from('campaign_state')
            .update(updates)
            .eq('campaign_id', id);
        }
      }
    }

    // Touch campaign
    await supabase
      .from('campaigns')
      .update({ updated_at: new Date().toISOString() })
      .eq('campaign_id', id);

    // Get updated state
    const { data: updatedState } = await supabase
      .from('campaign_state')
      .select('*')
      .eq('campaign_id', id)
      .single();

    // Get current pressures/factions for UI
    const { data: pressures } = await supabase
      .from('narrative_pressure')
      .select('*')
      .eq('campaign_id', id)
      .is('resolved_at', null);

    const { data: factions } = await supabase
      .from('faction_activity')
      .select('*')
      .eq('campaign_id', id);

    res.json({
      ok: true,
      campaign_id: id,
      narration,
      state: updatedState || {},
      inventory: (inventory || []).map(i => ({ name: i.item_name })),
      locations: (locations || []).map(l => ({ name: l.location_name })),
      pressures: pressures || [],
      factions: factions || []
    });
  } catch (err) {
    await logEvent(req.body.campaignId || '', 'ERROR', 'handlePlayerMessage failed', err.message);
    res.status(500).json({
      ok: false,
      error: 'No pude procesar tu acción ahora.'
    });
  }
});

app.post('/api/log', async (req, res) => {
  try {
    const { context, message, campaignId } = req.body;
    const cleanContext = sanitizeText(context).slice(0, 120) || 'client';
    const cleanMessage = sanitizeText(message).slice(0, 1500) || 'Error desconocido del cliente.';
    const cleanCampaignId = campaignId ? sanitizeText(campaignId).slice(0, 60) : '';

    await logEvent(cleanCampaignId, 'ERROR', `client:${cleanContext}`, cleanMessage);
    res.json({ ok: true });
  } catch (err) {
    console.error('Log error:', err);
    res.status(500).json({ ok: false });
  }
});

// ============ NEW ENDPOINTS: PRESIÓN NARRATIVA Y FACCIONES ============

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
    
    const { data: npcGoals } = await supabase
      .from('npc_goals')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('current_status', 'pursuing');

    res.json({
      ok: true,
      pressures: pressures || [],
      factions: factions || [],
      npcGoals: npcGoals || []
    });
  } catch (err) {
    await logEvent(req.params.campaignId || '', 'ERROR', 'getPressure', err.message);
    res.status(500).json({ ok: false, error: 'No pude cargar presión narrativa.' });
  }
});

app.post('/api/pressure/:campaignId', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);
    const { pressure_type, description, severity } = req.body;

    if (!pressure_type || !description) {
      return res.status(400).json({ ok: false, error: 'pressure_type y description requeridos.' });
    }

    const { data } = await supabase
      .from('narrative_pressure')
      .insert({
        campaign_id: campaignId,
        pressure_type: sanitizeText(pressure_type),
        description: sanitizeText(description),
        severity: Math.min(10, Math.max(1, parseInt(severity) || 5))
      })
      .select()
      .single();

    res.json({ ok: true, pressure: data });
  } catch (err) {
    await logEvent(req.params.campaignId || '', 'ERROR', 'addPressure', err.message);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/factions/:campaignId', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);
    
    const { data: factions } = await supabase
      .from('faction_activity')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('progress_pct', { ascending: false });

    res.json({ ok: true, factions: factions || [] });
  } catch (err) {
    await logEvent(req.params.campaignId || '', 'ERROR', 'getFactions', err.message);
    res.status(500).json({ ok: false });
  }
});

app.post('/api/factions/:campaignId', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);
    const { factionId, progress_pct, next_step } = req.body;

    if (!factionId) return res.status(400).json({ ok: false });

    const updates = { last_updated: new Date().toISOString() };
    if (progress_pct !== undefined) updates.progress_pct = Math.min(100, Math.max(0, progress_pct));
    if (next_step) updates.next_step = sanitizeText(next_step);

    const { data } = await supabase
      .from('faction_activity')
      .update(updates)
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .select()
      .single();

    res.json({ ok: true, faction: data });
  } catch (err) {
    await logEvent(req.params.campaignId || '', 'ERROR', 'updateFaction', err.message);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/events/:campaignId', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);
    
    const { data: events } = await supabase
      .from('off_screen_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('revealed', false)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({ ok: true, events: events || [] });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/events/:campaignId/:eventId/reveal', async (req, res) => {
  try {
    const campaignId = sanitizeId(req.params.campaignId);
    const eventId = parseInt(req.params.eventId);

    const { data } = await supabase
      .from('off_screen_events')
      .update({ revealed: true })
      .eq('id', eventId)
      .eq('campaign_id', campaignId)
      .select()
      .single();

    res.json({ ok: true, event: data });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// ============ END NEW ENDPOINTS ============

// Servir index.html para SPA routing
app.get('/', (req, res) => {
  if (indexHtmlContent) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(indexHtmlContent);
  } else {
    res.status(500).send('Error cargando página.');
  }
});

// Fallback: todas las rutas no-API van a index.html (SPA)
app.get('*', (req, res) => {
  if (indexHtmlContent) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(indexHtmlContent);
  } else {
    res.status(500).send('Error cargando página.');
  }
});

// Start server
app.listen(port, () => {
  console.log(`SUKO RPG backend escuchando en http://localhost:${port}`);
});
