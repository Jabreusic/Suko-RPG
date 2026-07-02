import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'web')));

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
      responseMimeType: 'application/json',
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
    throw new Error('Gemini devolvió respuesta vacía.');
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      narration: 'La escena queda suspendida un instante.',
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

function processCommandAction(message, state) {
  // Procesa comandos combinables: /hacer, /decir, /examinar, /atacar, /usar, /hablar, /buscar
  const msg = message.toLowerCase().trim();
  
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
  
  return 'Comando no reconocido. Intenta: /hacer, /decir, /examinar, /atacar, /usar, /hablar, /buscar';
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
      location: '',
      region: '',
      season: '',
      ability: '',
      ability_limits: '',
      fatigue: 'leve',
      current_pressure: '',
      next_hook: '',
      money: '10',
      updated_at: now
    });

    // Insert opening scene message
    await supabase.from('messages').insert({
      campaign_id: campaignId,
      role: 'assistant',
      content: 'La bruma se disipa. Tu primer recuerdo es claro: desiertas calles de una metrópolis sin nombre. ¿Qué ves primero?',
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

      // Build prompt
      const prompt = `
Eres un narrador de un RPG oscuro y narrativo. El jugador está en: ${state?.location || 'ubicación desconocida'}, región ${state?.region || 'sin definir'}.

Contexto reciente:
${(recentMessages || []).slice(0, 5).reverse().map(m => `${m.role}: ${m.content}`).join('\n')}

NPCs/personajes conocidos:
${(npcs || []).slice(0, 3).map(n => `- ${n.npc_name}: ${n.role}`).join('\n')}

Acción del jugador: ${cleanMessage}

Responde en JSON con estructura:
{
  "narration": "descripción de qué sucede",
  "state_patch": {
    "location": "nuevo lugar si cambió",
    "region": "nueva región si cambió"
  }
}
`;

      let structured;
      try {
        structured = await callGemini(prompt);
      } catch (apiErr) {
        await logEvent(id, 'ERROR', 'Gemini call failed', apiErr.message);
        structured = {
          narration: 'La bruma espiritual interfiere. Intenta reformular tu acción.'
        };
      }

      narration = sanitizeText(structured.narration) || 'El momento queda suspendido.';

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

    res.json({
      ok: true,
      campaign_id: id,
      narration,
      state: updatedState || {},
      inventory: (inventory || []).map(i => ({ name: i.item_name })),
      locations: (locations || []).map(l => ({ name: l.location_name }))
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

// Start server
app.listen(port, () => {
  console.log(`SUKO RPG backend escuchando en http://localhost:${port}`);
});
