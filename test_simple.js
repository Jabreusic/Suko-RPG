const API = 'http://localhost:3000';

async function simpleTest() {
  console.log('🔍 Simple Test - Debug Response\n');
  
  try {
    // Create campaign
    const createRes = await fetch(`${API}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: 'TestUser',
        characterName: 'TestChar'
      })
    });
    
    const createData = await createRes.json();
    const campaignId = createData.campaign_id;
    console.log(`Campaign: ${campaignId}`);
    console.log(`Status: ${createRes.status}\n`);
    
    // Send one message
    console.log('Sending test message...');
    const msgRes = await fetch(`${API}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaignId,
        message: 'investigar el mercado'
      })
    });
    
    console.log(`Response Status: ${msgRes.status}`);
    console.log(`Content-Type: ${msgRes.headers.get('content-type')}`);
    
    const msgData = await msgRes.json();
    
    console.log(`\n✅ Response received:`);
    console.log(`   OK: ${msgData.ok}`);
    console.log(`   Narration: ${msgData.narration?.substring(0, 80)}...`);
    console.log(`   Quick Commands: ${JSON.stringify(msgData.quickCommands)}`);
    console.log(`   Pressures: ${msgData.pressures?.length || 0}`);
    console.log(`   Factions: ${msgData.factions?.length || 0}`);
    
    if (msgData.ok) {
      console.log('\n✨ Success!');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setTimeout(simpleTest, 2000);
