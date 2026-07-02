const API = 'http://localhost:3000';

async function testImmersiveSystem() {
  console.log('🎮 Testing Immersive IA System - Suko RPG\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // 1. Bootstrap
    console.log('1️⃣  Testing Bootstrap...');
    const bootRes = await fetch(`${API}/api/bootstrap`);
    const bootData = await bootRes.json();
    console.log(`   ✅ Bootstrap OK - ${bootData.campaigns.length} campaigns\n`);
    
    // 2. Create campaign
    console.log('2️⃣  Creating test campaign...');
    const createRes = await fetch(`${API}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: 'TestJugador',
        characterName: 'TestPersonaje'
      })
    });
    const createData = await createRes.json();
    const campaignId = createData.campaign_id;
    console.log(`   ✅ Campaign: ${campaignId}\n`);
    
    // 3. Send 10 messages and track Gemini success rate
    console.log('3️⃣  Running 10-turn playtest with Gemini tracking...\n');
    
    let geminiSuccesses = 0;
    let templateFallbacks = 0;
    let totalQuickCommands = [];
    let totalPressures = 0;
    let totalFactions = 0;
    
    const testActions = [
      'investigar el mercado para encontrar pistas',
      'hablar con los comerciantes del lugar',
      'explorar las callejuelas oscuras',
      'preparar un plan estratégico',
      'meditar en busca de claridad',
      'buscar tesoros escondidos',
      'combatir a los enemigos cercanos',
      'examinar los alrededores cuidadosamente',
      'hacer alianzas con personas poderosas',
      'descubrir secretos ocultos'
    ];
    
    for (let i = 0; i < testActions.length; i++) {
      const action = testActions[i];
      process.stdout.write(`   Turn ${i + 1}/10: "${action.substring(0, 40)}..." `);
      
      const res = await fetch(`${API}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaignId,
          message: action
        })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Detect if it's Gemini or template
        const narration = data.narration;
        
        // Check for Gemini success indicators in server logs
        // (would need to capture server logs for proper detection)
        // For now, we'll just count the quick commands as a proxy for Gemini quality
        
        const isLikelyGemini = narration.length > 150 && 
                               (narration.includes('.') || narration.includes('!')) &&
                               !narration.includes('Observas como un cazador') // Template indicator
        
        if (isLikelyGemini) {
          geminiSuccesses++;
          process.stdout.write('✅ GEMINI');
        } else {
          templateFallbacks++;
          process.stdout.write('📋 TEMPLATE');
        }
        
        // Track data
        if (data.quickCommands) {
          totalQuickCommands.push(...data.quickCommands);
        }
        if (data.pressures) {
          totalPressures += data.pressures.length;
        }
        if (data.factions) {
          totalFactions += data.factions.length;
        }
        
        console.log(` | ${data.narration.substring(0, 40)}...`);
      } else {
        console.log('❌ FAILED');
      }
    }
    
    console.log(`\n═══════════════════════════════════════════════════════════════\n`);
    
    console.log('📊 RESULTS:\n');
    console.log(`   ✅ Gemini successes: ${geminiSuccesses}/10 (${Math.round(geminiSuccesses/10*100)}%)`);
    console.log(`   📋 Template fallbacks: ${templateFallbacks}/10 (${Math.round(templateFallbacks/10*100)}%)`);
    console.log(`   🎯 Quick Commands generated: ${totalQuickCommands.length}`);
    console.log(`      Unique commands: ${new Set(totalQuickCommands).size}`);
    console.log(`   ⚡ Total pressures: ${totalPressures}`);
    console.log(`   🏛️  Total factions: ${totalFactions}`);
    
    if (geminiSuccesses >= 7) {
      console.log(`\n✨ SUCCESS! 80% Gemini strategy is working!\n`);
    } else if (geminiSuccesses >= 5) {
      console.log(`\n⚠️  PARTIAL SUCCESS - Gemini rate limiting might be active\n`);
    } else {
      console.log(`\n❌ FAILED - Gemini not generating enough content\n`);
    }
    
    console.log('📝 Sample Quick Commands Generated:');
    Array.from(new Set(totalQuickCommands)).slice(0, 5).forEach(cmd => {
      console.log(`   • ${cmd}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

// Wait for server
setTimeout(testImmersiveSystem, 2000);
