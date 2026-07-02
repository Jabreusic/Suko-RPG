function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  ensureDatabaseIntegrity_();
  const tpl = HtmlService.createTemplateFromFile("index");
  tpl.appName = getSetting_("APP_NAME") || "SUKO RPG";
  return tpl
    .evaluate()
    .setTitle("SUKO RPG")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getBootstrapData() {
  try {
    ensureDatabaseIntegrity_();
    const campaigns = getAllRows_("campaigns")
      .filter(function (c) { return String(c.status || "active") !== "archived"; })
      .sort(function (a, b) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 30);

    return {
      ok: true,
      appName: getSetting_("APP_NAME") || "SUKO RPG",
      campaigns: campaigns
    };
  } catch (err) {
    logEvent_("", "ERROR", "getBootstrapData failed", err.stack || err.message);
    return {
      ok: false,
      error: "No pude cargar la aplicación ahora. Revisa la configuración y vuelve a intentar."
    };
  }
}

function createCampaign(playerName, characterName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureDatabaseIntegrity_();
    return createCampaignCore_(playerName, characterName);
  } catch (err) {
    logEvent_("", "ERROR", "createCampaign failed", err.stack || err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function createCampaignCore_(playerName, characterName) {
  const pName = sanitizeText_(playerName).slice(0, 60);
  const cName = sanitizeText_(characterName).slice(0, 60);

  if (!pName || !cName) {
    throw new Error("Nombre de jugador y personaje son obligatorios.");
  }

  const campaignId = "cmp_" + Utilities.getUuid().replace(/-/g, "").slice(0, 20);
  const now = nowIso_();

  appendRow_("campaigns", {
    campaign_id: campaignId,
    player_name: pName,
    character_name: cName,
    created_at: now,
    updated_at: now,
    status: "active"
  });

  appendRow_("characters", {
    campaign_id: campaignId,
    character_name: cName,
    origin: "",
    ability: "",
    personality_notes: "",
    visual_profile: "",
    created_at: now
  });

  upsertRow_("campaign_state", ["campaign_id"], {
    campaign_id: campaignId,
    location: "",
    region: "",
    season: "",
    ability: "",
    ability_limits: "",
    fatigue: "leve",
    current_pressure: "",
    next_hook: "",
    money: "10",
    updated_at: now
  });

  ensureCampaignHasOpeningScene_(campaignId);

  return {
    ok: true,
    campaign_id: campaignId,
    player_name: pName,
    character_name: cName
  };
}

function getCampaignData(campaignId) {
  try {
    const id = sanitizeId_(campaignId);
    ensureDatabaseIntegrity_();

    const campaign = getCampaignById_(id);
    if (!campaign) {
      throw new Error("Campaña no encontrada.");
    }

    ensureCampaignHasOpeningScene_(id);

    return {
      ok: true,
      campaign: campaign,
      state: getCampaignState_(id),
      messages: getRowsByCampaign_("messages", id).sort(function (a, b) {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      })
    };
  } catch (err) {
    logEvent_(campaignId || "", "ERROR", "getCampaignData failed", err.stack || err.message);
    return {
      ok: false,
      error: "No pude cargar esa campaña ahora."
    };
  }
}

function logClientError(context, message, campaignId) {
  const cleanContext = sanitizeText_(context).slice(0, 120) || "client";
  const cleanMessage = sanitizeText_(message).slice(0, 1500) || "Error desconocido del cliente.";
  const cleanCampaignId = campaignId ? sanitizeText_(campaignId).slice(0, 60) : "";
  logEvent_(cleanCampaignId, "ERROR", "client:" + cleanContext, cleanMessage);
  return { ok: true };
}

function handlePlayerMessage(campaignId, userMessage) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureDatabaseIntegrity_();

    const id = sanitizeId_(campaignId);
    const cleanMessage = sanitizeText_(userMessage).slice(0, 1200);

    if (!cleanMessage) {
      throw new Error("El mensaje está vacío.");
    }

    const campaign = getCampaignById_(id);
    if (!campaign) {
      throw new Error("Campaña inválida.");
    }

    ensureCampaignHasOpeningScene_(id);

    appendRow_("messages", {
      timestamp: nowIso_(),
      campaign_id: id,
      role: "user",
      content: cleanMessage,
      summary_flag: false
    });

    if (cleanMessage.charAt(0) === "/") {
      const commandResponse = executeCommand_(id, cleanMessage);
      appendRow_("messages", {
        timestamp: nowIso_(),
        campaign_id: id,
        role: "assistant",
        content: commandResponse,
        summary_flag: false
      });
      maybeAutoCreateChapterSummary_(id);
      touchCampaign_(id);
      return { ok: true, campaign_id: id, narration: commandResponse, source: "command" };
    }

    const maxMessages = Number(getSetting_("MAX_CONTEXT_MESSAGES") || 10);
    const state = getCampaignState_(id) || {};
    const recentMessages = getRecentMessages_(id, Math.min(Math.max(maxMessages, 8), 12));
    const npcs = getRowsByCampaign_("npcs", id).slice(0, 12);
    const relationships = getRowsByCampaign_("relationships", id).slice(0, 12);
    const inventory = getRowsByCampaign_("inventory", id).slice(0, 30);
    const injuries = getRowsByCampaign_("injuries", id).filter(function (i) { return toBool_(i.active); }).slice(0, 10);
    const factions = getRowsByCampaign_("factions", id).slice(0, 12);
    const rumors = getRowsByCampaign_("rumors", id).filter(function (r) { return toBool_(r.active); }).slice(0, 12);
    const locations = getRowsByCampaign_("locations", id).slice(0, 12);

    const prompt = buildPrompt({
      campaign: campaign,
      state: state,
      recentMessages: recentMessages,
      npcs: npcs,
      relationships: relationships,
      inventory: inventory,
      injuries: injuries,
      factions: factions,
      rumors: rumors,
      locations: locations,
      userMessage: cleanMessage
    });

    let structured;
    try {
      structured = callGemini(prompt);
    } catch (apiErr) {
      logEvent_(id, "ERROR", "Gemini call failed", apiErr.stack || apiErr.message);
      structured = defaultGeminiResponse_();
      structured.narration = "La bruma espiritual interfiere con tu siguiente recuerdo. Intenta reformular la acción en una frase corta.";
      structured.debug_notes = "Fallback por error Gemini.";
    }

    const narration = sanitizeText_(structured.narration) || "El momento queda en suspenso. Describe tu siguiente acción.";

    appendRow_("messages", {
      timestamp: nowIso_(),
      campaign_id: id,
      role: "assistant",
      content: narration,
      summary_flag: false
    });

    applyStructuredChanges_(id, structured);
    maybeAutoCreateChapterSummary_(id);
    touchCampaign_(id);

    return {
      ok: true,
      campaign_id: id,
      narration: narration,
      source: "gemini"
    };
  } catch (err) {
    logEvent_(campaignId || "", "ERROR", "handlePlayerMessage failed", err.stack || err.message);
    return {
      ok: false,
      error: "No pude procesar tu acción ahora. Intenta de nuevo en unos segundos."
    };
  } finally {
    lock.releaseLock();
  }
}

function maybeAutoCreateChapterSummary_(campaignId) {
  const intervalRaw = Number(getSetting_("SUMMARY_TURN_INTERVAL") || 10);
  const interval = Math.min(Math.max(intervalRaw || 10, 8), 20);

  const allMessages = getRowsByCampaign_("messages", campaignId).sort(function (a, b) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const pending = allMessages.filter(function (m) {
    return !toBool_(m.summary_flag);
  });

  if (pending.length < interval) {
    return;
  }

  const chapterCount = getRowsByCampaign_("chapter_summaries", campaignId).length;
  const chapterNumber = String(chapterCount + 1);
  const state = getCampaignState_(campaignId) || {};

  const compactLog = pending.slice(-interval).map(function (m) {
    const role = m.role === "user" ? "J" : "N";
    return role + ":" + sanitizeText_(m.content).slice(0, 180);
  }).join(" | ");

  const summary = [
    "Ubicación " + (state.location || "incierta") + ", región " + (state.region || "no definida") + ".",
    "Presión: " + (state.current_pressure || "estable") + ".",
    "Eventos recientes: " + compactLog
  ].join(" ").slice(0, 1600);

  upsertRow_("chapter_summaries", ["campaign_id", "chapter_number"], {
    campaign_id: campaignId,
    chapter_number: chapterNumber,
    summary: summary,
    unresolved_threads: state.next_hook || "Sin hilo principal explícito.",
    created_at: nowIso_()
  });

  markCampaignMessagesSummarized_(campaignId);
}

function markCampaignMessagesSummarized_(campaignId) {
  const meta = getSheetMeta_("messages");
  const sheet = meta.sheet;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, meta.headers.length).getValues();
  const campaignIdx = meta.headerMap.campaign_id;
  const summaryIdx = meta.headerMap.summary_flag;
  if (campaignIdx === undefined || summaryIdx === undefined) {
    return;
  }

  let changed = false;
  values.forEach(function (row) {
    if (String(row[campaignIdx]) === String(campaignId) && !toBool_(row[summaryIdx])) {
      row[summaryIdx] = true;
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(2, 1, values.length, meta.headers.length).setValues(values);
  }
}

function executeCommand_(campaignId, commandText) {
  const cmd = sanitizeText_(commandText).toLowerCase();
  const state = getCampaignState_(campaignId) || {};

  if (cmd.indexOf("/estado") === 0) {
    return buildStateSummary_(state);
  }
  if (cmd.indexOf("/inventario") === 0) {
    return buildInventorySummary_(campaignId);
  }
  if (cmd.indexOf("/mapa") === 0) {
    return buildMapSummary_(campaignId, state);
  }
  if (cmd.indexOf("/rumores") === 0) {
    return buildRumorsSummary_(campaignId);
  }
  if (cmd.indexOf("/relaciones") === 0) {
    return buildRelationshipsSummary_(campaignId);
  }
  if (cmd.indexOf("/resumen") === 0) {
    return buildOrCreateCampaignSummary_(campaignId);
  }
  if (cmd.indexOf("/imagen") === 0) {
    return buildImagePromptSummary_(campaignId, state);
  }

  return "Comando no reconocido. Usa /estado, /inventario, /mapa, /rumores, /relaciones, /resumen o /imagen.";
}

function buildStateSummary_(state) {
  return [
    "Estado actual:",
    "Ubicación: " + (state.location || "desconocida"),
    "Región: " + (state.region || "sin definir"),
    "Estación: " + (state.season || "variable"),
    "Habilidad: " + (state.ability || "en desarrollo"),
    "Límites: " + (state.ability_limits || "sin datos"),
    "Fatiga: " + (state.fatigue || "leve"),
    "Presión actual: " + (state.current_pressure || "baja"),
    "Gancho próximo: " + (state.next_hook || "abierto")
  ].join("\n");
}

function buildInventorySummary_(campaignId) {
  const items = getRowsByCampaign_("inventory", campaignId);
  if (!items.length) {
    return "Inventario vacío por ahora. Solo llevas lo puesto y tus intenciones.";
  }
  const lines = items.map(function (i) {
    return "- " + i.item + " x" + i.quantity + (i.condition ? " (" + i.condition + ")" : "");
  });
  return "Inventario actual:\n" + lines.join("\n");
}

function buildMapSummary_(campaignId, state) {
  const places = getRowsByCampaign_("locations", campaignId);
  const current = state.location ? "Ubicación actual: " + state.location + " (" + (state.region || "región incierta") + ")" : "Ubicación actual no definida.";
  if (!places.length) {
    return current + "\nAún no registras rutas conocidas.";
  }
  const lines = places.slice(0, 8).map(function (p) {
    return "- " + p.location_name + ": rutas " + (p.known_routes || "sin datos") + ", peligro " + (p.danger_level || "desconocido");
  });
  return current + "\nRutas conocidas:\n" + lines.join("\n");
}

function buildRumorsSummary_(campaignId) {
  const rumors = getRowsByCampaign_("rumors", campaignId).filter(function (r) { return toBool_(r.active); });
  if (!rumors.length) {
    return "No hay rumores activos confirmados.";
  }
  return "Rumores activos:\n" + rumors.slice(0, 10).map(function (r) {
    return "- " + r.rumor + " (fuente: " + (r.source || "anónima") + ", fiabilidad: " + (r.reliability || "incierta") + ")";
  }).join("\n");
}

function buildRelationshipsSummary_(campaignId) {
  const rel = getRowsByCampaign_("relationships", campaignId);
  if (!rel.length) {
    return "Aún no hay relaciones registradas con NPCs.";
  }
  return "Relaciones:\n" + rel.slice(0, 12).map(function (r) {
    return "- " + r.npc_name + ": " + (r.relationship_status || "neutral") + ", confianza: " + (r.trust_text || "desconocida") + ", deuda: " + (r.debt || "ninguna");
  }).join("\n");
}

function buildOrCreateCampaignSummary_(campaignId) {
  const summaries = getRowsByCampaign_("chapter_summaries", campaignId).sort(function (a, b) {
    return Number(a.chapter_number || 0) - Number(b.chapter_number || 0);
  });

  if (summaries.length) {
    const last = summaries[summaries.length - 1];
    return "Resumen de capítulo " + (last.chapter_number || "?") + ":\n" + (last.summary || "Sin contenido") + "\nHilos abiertos: " + (last.unresolved_threads || "ninguno");
  }

  const msgs = getRecentMessages_(campaignId, 20);
  const assistantMsgs = msgs.filter(function (m) { return m.role === "assistant"; }).map(function (m) { return m.content; });
  const shortSummary = assistantMsgs.slice(-3).join(" ").slice(0, 500) || "Inicio de campaña sin eventos suficientes.";

  appendRow_("chapter_summaries", {
    campaign_id: campaignId,
    chapter_number: "1",
    summary: shortSummary,
    unresolved_threads: "Pendiente definir próximos objetivos.",
    created_at: nowIso_()
  });

  return "Se creó un resumen inicial:\n" + shortSummary;
}

function buildImagePromptSummary_(campaignId, state) {
  const visuals = getRowsByCampaign_("visual_continuity", campaignId);
  const last = visuals.length ? visuals[visuals.length - 1] : null;

  if (last && last.last_prompt) {
    return "Prompt visual actual:\n" + last.last_prompt;
  }

  const fallback = "Ilustración anime cinematográfica de " + (state.location || "un barrio portuario") + ", región " + (state.region || "fronteriza") + ", estación " + (state.season || "variable") + ", protagonista con " + (state.ability || "habilidad elemental mixta") + ", atmósfera dinámica, luz dramática, detalle de vestuario y heridas visibles si existen.";
  return "Prompt visual sugerido:\n" + fallback;
}

function touchCampaign_(campaignId) {
  const c = getCampaignById_(campaignId);
  if (!c) {
    return;
  }
  c.updated_at = nowIso_();
  c.status = c.status || "active";
  upsertRow_("campaigns", ["campaign_id"], c);
}
