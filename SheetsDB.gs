const SUKO_SCHEMA = {
  campaigns: ["campaign_id", "player_name", "character_name", "created_at", "updated_at", "status"],
  messages: ["timestamp", "campaign_id", "role", "content", "summary_flag"],
  campaign_state: ["campaign_id", "location", "region", "season", "ability", "ability_limits", "fatigue", "current_pressure", "next_hook", "money", "updated_at"],
  characters: ["campaign_id", "character_name", "origin", "ability", "personality_notes", "visual_profile", "created_at"],
  npcs: ["campaign_id", "npc_name", "role", "location", "trust", "mood", "goal", "fear", "secret", "last_seen", "next_move", "notes"],
  relationships: ["campaign_id", "npc_name", "relationship_status", "trust_text", "debt", "promise", "hard_line", "last_change"],
  factions: ["campaign_id", "faction_name", "interest_level", "knowledge", "attitude", "next_move", "clock", "notes"],
  inventory: ["campaign_id", "item", "quantity", "condition", "notes"],
  injuries: ["campaign_id", "injury", "severity", "effect", "recovery_path", "active"],
  rumors: ["campaign_id", "rumor", "source", "reliability", "active"],
  locations: ["campaign_id", "location_name", "region", "known_routes", "danger_level", "notes"],
  chapter_summaries: ["campaign_id", "chapter_number", "summary", "unresolved_threads", "created_at"],
  visual_continuity: ["campaign_id", "subject", "visual_description", "clothing", "injuries", "mood", "last_prompt"],
  settings: ["key", "value"],
  logs: ["timestamp", "campaign_id", "level", "message", "raw"]
};

const DEFAULT_SETTINGS = {
  GEMINI_MODEL: "gemini-2.5-flash",
  MAX_CONTEXT_MESSAGES: "10",
  SUMMARY_TURN_INTERVAL: "10",
  APP_NAME: "SUKO RPG"
};

let SUKO_DB_ENSURING = false;

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("SUKO_SHEET_ID");
  if (sheetId) {
    return SpreadsheetApp.openById(sheetId);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("No hay hoja activa. Configura SUKO_SHEET_ID en Script Properties.");
  }
  return active;
}

function ensureDatabaseIntegrity_() {
  if (SUKO_DB_ENSURING) {
    return;
  }
  SUKO_DB_ENSURING = true;
  const ss = getSpreadsheet_();
  try {
    Object.keys(SUKO_SCHEMA).forEach(function (sheetName) {
      ensureSheetWithHeaders_(ss, sheetName, SUKO_SCHEMA[sheetName]);
    });
    ensureDefaultSettings_();
  } finally {
    SUKO_DB_ENSURING = false;
  }
}

function ensureSheetWithHeaders_(ss, sheetName, expectedHeaders) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const lastCol = sheet.getLastColumn();
  const currentHeaders = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
    : [];

  if (currentHeaders.length === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
    return;
  }

  const missing = expectedHeaders.filter(function (h) {
    return currentHeaders.indexOf(h) === -1;
  });

  if (missing.length > 0) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
  }
}

function ensureDefaultSettings_() {
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (!getSetting_(key)) {
      setSetting_(key, DEFAULT_SETTINGS[key]);
    }
  });
}

function getSheetMeta_(sheetName) {
  if (!SUKO_DB_ENSURING) {
    ensureDatabaseIntegrity_();
  }
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Hoja no encontrada: " + sheetName);
  }
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const headerMap = {};
  headers.forEach(function (h, idx) {
    headerMap[h] = idx;
  });
  return { sheet: sheet, headers: headers, headerMap: headerMap };
}

function getAllRows_(sheetName) {
  const meta = getSheetMeta_(sheetName);
  const sheet = meta.sheet;
  const headers = meta.headers;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row) {
    const obj = {};
    headers.forEach(function (h, idx) {
      obj[h] = row[idx];
    });
    return obj;
  });
}

function appendRow_(sheetName, rowObj) {
  const meta = getSheetMeta_(sheetName);
  const values = meta.headers.map(function (h) {
    return rowObj[h] !== undefined ? rowObj[h] : "";
  });
  meta.sheet.appendRow(values);
}

function upsertRow_(sheetName, keyFields, rowObj) {
  const meta = getSheetMeta_(sheetName);
  const rows = getAllRows_(sheetName);
  const matchIndex = rows.findIndex(function (r) {
    return keyFields.every(function (k) {
      return String(r[k]) === String(rowObj[k]);
    });
  });

  const values = meta.headers.map(function (h) {
    return rowObj[h] !== undefined ? rowObj[h] : "";
  });

  if (matchIndex === -1) {
    meta.sheet.appendRow(values);
    return;
  }

  const rowNumber = matchIndex + 2;
  meta.sheet.getRange(rowNumber, 1, 1, meta.headers.length).setValues([values]);
}

function deleteRowsByFilter_(sheetName, predicate) {
  const meta = getSheetMeta_(sheetName);
  const rows = getAllRows_(sheetName);
  const toDelete = [];
  rows.forEach(function (row, idx) {
    if (predicate(row)) {
      toDelete.push(idx + 2);
    }
  });
  toDelete.reverse().forEach(function (rowNum) {
    meta.sheet.deleteRow(rowNum);
  });
}

function getRowsByCampaign_(sheetName, campaignId) {
  return getAllRows_(sheetName).filter(function (r) {
    return String(r.campaign_id) === String(campaignId);
  });
}

function getCampaignById_(campaignId) {
  return getAllRows_("campaigns").find(function (c) {
    return String(c.campaign_id) === String(campaignId);
  }) || null;
}

function getCampaignState_(campaignId) {
  return getRowsByCampaign_("campaign_state", campaignId)[0] || null;
}

function getRecentMessages_(campaignId, limit) {
  const all = getRowsByCampaign_("messages", campaignId).sort(function (a, b) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  return all.slice(Math.max(0, all.length - limit));
}

function getSetting_(key) {
  const row = getAllRows_("settings").find(function (r) {
    return String(r.key) === String(key);
  });
  return row ? String(row.value) : "";
}

function setSetting_(key, value) {
  upsertRow_("settings", ["key"], { key: key, value: String(value) });
}

function logEvent_(campaignId, level, message, raw) {
  appendRow_("logs", {
    timestamp: new Date().toISOString(),
    campaign_id: campaignId || "",
    level: level || "INFO",
    message: message || "",
    raw: raw ? String(raw).slice(0, 45000) : ""
  });
}

function nowIso_() {
  return new Date().toISOString();
}

function sanitizeText_(text) {
  if (text === null || text === undefined) {
    return "";
  }
  return String(text)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeId_(id) {
  const clean = sanitizeText_(id);
  if (!/^cmp_[a-zA-Z0-9]{8,40}$/.test(clean)) {
    throw new Error("campaign_id inválido.");
  }
  return clean;
}

function toBool_(value) {
  return String(value).toLowerCase() === "true" || value === true || value === 1;
}
