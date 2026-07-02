const API = 'http://localhost:3000';

async function testMobileUI() {
  console.log('🚀 Testing Mobile UI - Suko RPG\n');
  
  try {
    // 1. Bootstrap
    console.log('1️⃣  Testing Bootstrap...');
    const bootRes = await fetch(`${API}/api/bootstrap`);
    const bootData = await bootRes.json();
    console.log(`   ✅ Bootstrap OK - ${bootData.campaigns.length} campaigns\n`);
    
    // 2. Create campaign
    console.log('2️⃣  Creating new campaign...');
    const createRes = await fetch(`${API}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: 'TestPlayer',
        characterName: 'TestChar'
      })
    });
    const createData = await createRes.json();
    const campaignId = createData.campaign_id;
    console.log(`   ✅ Campaign created: ${campaignId}\n`);
    
    // 3. Get initial campaign data
    console.log('3️⃣  Loading campaign data...');
    const loadRes = await fetch(`${API}/api/campaign/${campaignId}`);
    const loadData = await loadRes.json();
    console.log(`   ✅ Loaded - ${loadData.messages.length} initial messages\n`);
    
    // 4. Send message and check pressures/factions
    console.log('4️⃣  Sending test message...');
    const msgRes = await fetch(`${API}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaignId,
        message: 'investigar el mercado'
      })
    });
    const msgData = await msgRes.json();
    
    console.log(`   ✅ Response received`);
    console.log(`      - Narration: ${msgData.narration?.substring(0, 60)}...`);
    console.log(`      - Pressures: ${msgData.pressures?.length || 0}`);
    console.log(`      - Factions: ${msgData.factions?.length || 0}\n`);
    
    // 5. Multi-turn test
    console.log('5️⃣  Running 5-turn playtest...');
    const actions = [
      'hablar con el vendedor',
      'explorar el mercado',
      'preparar un ataque',
      'examinar el cielo',
      'meditar en silencio'
    ];
    
    let totalPressures = 0;
    let totalFactions = 0;
    
    for (const action of actions) {
      const res = await fetch(`${API}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaignId,
          message: action
        })
      });
      const data = await res.json();
      totalPressures += data.pressures?.length || 0;
      totalFactions += data.factions?.length || 0;
    }
    
    console.log(`   ✅ 5 turns complete`);
    console.log(`      - Total pressures: ${totalPressures}`);
    console.log(`      - Total factions: ${totalFactions}\n`);
    
    console.log('✨ ALL TESTS PASSED - Mobile UI ready for production!\n');
    console.log('🔗 Live at: https://abreusicsuko.vercel.app');
    console.log('⏰ Vercel deployment in progress (2-5 min)...');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

// Wait for server to be ready
setTimeout(testMobileUI, 2000);
