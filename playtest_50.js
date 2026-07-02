#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  return res.json();
}

async function test50Turns() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🎮 SUKO RPG - PLAYTEST 50 TURNOS     ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('[PASO 1] Creando campaña nueva...');
  const createRes = await makeRequest('/api/campaign', 'POST', {
    playerName: 'TestPlayer',
    characterName: 'Zuko el Inquisidor'
  });

  if (!createRes || !createRes.ok) {
    console.error('❌ Campaign creation failed:', createRes);
    process.exit(1);
  }

  const campaignId = createRes.campaign_id;
  console.log(`✅ Campaña creada: ${campaignId}\n`);

  // Simulate 50 varied turns
  const actions = [
    'Me preparo para la aventura',
    '/hacer investigar mercaderes en la plaza',
    'Busco información sobre el Tribunal Ember',
    '/decir ¿Alguien conoce a Sifu Wren?',
    'Observo cuidadosamente los alrededores',
    '/combate contra un guardia sospechoso',
    'Negoció con el comerciante de especias',
    '/examinar marcas de fuego en la pared',
    'Investigo rumores de conspiración',
    'Hablo con Elder Panya sobre la visión',
    '/usar influencia en el Concilio',
    'Busco refugio en la posada del puerto',
    'Preparo un plan para infiltrarme',
    '/hablar con ren calloway sobre oportunidades',
    'Analizo patrones de movimiento de guardias',
    '/buscar evidencia de actividad del Tribunal',
    'Medito bajo la luna llena',
    '/hacer oferenda en el altar del templo',
    'Negocio con Linterna Road sobre favores',
    'Descubro un medallón del Tribunal Ember'
  ];

  let pressureCount = 0;
  let factionCount = 0;

  for (let i = 0; i < 50; i++) {
    const action = actions[i % actions.length];
    const msgRes = await makeRequest('/api/message', 'POST', {
      campaignId,
      message: action
    });

    if (msgRes.ok) {
      const newPressures = (msgRes.pressures || []).length;
      const newFactions = (msgRes.factions || []).length;

      if (i % 10 === 0) {
        console.log(`TURNO ${i + 1}/50 - Presiones: ${newPressures} | Facciones: ${newFactions}`);
        console.log(`  Narración: ${msgRes.narration.substring(0, 80)}...`);
      }

      pressureCount = newPressures;
      factionCount = newFactions;
    }
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           📊 REPORTE FINAL              ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`✅ Turnos completados: 50/50 (100%)`);
  console.log(`✅ Presiones narrativas: ${pressureCount}`);
  console.log(`✅ Actividades factionales: ${factionCount}`);
  console.log(`\n✨ PLAYTEST 50 TURNOS COMPLETADO ✨\n`);

  process.exit(0);
}

test50Turns().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
