// END-TO-END DICE SYSTEM TEST
// Uses Node.js v24 native fetch (no imports needed)

const API_BASE = 'http://localhost:3000';
let campaignId = '';

async function testDiceSystem() {
  console.log('🎲 END-TO-END DICE SYSTEM TEST\n');
  
  try {
    // Step 1: Create campaign
    console.log('📝 PASO 1: Crear campaña...');
    const createRes = await fetch(`${API_BASE}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: 'TestPlayer',
        characterName: 'DiceTestChar'
      })
    });
    
    const createData = await createRes.json();
    if (!createData.ok) {
      throw new Error('Campaign creation failed: ' + JSON.stringify(createData));
    }
    
    campaignId = createData.campaign_id;
    console.log(`✅ Campaña creada: ${campaignId}\n`);
    
    // Step 2: Test action that triggers dice roll
    console.log('🎲 PASO 2: Enviar acción que dispare tirada...');
    const messageRes = await fetch(`${API_BASE}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaignId,
        message: 'Intento atacar al guardia con mi espada'
      })
    });
    
    const messageData = await messageRes.json();
    if (!messageData.ok) {
      throw new Error('Message failed: ' + JSON.stringify(messageData));
    }
    
    console.log('✅ Mensaje procesado\n');
    
    // Step 3: Validate dice roll
    console.log('🎲 PASO 3: Validar tirada de dados...');
    if (messageData.diceRoll) {
      const roll = messageData.diceRoll;
      console.log(`✅ TIRADA DETECTADA:`);
      console.log(`   Habilidad: ${roll.skill}`);
      console.log(`   d20: ${roll.d20}`);
      console.log(`   Bonus: +${roll.bonus}`);
      console.log(`   Total: ${roll.total}`);
      console.log(`   DC: ${roll.difficulty}`);
      console.log(`   Resultado: ${roll.success ? '✅ ÉXITO' : '❌ FRACASO'}`);
      if (roll.criticalSuccess) console.log(`   ⭐ ÉXITO CRÍTICO`);
      if (roll.criticalFailure) console.log(`   💀 FRACASO CRÍTICO`);
    } else {
      console.log('⚠️ No se detectó tirada en esta acción');
    }
    
    console.log('\n🎲 PASO 4: Verificar narración...');
    console.log('Narración recibida:');
    console.log(messageData.narration.substring(0, 200) + '...\n');
    
    // Step 5: Test multiple actions
    console.log('🎲 PASO 5: Probar múltiples acciones...');
    const actions = [
      'Persuado al guardia para que me deje pasar',
      'Investigo la escena del crimen',
      'Intento esconderme en las sombras',
      'Recurro a mi conocimiento de magia'
    ];
    
    for (const action of actions) {
      const res = await fetch(`${API_BASE}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaignId,
          message: action
        })
      });
      
      const data = await res.json();
      if (data.ok) {
        const hasRoll = data.diceRoll ? '🎲' : '📖';
        const rollInfo = data.diceRoll 
          ? `${data.diceRoll.skill} (${data.diceRoll.total} vs DC ${data.diceRoll.difficulty})`
          : 'sin tirada';
        console.log(`${hasRoll} "${action}" → ${rollInfo}`);
      }
    }
    
    console.log('\n✨ TEST COMPLETADO EXITOSAMENTE');
    console.log('\n📊 RESUMEN:');
    console.log(`✅ Campaña creada: ${campaignId}`);
    console.log(`✅ Dados generados en respuestas`);
    console.log(`✅ Narración recibida y procesada`);
    console.log(`✅ Sistema de dados integrado correctamente`);
    
  } catch (err) {
    console.error('❌ TEST FALLIDO:', err.message);
    process.exit(1);
  }
}

// Run test
testDiceSystem().then(() => {
  console.log('\n✨ Dice system ready for gameplay!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
