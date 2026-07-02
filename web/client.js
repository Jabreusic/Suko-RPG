const API_BASE = window.location.origin;
const STORE_KEY = 'suko_campaign_id';

const state = {
  campaignId: '',
  busy: false,
  campaigns: []
};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  bindUi();
  loadBootstrap();
}

function bindUi() {
  document.getElementById('createCampaignBtn').addEventListener('click', onCreateCampaign);
  document.getElementById('loadCampaignBtn').addEventListener('click', onLoadCampaign);
  document.getElementById('sendBtn').addEventListener('click', onSend);

  document.getElementById('userInput').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      onSend();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (btn) {
    btn.addEventListener('click', function () {
      const cmd = btn.getAttribute('data-command');
      if (!cmd) return;
      document.getElementById('userInput').value = cmd;
      onSend();
    });
  });
}

async function loadBootstrap() {
  clearError();
  try {
    const res = await fetch(`${API_BASE}/api/bootstrap`);
    const data = await res.json();

    if (!data || !data.ok) {
      showError((data && data.error) || 'No pude cargar campañas.');
      reportClientError('loadBootstrap.result', (data && data.error) || 'Respuesta inválida');
      return;
    }

    state.campaigns = data.campaigns || [];
    renderCampaignSelect();

    const saved = localStorage.getItem(STORE_KEY);
    if (isValidCampaignId(saved) && state.campaigns.some(function (c) { return c.campaign_id === saved; })) {
      state.campaignId = saved;
      document.getElementById('campaignSelect').value = saved;
      loadCampaign(saved);
    }
  } catch (err) {
    showError('No se pudo conectar con el servidor.');
    reportClientError('loadBootstrap.failure', err.message);
  }
}

function renderCampaignSelect() {
  const select = document.getElementById('campaignSelect');
  select.innerHTML = '';

  if (!state.campaigns.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Sin campañas';
    select.appendChild(empty);
    return;
  }

  state.campaigns.forEach(function (c) {
    const op = document.createElement('option');
    op.value = c.campaign_id;
    op.textContent = c.character_name + ' (' + c.player_name + ')';
    select.appendChild(op);
  });
}

async function onCreateCampaign() {
  if (state.busy) return;

  const playerName = (document.getElementById('playerName').value || '').trim();
  const characterName = (document.getElementById('characterName').value || '').trim();

  if (!playerName || !characterName) {
    showError('Escribe nombre de jugador y personaje.');
    reportClientError('createCampaign.validation', 'Faltan nombres');
    return;
  }

  setBusy(true);
  clearError();

  try {
    const res = await fetch(`${API_BASE}/api/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, characterName })
    });

    const data = await res.json();

    if (!data || !data.ok) {
      showError('No pude crear la campaña.');
      setBusy(false);
      return;
    }

    state.campaignId = data.campaign_id;
    localStorage.setItem(STORE_KEY, data.campaign_id);
    document.getElementById('playerName').value = '';
    document.getElementById('characterName').value = '';
    appendMessage('assistant', 'Campaña creada. Iniciando escena...');
    loadBootstrap();
    loadCampaign(data.campaign_id);
  } catch (err) {
    showError(err.message);
    reportClientError('createCampaign.failure', err.message);
    setBusy(false);
  }
}

function onLoadCampaign() {
  const id = document.getElementById('campaignSelect').value;
  if (!id) {
    showError('Selecciona una campaña.');
    reportClientError('loadCampaign.validation', 'Sin campaign_id');
    return;
  }
  loadCampaign(id);
}

async function loadCampaign(campaignId) {
  if (!isValidCampaignId(campaignId)) {
    showError('campaign_id inválido.');
    reportClientError('loadCampaign.validation', 'campaign_id inválido: ' + String(campaignId || ''));
    return;
  }

  setBusy(true);
  clearError();

  try {
    const res = await fetch(`${API_BASE}/api/campaign/${campaignId}`);
    const data = await res.json();

    if (!data || !data.ok) {
      showError((data && data.error) || 'No pude cargar la campaña.');
      reportClientError('loadCampaign.result', (data && data.error) || 'Respuesta inválida', campaignId);
      setBusy(false);
      return;
    }

    state.campaignId = campaignId;
    localStorage.setItem(STORE_KEY, campaignId);
    renderMessages(data.messages || []);
    setBusy(false);
  } catch (err) {
    showError(err.message);
    reportClientError('loadCampaign.failure', err.message, campaignId);
    setBusy(false);
  }
}

async function onSend() {
  if (state.busy) return;
  if (!isValidCampaignId(state.campaignId)) {
    showError('Primero crea o carga una campaña.');
    reportClientError('send.validation', 'No hay campaña activa.');
    return;
  }

  const input = document.getElementById('userInput');
  const text = (input.value || '').trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);

  setBusy(true);
  clearError();

  try {
    const res = await fetch(`${API_BASE}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: state.campaignId, message: text })
    });

    const data = await res.json();

    if (!data || !data.ok) {
      showError((data && data.error) || 'No hubo respuesta.');
      setBusy(false);
      return;
    }

    appendMessage('assistant', data.narration || '...');
    setBusy(false);
  } catch (err) {
    showError(err.message);
    reportClientError('send.failure', err.message, state.campaignId);
    setBusy(false);
  }
}

function renderMessages(messages) {
  const box = document.getElementById('chatBox');
  box.innerHTML = '';
  messages.forEach(function (m) {
    appendMessage(m.role === 'user' ? 'user' : 'assistant', String(m.content || ''), false);
  });
  scrollChatToBottom();
}

function appendMessage(role, text, autoScroll) {
  const box = document.getElementById('chatBox');
  const msg = document.createElement('div');
  msg.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');
  msg.textContent = sanitizeClientText(text || '');
  box.appendChild(msg);
  if (autoScroll !== false) {
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  const box = document.getElementById('chatBox');
  box.scrollTop = box.scrollHeight;
}

function setBusy(isBusy) {
  state.busy = !!isBusy;
  document.getElementById('sendBtn').disabled = state.busy;
  document.getElementById('createCampaignBtn').disabled = state.busy;
  document.getElementById('loadCampaignBtn').disabled = state.busy;
  document.getElementById('sendBtn').textContent = state.busy ? 'Pensando...' : 'Enviar';
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg || 'Ocurrió un error inesperado.';
  box.classList.remove('hidden');
}

function clearError() {
  const box = document.getElementById('errorBox');
  box.textContent = '';
  box.classList.add('hidden');
}

function sanitizeClientText(text) {
  return String(text)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function reportClientError(context, message, campaignId) {
  try {
    await fetch(`${API_BASE}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        message,
        campaignId: campaignId || state.campaignId || ''
      })
    });
  } catch (err) {
    console.warn('No se pudo registrar error cliente:', err);
  }
}

function isValidCampaignId(id) {
  return /^cmp_[a-zA-Z0-9]{8,40}$/.test(String(id || '').trim());
}
