import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function test() {
  try {
    console.log('🔧 DEBUG GEMINI TEST\n');
    
    // Create campaign
    console.log('[1] Creating campaign...');
    const createRes = await fetch(`${API_BASE}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: 'DebugPlayer',
        characterName: 'DebugChar'
      })
    });
    const createData = await createRes.json();
    const campaignId = createData.campaign_id;
    console.log('✅ Campaign:', campaignId);
    
    if (!campaignId) {
      console.log('❌ Campaign creation failed:', createData);
      process.exit(1);
    }
    
    // Send a simple message
    console.log('\n[2] Sending message to trigger Gemini...');
    const msgRes = await fetch(`${API_BASE}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaignId,
        message: 'Busco a alguien que me ayude'
      })
    });
    const msgData = await msgRes.json();
    console.log('✅ Message response:', msgData.ok);
    console.log('� Full response:', JSON.stringify(msgData, null, 2));
    console.log('�📝 Narration:', msgData.narration?.substring(0, 150));
    
    // Check server logs for Gemini errors
    console.log('\n[3] Check server console for [GEMINI JSON PARSE ERROR] messages');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

test();
