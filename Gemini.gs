function callGemini(promptText) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en Script Properties.");
  }

  const model = getSetting_("GEMINI_MODEL") || "gemini-2.5-flash";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: promptText }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error("Gemini HTTP " + status + ": " + body.slice(0, 1200));
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error("Respuesta no JSON de Gemini API: " + body.slice(0, 1200));
  }

  const text = extractGeminiText_(parsed);
  if (!text) {
    throw new Error("Gemini devolvió respuesta vacía.");
  }

  return parseGeminiStructuredResponse_(text);
}

function extractGeminiText_(geminiResponse) {
  if (!geminiResponse || !geminiResponse.candidates || !geminiResponse.candidates.length) {
    return "";
  }
  const candidate = geminiResponse.candidates[0];
  if (!candidate.content || !candidate.content.parts || !candidate.content.parts.length) {
    return "";
  }
  const textPart = candidate.content.parts.find(function (p) {
    return typeof p.text === "string";
  });
  return textPart ? textPart.text : "";
}

function parseGeminiStructuredResponse_(rawText) {
  const fallback = defaultGeminiResponse_();
  try {
    const clean = rawText.trim();
    const parsed = JSON.parse(clean);
    return normalizeGeminiResponse_(parsed);
  } catch (err1) {
    try {
      const extracted = extractJsonBlock_(rawText);
      const parsed2 = JSON.parse(extracted);
      return normalizeGeminiResponse_(parsed2);
    } catch (err2) {
      logEvent_("", "ERROR", "JSON inválido de Gemini", rawText);
      fallback.narration = "Un viento extraño cruza la escena y el recuerdo se vuelve borroso. Respira hondo y vuelve a intentar tu acción.";
      fallback.debug_notes = "Fallback por JSON inválido.";
      return fallback;
    }
  }
}

function extractJsonBlock_(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No se encontró bloque JSON.");
  }
  return text.substring(first, last + 1);
}

function defaultGeminiResponse_() {
  return {
    narration: "La escena queda suspendida un instante, como si el destino tomara aire antes del siguiente paso.",
    state_patch: {
      location: "",
      region: "",
      season: "",
      ability: "",
      ability_limits: "",
      fatigue: "",
      current_pressure: "",
      next_hook: "",
      money: ""
    },
    npc_changes: [],
    relationship_changes: [],
    faction_changes: [],
    inventory_changes: [],
    injury_changes: [],
    rumors_added: [],
    location_changes: [],
    visual_update: {
      should_generate_image: false,
      subject: "",
      visual_prompt: "",
      visual_description: "",
      clothing: "",
      injuries: "",
      mood: ""
    },
    chapter_summary: {
      should_create: false,
      chapter_number: "",
      summary: "",
      unresolved_threads: ""
    },
    debug_notes: ""
  };
}

function normalizeGeminiResponse_(obj) {
  const base = defaultGeminiResponse_();
  const merged = Object.assign({}, base, obj || {});

  merged.narration = sanitizeText_(merged.narration || base.narration);
  merged.state_patch = Object.assign({}, base.state_patch, merged.state_patch || {});
  merged.visual_update = Object.assign({}, base.visual_update, merged.visual_update || {});
  merged.chapter_summary = Object.assign({}, base.chapter_summary, merged.chapter_summary || {});

  merged.npc_changes = Array.isArray(merged.npc_changes) ? merged.npc_changes : [];
  merged.relationship_changes = Array.isArray(merged.relationship_changes) ? merged.relationship_changes : [];
  merged.faction_changes = Array.isArray(merged.faction_changes) ? merged.faction_changes : [];
  merged.inventory_changes = Array.isArray(merged.inventory_changes) ? merged.inventory_changes : [];
  merged.injury_changes = Array.isArray(merged.injury_changes) ? merged.injury_changes : [];
  merged.rumors_added = Array.isArray(merged.rumors_added) ? merged.rumors_added : [];
  merged.location_changes = Array.isArray(merged.location_changes) ? merged.location_changes : [];

  return merged;
}
