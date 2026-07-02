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
    console.error('[ERROR]', err.message);
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

// ============ CHARACTER STAT SYSTEM (D&D-like) ============

// Initialize character stats
function initializeCharacterStats() {
  return {
    level: 1,
    experience: 0,
    stats: {
      strength: Math.floor(Math.random() * 8) + 10,      // 10-17
      dexterity: Math.floor(Math.random() * 8) + 10,
      intelligence: Math.floor(Math.random() * 8) + 10,
      wisdom: Math.floor(Math.random() * 8) + 10,
      constitution: Math.floor(Math.random() * 8) + 10,
      charisma: Math.floor(Math.random() * 8) + 10
    },
    skills: {
      // Combat skills
      melee: { proficiency: 0, stat: 'strength' },
      ranged: { proficiency: 0, stat: 'dexterity' },
      
      // Social skills
      persuasion: { proficiency: 0, stat: 'charisma' },
      deception: { proficiency: 0, stat: 'charisma' },
      intimidation: { proficiency: 0, stat: 'charisma' },
      
      // Knowledge skills
      investigation: { proficiency: 0, stat: 'intelligence' },
      arcana: { proficiency: 0, stat: 'intelligence' },
      nature: { proficiency: 0, stat: 'wisdom' },
      
      // Stealth/Acrobatics
      stealth: { proficiency: 0, stat: 'dexterity' },
      acrobatics: { proficiency: 0, stat: 'dexterity' }
    },
    health: 20,
    maxHealth: 20
  };
}

// Roll a d20 (20-sided die)
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

// Get modifier from stat value
function getModifier(statValue) {
  return Math.floor((statValue - 10) / 2);
}

// Calculate skill check with stat + proficiency
function calculateSkillCheck(stats, skillName) {
  const skill = stats.skills[skillName];
  if (!skill) return 0;
  
  const statValue = stats.stats[skill.stat];
  const modifier = getModifier(statValue);
  const proficiencyBonus = Math.floor(stats.level / 4) + 2;
  
  return modifier + (skill.proficiency > 0 ? proficiencyBonus : 0);
}

// Determine if an action needs a dice roll (contextually)
function shouldRollDice(action, context) {
  const actionLower = action.toLowerCase();
  
  // Always roll for these actions
  const combatKeywords = ['atacar', 'combate', 'pelear', 'golpear', 'disparar'];
  const socialKeywords = ['persuadir', 'engañar', 'intimidar', 'seducir', 'convencer', 'mentir', 'negociar'];
  const stealthKeywords = ['esconder', 'escabullir', 'sigiloso', 'sigilo', 'esconderse', 'trepar', 'saltar'];
  const investigateKeywords = ['investigar', 'examinar', 'buscar', 'encontrar', 'descubrir', 'detectar'];
  
  const allKeywords = [...combatKeywords, ...socialKeywords, ...stealthKeywords, ...investigateKeywords];
  
  // Check if action contains any keyword requiring a roll
  for (const keyword of allKeywords) {
    if (actionLower.includes(keyword)) {
      return true;
    }
  }
  
  // Contextual: if narrative has conflict/difficulty, roll
  if (context && context.includes('difícil') || context.includes('peligro') || context.includes('resistencia')) {
    return Math.random() < 0.4; // 40% chance
  }
  
  return false;
}

// Determine which skill to use
function getRelevantSkill(action) {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('combate') || actionLower.includes('atacar') || actionLower.includes('golpear')) {
    return 'melee';
  }
  if (actionLower.includes('dispara') || actionLower.includes('ranged')) {
    return 'ranged';
  }
  if (actionLower.includes('persuad') || actionLower.includes('convenc')) {
    return 'persuasion';
  }
  if (actionLower.includes('engaña') || actionLower.includes('miente')) {
    return 'deception';
  }
  if (actionLower.includes('intim')) {
    return 'intimidation';
  }
  if (actionLower.includes('investi') || actionLower.includes('exami') || actionLower.includes('busca')) {
    return 'investigation';
  }
  if (actionLower.includes('magia') || actionLower.includes('hechizo') || actionLower.includes('arcana')) {
    return 'arcana';
  }
  if (actionLower.includes('esconde') || actionLower.includes('sigilo')) {
    return 'stealth';
  }
  if (actionLower.includes('trepa') || actionLower.includes('salta') || actionLower.includes('acrobacia')) {
    return 'acrobatics';
  }
  
  return 'investigation'; // default
}

// Generar opening único por campaña (llamar a Gemini)
async function generateUniqueOpening(characterName, playerName) {
  const prompt = `ERES UN NARRADOR ÉPICO CREANDO UNA ESCENA DE APERTURA ÚNICA.

PERSONAJE: ${characterName}
JUGADOR: ${playerName}

CONTEXTO MUNDO: Avatar Post-Guerra. Año 19 del Concilio. La Metrópolis de Convergencia hierve de tensión política.

GENERA UNA ESCENA DE APERTURA ÚNICA QUE:
1. Sitúe al jugador en una SITUACIÓN INMEDIATA diferente cada vez
2. Incluya UN PELIGRO O DILEMA ESPECÍFICO (no genérico)
3. Presente UN NPC o elemento sorpresa relevante
4. Tenga 2-3 párrafos vividos
5. Termine con UNA PREGUNTA DIRECTA al jugador

TONO: Oscuro, visceral, memorable. Crea urgencia.

IMPORTANTE: Esta debe ser una apertura COMPLETAMENTE NUEVA, no la escena del mercader sangrando. 
Pueden ser: Un encuentro en el puerto, una emboscada, un secreto revelado, un sueño profético, un encuentro casual que gira oscuro, etc.

Genera la escena de apertura única ahora:`;

  try {
    const result = await callGemini(prompt);
    return result?.narration || getDefaultOpening(characterName);
  } catch (err) {
    console.warn('[UNIQUE OPENING ERROR]', err.message);
    return getDefaultOpening(characterName);
  }
}

function getDefaultOpening(characterName) {
  const openings = [
    `Despiertas en un callejón mojado. El agua fría te corre por la cara. Alguien acaba de desvanecer tu bolsa. Voces cerca: "El forastero. Sí, ese." Tu corazón acelerado. Necesitas moverse. Ahora.`,
    `La voz de una mujer te despierta en la obscuridad. "Llegas tarde," murmura. Estás en un sótano subterráneo. Velas titiritando. Ella se acerca: "El Tribunal Ember te busca. ¿Quién eres realmente?"`,
    `El humo de un fuego reciente rodea la plaza. Una construcción ardiendo. Gritos. En la multitud, una figura encapuchada te mira directamente. Te reconoce. Corre. Y tú necesitas decidir: ¿seguir o huir?`,
    `Una carta cae a tus pies. Papel antiguo. Tu nombre escrito en letra temblorosa. Adentro: "Si lees esto, ya sabes demasiado. Busca a Sifu Wren en los muelles. Confía solo en él. Queman nuestra orden."`,
    `Te despiertas gritando. La pesadilla se disuelve pero la sensación permanece: alguien murió. Por tu culpa. Abres los ojos. La Metrópolis rugiendo afuera. Eres ${characterName}. Estás vivo. Por ahora.`
  ];
  
  return openings[Math.floor(Math.random() * openings.length)];
}

// Perform a full skill check with d20
function performSkillCheck(stats, action, difficulty = 10) {
  const skillName = getRelevantSkill(action);
  const d20Roll = rollD20();
  const skillBonus = calculateSkillCheck(stats, skillName);
  const totalRoll = d20Roll + skillBonus;
  
  return {
    skill: skillName,
    d20: d20Roll,
    bonus: skillBonus,
    total: totalRoll,
    success: totalRoll >= difficulty,
    criticalSuccess: d20Roll === 20,
    criticalFailure: d20Roll === 1,
    difficulty
  };
}



// Extract quick commands from narration (dynamically generated by Gemini)
function extractQuickCommands(narration) {
  const commands = [];
  
  // Look for patterns like [1️⃣ ACCIÓN]: description
  const regex = /\[[\d\ufe0f\u20e3]+\s+(?:ACC[IÍ]ON|OPCI\u00d3N|ACCI\u00d3N)\]:\s*([^\[\n]+)/gi;
  let match;
  
  while ((match = regex.exec(narration)) !== null) {
    const description = match[1].trim();
    if (description && description.length > 0) {
      commands.push(description);
    }
  }
  
  // If no structured commands found, generate contextual ones based on narrative content
  if (commands.length === 0) {
    const narrationLower = narration.toLowerCase();
    
    if (narrationLower.includes('persona') || narrationLower.includes('npc') || narrationLower.includes('habla')) {
      commands.push('Preguntar más');
    }
    if (narrationLower.includes('tesoro') || narrationLower.includes('objeto') || narrationLower.includes('busca')) {
      commands.push('Recoger/Investigar');
    }
    if (narrationLower.includes('peligro') || narrationLower.includes('ataque') || narrationLower.includes('combate')) {
      commands.push('Preparar defensa');
    }
    if (narrationLower.includes('escape') || narrationLower.includes('huida') || narrationLower.includes('corre')) {
      commands.push('Huir rápido');
    }
  }
  
  // Ensure we always return 4 commands
  const defaultCommands = [
    'Investigar más',
    'Hablar con alguien',
    'Buscar salida',
    'Meditar'
  ];
  
  while (commands.length < 4 && defaultCommands.length > 0) {
    const cmd = defaultCommands.pop();
    if (!commands.includes(cmd)) {
      commands.push(cmd);
    }
  }
  
  return commands.slice(0, 4);
}

// Generate vivid narrative using templates (no API dependency)
function generateTemplateNarrative(action, state, npcs, turnNumber) {
  const location = state?.location || 'Metrópolis de Convergencia';
  const region = state?.region || 'Tierras Neutrales';
  const money = state?.money || 10;
  const fatigue = state?.fatigue || 'leve';
  
  const actionLower = action.toLowerCase();
  const isQuestion = action.includes('?');
  const isCommand = action.startsWith('/');
  
  // Get first NPC if available
  const npc = npcs && npcs.length > 0 ? npcs[0] : null;
  
  // Context-sensitive narrative templates
  const narratives = {
    // Investigative/thoughtful actions
    investigate: [
      `Te inclinas para examinar cuidadosamente. Los detalles de ${location} revelan capas de secretos: marcas de combate antigua, símbols de facciones rivales, mensajes cifrados en las paredes. Algo te dice que estás cerca de una verdad peligrosa.`,
      `Observas como un cazador. El mercado late con vida y tensión. Comerciantes susurran sobre precios que suben, guardias que aparecen en lugares inesperados, rumores de reclutamiento para causas ocultas. El Tribunal Ember quiere soldados. El Concilio vigila. Ambos te vigilan a ti.`,
      `Tu instinto te lleva a un rincón oscuro. Aquí, lejos de ojos curiosos, encuentras evidencia: una nota quemada parcialmente, monedas del Tribunal Ember, nombres grabados en madera vieja. ${npc ? `Mencionan a ${npc.npc_name}.` : 'Tu nombre está entre ellos.'}`,
    ],
    
    // Combat/action
    combat: [
      `Te lanzas a la acción. El mundo se ralentiza. Ves cada movimiento, cada oportunidad, cada peligro. Tu rival no espera tu velocidad. El primer golpe conecta. El segundo también. Pero más guardias aparecen en la plaza. Esto no acabará bien.`,
      `La violencia estalla. Es rápida, sucia, visceral. Hueles la sangre antes de verla. Sientes el impacto en tus huesos. Ganas terreno pero pierdes dinero en el caos: 2 monedas caen al suelo, desaparecen en la multitud. Una multitud que ahora te mira con miedo.`,
      `Tus puños vuelan. No hay elegancia aquí, solo supervivencia. ${npc ? `${npc.npc_name} grita una advertencia.` : 'Un grito te alerta.'} "¡GUARDIAS!" La pelea termina rápido. Ganas, pero el costo es alto: tu fatiga aumenta, tus ropas están rotas, y ahora hay preguntas incómodas.`,
    ],
    
    // Social/dialogue
    dialogue: [
      `Hablas. Tu voz resonó en la plaza, llamando atención. La gente escucha. Algunos creen. Otros dudan. ${npc ? `${npc.npc_name} asiente lentamente, reevaluando qué eres.` : 'En algún lugar, alguien toma notas sobre ti.'} Las palabras correctas abren puertas. Las palabras equivocadas las cierran.`,
      `Tus palabras caen en terreno fértil. Las personas se reúnen. El comerciante acepta tu propuesta. Un guardia, apenas, desvía la mirada. Sientes el poder de una buena mentira. O tal vez sea verdad. Ya no importa. El dinero está en tu bolsa ahora.`,
      `Negocias. Regatea. Persuade. Es un juego antiguo en ${location}, y tú lo juegas bien. Ganas 5 monedas. Pierdes la confianza de alguien. Ganas una deuda de alguien más. El mundo es un mercado. Todos venden. Todos compran.`,
    ],
    
    // Exploration/discovery
    explore: [
      `Te adentras en lo desconocido. Las calles se retuercen y se estrechan. El aire huele diferente aquí: más viejo, más peligroso. Encuentras un lugar: un santuario abandonado, un túnel secreto, una biblioteca prohibida. Tu corazón late rápido. Estás en territorio que pocos exploran.`,
      `La exploración te lleva a lugares que no figuran en los mapas. ${location} tiene secretos. Los encuentras: un símbolo del Loto Vigil grabado en piedra, mensajes de aire nomad antiguo, evidencia de rituales desconocidos. Sabes que no deberías estar aquí. Sabes más ahora. Es ambas cosas peligroso.`,
      `Deambulas. Las horas pasan. Descubres. Un jardín secreto donde crecen plantas que no deberían existir. Una bóveda subterránea llena de artefactos de guerra. Una casa donde figuras encapuchadas se reúnen en la noche. Cada descubrimiento te coloca en mayor peligro.`,
    ],
    
    // Meditation/introspection
    meditate: [
      `Cierras los ojos. El mundo se desvanece. En la quietud, encuentras claridad. La fatiga se disipa. Tu mente se enfoca. Cuando abres los ojos, ${location} se ve diferente. Ves patrones que no viste antes. Ves oportunidades. Ves amenazas.`,
      `Te sientas en silencio. La energía fluye. Tu cuerpo se relaja. Tu espíritu se fortalece. Por un momento, está bien. No hay presión, no hay peligro, solo el presente. Cuando regresas, te sientes diferente. Renovado. Listo para lo que viene.`,
      `La meditación te lleva profundamente adentro. Ves visiones: el pasado de la guerra, el futuro de conflicto, el presente de oportunidad. ${npc ? `La cara de ${npc.npc_name} aparece en tus visiones. ¿Es aliado o enemigo?` : 'La verdad es nebulosa.'} Cuando sales, el mundo ha movido. Es hora de actuar.`,
    ],
    
    // Default: contextual based on turnNumber
    default: [
      `Tu acción resuena en el mundo. Las consecuencias se despliegan lentamente. En algún lugar, alguien se entera. En algún lugar, planes cambian. ${npc ? `${npc.npc_name} siente el cambio.` : 'El mundo siente el cambio.'} No puedes predecir todo, pero sabes que nada es accidental.`,
      `El momento pasa. Otro turno en tu aventura. Las presiones se acumulan: tiempo, dinero, relaciones, poder. En ${location}, todo está conectado. Tu acción pequeña será parte de algo mucho más grande. Espera y verás.`,
      `La noche cae en ${region}. Las tensiones aumentan. El Tribunal Ember avanza. El Concilio reacciona. Los mercaderes negocian. Y tú, pequeña figura en este vasto tablero, continúas viviendo, respirando, luchando, amando, sobreviviendo. El siguiente turno te espera.`,
    ]
  };
  
  // Choose narrative based on action content
  let chosen = narratives.default;
  const lowerAction = actionLower;
  
  if (lowerAction.includes('investigar') || lowerAction.includes('examinar') || lowerAction.includes('buscar') || 
      lowerAction.includes('inspeccion') || lowerAction.includes('busco') || lowerAction.includes('examino')) {
    chosen = narratives.investigate;
  } else if (lowerAction.includes('atacar') || lowerAction.includes('luchar') || lowerAction.includes('combate') ||
             lowerAction.includes('lanzo') || lowerAction.includes('golpeo') || lowerAction.includes('me lanzo contra')) {
    chosen = narratives.combat;
  } else if (lowerAction.includes('hablar') || lowerAction.includes('decir') || lowerAction.includes('negociar') || 
             lowerAction.includes('hablo') || lowerAction.includes('digo') || lowerAction.includes('pregunto') ||
             lowerAction.includes('cuento') || lowerAction.includes('negoció') || lowerAction.includes('negocio') || isQuestion) {
    chosen = narratives.dialogue;
  } else if (lowerAction.includes('explorar') || lowerAction.includes('viajar') || lowerAction.includes('caminar') ||
             lowerAction.includes('exploro') || lowerAction.includes('adentro') || lowerAction.includes('túnel')) {
    chosen = narratives.explore;
  } else if (lowerAction.includes('meditar') || lowerAction.includes('descansar') || lowerAction.includes('rezar') ||
             lowerAction.includes('siento') || lowerAction.includes('meditación') || lowerAction.includes('medito')) {
    chosen = narratives.meditate;
  }
  
  // Pick random from chosen category, with variance based on turn
  let narrative = chosen[Math.floor(Math.random() * chosen.length)];
  
  // Add turn-based detail escalation
  if (turnNumber >= 25) {
    narrative += ` La presión aumenta con cada hora que pasa. Sientes el peso de ${turnNumber} decisiones en tu espalda.`;
  } else if (turnNumber >= 10) {
    narrative += ` Esto es solo el comienzo. Mucho más está por venir.`;
  }
  
  return narrative;
}

async function callGemini(promptText, retryCount = 0) {
  const maxRetries = 3;
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
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 30000
    });

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      if (retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
        console.warn(`[GEMINI 429] Rate limited. Retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return callGemini(promptText, retryCount + 1);
      } else {
        throw new Error('Rate limited - max retries exceeded');
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[GEMINI ERROR] HTTP ${response.status}: ${errText.slice(0, 200)}`);
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Check for content filters or safety issues
    if (data.promptFeedback?.blockReason) {
      console.warn(`[GEMINI BLOCKED] ${data.promptFeedback.blockReason}`);
      throw new Error(`Content filtered: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      console.warn('[GEMINI SAFETY] Response blocked by safety filter');
      throw new Error('Content blocked by safety filter');
    }

    const text = candidate?.content?.parts?.[0]?.text || '';
    if (!text || text.trim().length === 0) {
      console.warn('[GEMINI EMPTY] No text content in response');
      throw new Error('Gemini returned empty response');
    }

    console.log(`[GEMINI SUCCESS] Generated ${text.length} chars`);
    return {
      narration: text.trim(),
      state_patch: {}
    };
  } catch (err) {
    console.error('[ERROR]', err.message);
    console.error(`[GEMINI EXCEPTION] ${err.message}`);
    throw err;
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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

    // Initialize character stats - NEW!
    const characterStats = initializeCharacterStats();

    // Insert character with stats
    await supabase.from('characters').insert({
      campaign_id: campaignId,
      character_name: cName,
      origin: '',
      ability: JSON.stringify(characterStats),
      personality_notes: '',
      visual_profile: '',
      created_at: now
    });

    // Insert campaign_state with stats
    await supabase.from('campaign_state').insert({
      campaign_id: campaignId,
      location: 'Metrópolis de Convergencia - Distrito Mercantil',
      region: 'Tierras Neutrales',
      season: 'Otoño tardío',
      ability: JSON.stringify(characterStats),
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

    // Generate UNIQUE opening scene for this campaign - NEW!
    let openingScene = getDefaultOpening(cName); // Fallback
    try {
      openingScene = await generateUniqueOpening(cName, pName);
    } catch (err) {
      console.warn('[OPENING GENERATION]', err.message);
    }

    // Add character stats info to opening
    const statsPreview = `\n\n[TUS HABILIDADES INICIALES]
Fuerza: ${characterStats.stats.strength} | Destreza: ${characterStats.stats.dexterity} | Inteligencia: ${characterStats.stats.intelligence}
Sabiduría: ${characterStats.stats.wisdom} | Constitución: ${characterStats.stats.constitution} | Carisma: ${characterStats.stats.charisma}`;

    await supabase.from('messages').insert({
      campaign_id: campaignId,
      role: 'assistant',
      content: (openingScene + statsPreview).trim(),
      summary_flag: false
    });

    res.json({
      ok: true,
      campaign_id: campaignId,
      player_name: pName,
      character_name: cName
    });
  } catch (err) {
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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

    // Load character stats - NEW!
    let characterStats = null;
    let diceRoll = null;
    try {
      if (state?.ability && typeof state.ability === 'string') {
        characterStats = JSON.parse(state.ability);
      }
    } catch (err) {
      console.warn('[STATS PARSE]', err.message);
    }

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
    let quickCommands = []; // Declare in global scope

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

      // Get active pressures & factions for narrative context
      const { data: activePressures } = await supabase
        .from('narrative_pressure')
        .select('*')
        .eq('campaign_id', id)
        .is('resolved_at', null)
        .limit(3);

      const { data: activeFactions } = await supabase
        .from('faction_activity')
        .select('*')
        .eq('campaign_id', id)
        .eq('revealed', true)
        .order('progress_pct', { ascending: false })
        .limit(3);

      // Dice roll logic - NEW!
      if (characterStats && shouldRollDice(cleanMessage, state?.current_pressure)) {
        diceRoll = performSkillCheck(characterStats, cleanMessage, 11);
        console.log(`[DICE ROLL] ${diceRoll.skill} - d20:${diceRoll.d20} +${diceRoll.bonus} = ${diceRoll.total} (DC ${diceRoll.difficulty})`);
      }

      // Variability: early game = short, mid game = medium, late game = LONG
      let lengthGuide = '2-3 párrafos cortos';
      if (totalMessages >= 10 && totalMessages < 25) {
        lengthGuide = '3-4 párrafos moderados con más detalles';
      } else if (totalMessages >= 25) {
        lengthGuide = '4-6 párrafos largos. Profundo. Múltiples perspectivas (NPC, facción, rumores). Consecuencias complejas';
      }

      // Build prompt for Gemini - HIGHLY VIVID & IMMERSIVE with dynamic pressures/factions
      const buildNarrativePrompt = (action, gameState, recentContext, npcList, turn, pressures, factions, diceRollData) => {
        const turnPhase = turn < 10 ? 'ACTO I: REVELACIÓN' : turn < 25 ? 'ACTO II: CONFLICTO' : 'ACTO III: CONSECUENCIA';
        
        const pressureContext = (pressures || []).length > 0 
          ? `\n⚡ PRESIONES ACTIVAS:\n${pressures.map(p => `   • ${p.pressure_type}: ${p.description} (Severidad: ${p.severity})`).join('\n')}`
          : '';
        
        const factionContext = (factions || []).length > 0
          ? `\n🏛️ FACCIONES EN MOVIMIENTO:\n${factions.map(f => `   • ${f.faction_name}: ${f.current_goal} (Progreso: ${f.progress_pct}%)`).join('\n')}`
          : '';
        
        return `ERES UN NARRADOR ÉPICO. TU TAREA: Contar una historia VIVA, VISCERAL, MEMORABLE, GENERADA SIEMPRE.

═══════════════════════════════════════════════════════════════
CONTEXTO: Mundo Avatar, Post-Guerra (Año 19 del Concilio)
FASE: ${turnPhase} (Turno ${turn})
═══════════════════════════════════════════════════════════════

ATMÓSFERA ACTUAL:
📍 ${gameState?.location || 'Metrópolis de Convergencia - Distrito Mercantil'}
🌍 ${gameState?.region || 'Tierras Neutrales'}
💰 Dinero: ${gameState?.money || '10'} monedas de fuego
⚡ Energía: ${gameState?.fatigue || 'leve'} (escala: leve → moderada → agotada)
🎯 Presión: ${gameState?.current_pressure || 'La normalidad es ilusión'}

PERSONAJES EN EL MUNDO (con SUS propios planes):
${(npcList || []).map(n => `• ${n.npc_name} (${n.role || 'misterio'}): "${n.goal || '¿Quién sabe?'}"`).join('\n')}${pressureContext}${factionContext}

LO QUE PASÓ:
${(recentContext || []).slice(0, 4).reverse().map(m => {
  const speaker = m.role === 'user' ? '👤 TÚ' : '🌍 EL MUNDO';
  return `${speaker}: "${m.content.slice(0, 80)}..."`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AHORA: El jugador hace esto → "${action}"

${diceRollData ? `
[TIRADA DE DADOS REALIZADA]
Habilidad: ${diceRollData.skill}
d20: ${diceRollData.d20} | Bonus: +${diceRollData.bonus} | Total: ${diceRollData.total} vs DC ${diceRollData.difficulty}
${diceRollData.criticalSuccess ? '⭐ ¡ÉXITO CRÍTICO!' : diceRollData.success ? '✅ ÉXITO' : diceRollData.criticalFailure ? '💀 ¡FRACASO CRÍTICO!' : '❌ FRACASO'}

INSTRUCCIÓN: Interpreta esta tirada narrativamente. Si éxito, logra su objetivo pero aparecen complicaciones. Si fracaso, su intento falla de forma dramática. Si crítico, consecuencias extremas.
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENERA UNA NARRACIÓN QUE:

1️⃣ ENVOLVENTE (${lengthGuide}):
   - Inicia CON IMPACTO, no contexto
   - Sensaciones REALES: temperatura piel, sabor aire, sonido ambiente
   - Emociones del jugador ENMARCADAS

2️⃣ MUNDO VIVO:
   - NPCs reaccionan a las acciones del jugador
   - El mundo prosigue: alguien gana, alguien pierde
   - Rumores, chismes, secretos revelados gradualmente

3️⃣ CONSECUENCIAS TANGIBLES:
   - Dinero aumenta/disminuye
   - Relaciones se calientan/enfrían
   - Puertas se abren o se cierran

4️⃣ PRESIÓN NARRATIVA:
   - Tiempo límite: "Escuchas pasos acercarse..."
   - Escasez: "Solo te quedan 3 monedas"
   - Conflicto: "Sifu Wren te mira con desconfianza"

5️⃣ TONO:
   - Oscuro pero con esperanza
   - Poético pero claro
   - Acción vívida

FORMATO: Narración pura. Tercera persona. SIN explicaciones técnicas.

EJEMPLO DE LO QUE QUEREMOS:
"El mercado hierve de actividad. Vendedores gritan sobre especias de Tierra, mientras el acero brilla en los puestos de armas. Sientes el calor del sol reflejado en piedra roja, hueles a curry y a sudor. 
De repente, Sifu Wren aparece entre la multitud, con los ojos encendidos en fuego. Algo ha cambiado en él. 
'Llegas tarde,' murmura, 'El Tribunal Ember está reclutando. Algunos que conocemos... han jurado lealtad.'
Pierde 2 monedas en sobornos. Ganas información: la conspiración es más profunda de lo que pensabas."

AL FINAL DE TU NARRACIÓN, SUGIERE 4 ACCIONES INMEDIATAS CONTEXTUALES:
- [1️⃣ ACCIÓN]: Breve descripción contextual (máximo 5 palabras)
- [2️⃣ ACCIÓN]: Breve descripción contextual (máximo 5 palabras)
- [3️⃣ ACCIÓN]: Breve descripción contextual (máximo 5 palabras)
- [4️⃣ ACCIÓN]: Breve descripción contextual (máximo 5 palabras)

AHORA GENERA TU NARRACIÓN (${lengthGuide}):`;
      };

      const prompt = buildNarrativePrompt(cleanMessage, state, recentMessages, npcs, totalMessages || 1, activePressures, activeFactions, diceRoll);

      // NEW STRATEGY: 80% Gemini for rich, immersive, always-generated content
      // 20% fallback to templates only if Gemini fails
      const useGemini = Math.random() < 0.8; // 80% chance to use Gemini (reversed!)
      
      let structured = null;
      
      if (useGemini) {
        // Try Gemini for immersive narration
        try {
          console.log(`[GEMINI ATTEMPT] Turn ${totalMessages} - attempting immersive narration (80% strategy)`);
          structured = await callGemini(prompt);
          
          if (structured && structured.narration) {
            narration = sanitizeText(structured.narration);
            // Extract quick commands from narration if present
            quickCommands = extractQuickCommands(narration);
            console.log(`[GEMINI SUCCESS] Narration: ${narration.slice(0, 60)}... [Commands: ${quickCommands.length}]`);
          }
        } catch (apiErr) {
          console.warn(`[GEMINI FAILED] Falling back to template: ${apiErr.message}`);
          await logEvent(id, 'WARN', 'Gemini unavailable', apiErr.message);
          structured = null;
        }
      }
      
      // Use template as fallback only if Gemini failed
      if (!structured) {
        const templateNarr = generateTemplateNarrative(cleanMessage, state, npcs, totalMessages);
        narration = templateNarr;
        structured = { narration: templateNarr, state_patch: {} };
        // Generate contextual quick commands for template narration too
        quickCommands = extractQuickCommands(templateNarr);
        console.log(`[TEMPLATE FALLBACK] Generated: ${templateNarr.slice(0, 60)}`);
      }

      // Ensure narration is not empty
      if (!narration || narration.trim().length === 0) {
        console.warn(`[WARNING] Narration is empty, using fallback`);
        narration = 'El momento queda suspendido en la incertidumbre.';
      }
      
      // Ensure quickCommands always has defaults
      if (!quickCommands || quickCommands.length === 0) {
        quickCommands = ['Investigar', 'Hablar', 'Explorar', 'Meditar'];
      }

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
      quickCommands: quickCommands,
      diceRoll: diceRoll || null, // NEW! Include dice roll results
      state: updatedState || {},
      inventory: (inventory || []).map(i => ({ name: i.item_name })),
      locations: (locations || []).map(l => ({ name: l.location_name })),
      pressures: pressures || [],
      factions: factions || []
    });
  } catch (err) {
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
    console.error('[ERROR]', err.message);
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
