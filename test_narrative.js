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

async function testNarrative() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🎮 SUKO RPG - TEST NARRATIVAS        ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('[PASO 1] Creando campaña...');
  const createRes = await makeRequest('/api/campaign', 'POST', {
    playerName: 'TestPlayer',
    characterName: 'Zuko'
  });

  const campaignId = createRes.campaign_id;
  console.log(`✅ Campaña: ${campaignId}\n`);

  // Test different action types
  const actions = [
    'Examino cuidadosamente el mercado buscando pistas',
    'Me lanzo contra el guardia con furia',
    'Hablo con Elder Panya sobre la conspiración',
    'Exploro los túneles bajo la ciudad',
    'Me siento a meditar bajo la luna',
    'Negoció con el comerciante de especias',
  ];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const msgRes = await makeRequest('/api/message', 'POST', {
      campaignId,
      message: action
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[TURNO ${i + 1}] ${action}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${msgRes.narration}\n`);
  }

  console.log('✨ TEST COMPLETADO ✨');
  process.exit(0);
}

testNarrative().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
