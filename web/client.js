// SUKO RPG - Mobile Client
const API_BASE = window.location.origin;
const STORE_KEY = 'suko_campaign_id';

const state = {
  campaignId: '',
  busy: false,
  messages: [],
  currentState: {},
  inventory: [],
  locations: [],
  pressures: [],
  factions: []
};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  bindMenus();
  bindTabs();
  bindCommands();
  bindInput();
  loadBootstrap();
}

/* ========== MENUS & MODALS ========== */

function bindMenus() {
  // Menu hamburguesa
  document.getElementById('menuBtn').addEventListener('click', toggleMenu);
  document.getElementById('closeMenuBtn').addEventListener('click', toggleMenu);
  document.getElementById('menuOverlay').addEventListener('click', toggleMenu);

  // Menu items
  document.getElementById('newGameBtn').addEventListener('click', () => {
    toggleMenu();
    showModal('newCampaignModal');
  });
  document.getElementById('loadGameBtn').addEventListener('click', () => {
    toggleMenu();
    showModal('loadCampaignModal');
    loadCampaignList();
  });
  document.getElementById('saveGameBtn').addEventListener('click', () => {
    toggleMenu();
    alert('Partida guardada automáticamente.');
  });
  document.getElementById('clearCacheBtn').addEventListener('click', () => {
    if (confirm('¿Limpiar caché? Perderás datos temporales.')) {
      localStorage.clear();
      toggleMenu();
      location.reload();
    }
  });
  document.getElementById('deleteDataBtn').addEventListener('click', () => {
    if (confirm('¿BORRAR TODO? ⚠️ No se puede deshacer.')) {
      localStorage.clear();
      indexedDB.deleteDatabase('SukoRPG');
      toggleMenu();
      location.reload();
    }
  });

  // Stats button
  document.getElementById('statsBtn').addEventListener('click', () => {
    showModal('statsModal');
    updateStatsPanel();
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  // Campaign modal buttons
  document.getElementById('createNewCampaignBtn').addEventListener('click', async () => {
    const playerName = document.getElementById('playerNameInput').value.trim();
    const characterName = document.getElementById('characterNameInput').value.trim();
    
    if (!playerName || !characterName) {
      alert('Por favor completa todos los campos');
      return;
    }
    
    await createCampaign(playerName, characterName);
    closeModal('newCampaignModal');
  });

  document.getElementById('loadSelectedCampaignBtn').addEventListener('click', () => {
    const campaignId = document.getElementById('campaignSelectDropdown').value;
    if (campaignId) {
      loadCampaign(campaignId);
      closeModal('loadCampaignModal');
    }
  });
}

function toggleMenu() {
  const menu = document.getElementById('sideMenu');
  const overlay = document.getElementById('menuOverlay');
  
  menu.classList.toggle('hidden');
  overlay.classList.toggle('hidden');
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

/* ========== TABS ========== */

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  // Deactivate all tabs
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  // Activate selected tab
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  // Update panel content on tab switch
  if (tabName === 'presion') {
    updatePresionTab();
  } else if (tabName === 'inventario') {
    updateInventarioTab();
  } else if (tabName === 'mapa') {
    updateMapaTab();
  }
}

/* ========== CHAT & INPUT ========== */

function bindCommands() {
  // Commands are bound dynamically via updateQuickCommands()
  // This function stays for compatibility
  updateQuickCommands([
    '🔍 Investigar',
    '💬 Hablar',
    '⚔️ Preparar',
    '👀 Examinar'
  ]);
}

function updateQuickCommands(commands) {
  const container = document.querySelector('.quick-commands');
  if (!container) return;
  
  container.innerHTML = '';
  (commands || []).slice(0, 4).forEach((cmd, idx) => {
    const btn = document.createElement('button');
    btn.className = 'cmd-quick';
    btn.textContent = cmd;
    btn.addEventListener('click', () => {
      document.getElementById('userInput').value = cmd;
      onSend();
    });
    container.appendChild(btn);
  });
}

function bindInput() {
  const input = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  
  sendBtn.addEventListener('click', onSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });
}

async function onSend() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  
  if (!message || !state.campaignId || state.busy) return;
  
  state.busy = true;
  input.value = '';
  
  try {
    // Add user message to chat
    addChatMessage(message, 'user');
    
    // Send to server
    const res = await fetch(`${API_BASE}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: state.campaignId,
        message: message
      })
    });
    
    const data = await res.json();
    
    if (data.ok) {
      // Add AI response
      addChatMessage(data.narration, 'assistant');
      
      // Update state
      if (data.state) state.currentState = data.state;
      if (data.inventory) state.inventory = data.inventory;
      if (data.locations) state.locations = data.locations;
      if (data.pressures) state.pressures = data.pressures;
      if (data.factions) state.factions = data.factions;
      
      // Update dynamic quick commands based on server response
      if (data.quickCommands && data.quickCommands.length > 0) {
        updateQuickCommands(data.quickCommands);
      }
      
      // Update panels
      updatePresionTab();
    } else {
      showError(data.error || 'Error desconocido');
    }
  } catch (err) {
    showError('Error de conexión: ' + err.message);
  } finally {
    state.busy = false;
  }
}

function addChatMessage(text, role) {
  const chatBox = document.getElementById('chatBox');
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showError(text) {
  const errorBox = document.getElementById('errorBox');
  errorBox.textContent = text;
  errorBox.classList.remove('hidden');
  setTimeout(() => errorBox.classList.add('hidden'), 5000);
}

/* ========== CAMPAIGN MANAGEMENT ========== */

async function loadBootstrap() {
  try {
    const res = await fetch(`${API_BASE}/api/bootstrap`);
    const data = await res.json();
    
    state.campaigns = data.campaigns || [];
    
    const savedCampaignId = localStorage.getItem(STORE_KEY);
    if (savedCampaignId && state.campaigns.find(c => c.campaign_id === savedCampaignId)) {
      loadCampaign(savedCampaignId);
    } else {
      showInitScreen();
    }
  } catch (err) {
    console.error('Bootstrap error:', err);
    showInitScreen();
  }
}

function showInitScreen() {
  // Hide app, show init screen
  document.querySelector('.app-container').style.display = 'none';
  document.getElementById('campaignInitPanel').classList.remove('hidden');
  
  document.getElementById('initNewBtn').addEventListener('click', () => {
    document.getElementById('campaignInitPanel').classList.add('hidden');
    document.querySelector('.app-container').style.display = 'flex';
    showModal('newCampaignModal');
  });
  
  document.getElementById('initLoadBtn').addEventListener('click', () => {
    document.getElementById('campaignInitPanel').classList.add('hidden');
    document.querySelector('.app-container').style.display = 'flex';
    showModal('loadCampaignModal');
    loadCampaignList();
  });
}

async function createCampaign(playerName, characterName) {
  try {
    const res = await fetch(`${API_BASE}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, characterName })
    });
    
    const data = await res.json();
    
    if (data.ok) {
      state.campaignId = data.campaign_id;
      localStorage.setItem(STORE_KEY, data.campaign_id);
      loadCampaign(data.campaign_id);
    } else {
      showError('Error creando partida');
    }
  } catch (err) {
    showError('Error: ' + err.message);
  }
}

function loadCampaignList() {
  const dropdown = document.getElementById('campaignSelectDropdown');
  dropdown.innerHTML = '<option value="">-- Selecciona una partida --</option>';
  
  state.campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.campaign_id;
    opt.textContent = `${c.campaign_id} - ${new Date(c.created_at).toLocaleDateString('es-ES')}`;
    dropdown.appendChild(opt);
  });
}

async function loadCampaign(campaignId) {
  try {
    const res = await fetch(`${API_BASE}/api/campaign/${campaignId}`);
    const data = await res.json();
    
    if (data.ok) {
      state.campaignId = campaignId;
      state.currentState = data.state || {};
      state.messages = data.messages || [];
      localStorage.setItem(STORE_KEY, campaignId);
      
      // Show app
      document.querySelector('.app-container').style.display = 'flex';
      document.getElementById('campaignInitPanel').classList.add('hidden');
      
      // Render messages
      const chatBox = document.getElementById('chatBox');
      chatBox.innerHTML = '';
      data.messages?.forEach(msg => {
        addChatMessage(msg.content, msg.role);
      });
      
      // Load pressures and factions
      updatePresionTab();
    }
  } catch (err) {
    showError('Error cargando partida: ' + err.message);
  }
}

/* ========== PANEL UPDATES ========== */

function updatePresionTab() {
  if (state.pressures && state.pressures.length > 0) {
    const pressureListTab = document.getElementById('pressureListTab');
    pressureListTab.innerHTML = '';
    
    state.pressures.forEach(p => {
      const el = document.createElement('div');
      el.className = 'pressure-item';
      const severity = '⚡'.repeat(Math.min(5, p.severity || 1));
      el.innerHTML = `
        <div class="pressure-type">${p.pressure_type}</div>
        <div class="pressure-desc">${p.description}</div>
        <div class="pressure-severity">${severity}</div>
      `;
      pressureListTab.appendChild(el);
    });
  }
  
  if (state.factions && state.factions.length > 0) {
    const factionListTab = document.getElementById('factionListTab');
    factionListTab.innerHTML = '';
    
    state.factions.forEach(f => {
      const el = document.createElement('div');
      el.className = 'faction-item';
      el.innerHTML = `
        <div class="faction-name">${f.faction_name}</div>
        <div class="faction-goal">${f.current_goal}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${f.progress_pct}%"></div>
        </div>
        <div class="progress-pct">${f.progress_pct}%</div>
      `;
      factionListTab.appendChild(el);
    });
  }
}

function updateInventarioTab() {
  const list = document.getElementById('inventoryListTab');
  
  if (state.inventory && state.inventory.length > 0) {
    list.innerHTML = '';
    state.inventory.forEach(item => {
      const el = document.createElement('div');
      el.className = 'item-entry';
      el.textContent = item.name || item.item_name || 'Item';
      list.appendChild(el);
    });
  } else {
    list.innerHTML = '<p class="placeholder">Sin items</p>';
  }
}

function updateMapaTab() {
  const list = document.getElementById('locationListTab');
  
  if (state.locations && state.locations.length > 0) {
    list.innerHTML = '';
    state.locations.forEach(loc => {
      const el = document.createElement('div');
      el.className = 'location-btn';
      el.textContent = loc.name || loc.location_name || 'Lugar';
      list.appendChild(el);
    });
  } else {
    list.innerHTML = '<p class="placeholder">Descubriendo lugares...</p>';
  }
}

function updateStatsPanel() {
  const state_data = state.currentState || {};
  
  // Update stat cards
  document.getElementById('statHealth').textContent = '100';
  document.getElementById('statHealthBar').style.width = '100%';
  
  document.getElementById('statHunger').textContent = '0';
  document.getElementById('statHungerBar').style.width = '0%';
  
  document.getElementById('statTemp').textContent = 'Normal';
  document.getElementById('statFatigueValue').textContent = state_data.fatigue || 'leve';
  
  // Location info
  document.getElementById('statLocationValue').textContent = state_data.location || '-';
  document.getElementById('statRegionValue').textContent = state_data.region || '-';
  document.getElementById('statMoneyValue').textContent = state_data.money || '0';
  
  // NPCs
  const npcList = document.getElementById('statsNPCList');
  npcList.innerHTML = '<p class="placeholder">Sin NPCs</p>';
  
  // Inventory
  const invList = document.getElementById('statsInventoryList');
  if (state.inventory && state.inventory.length > 0) {
    invList.innerHTML = '';
    state.inventory.forEach(item => {
      const el = document.createElement('div');
      el.className = 'item-entry';
      el.textContent = item.name || item.item_name || 'Item';
      invList.appendChild(el);
    });
  } else {
    invList.innerHTML = '<p class="placeholder">Sin items</p>';
  }
}
