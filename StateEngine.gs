function applyStructuredChanges_(campaignId, response) {
  const id = sanitizeId_(campaignId);
  const now = nowIso_();

  applyStatePatch_(id, response.state_patch || {}, now);
  applyNpcChanges_(id, response.npc_changes || []);
  applyRelationshipChanges_(id, response.relationship_changes || []);
  applyFactionChanges_(id, response.faction_changes || []);
  applyInventoryChanges_(id, response.inventory_changes || []);
  applyInjuryChanges_(id, response.injury_changes || []);
  applyRumorsAdded_(id, response.rumors_added || []);
  applyLocationChanges_(id, response.location_changes || []);
  applyVisualUpdate_(id, response.visual_update || {});
  applyChapterSummary_(id, response.chapter_summary || {}, now);
}

function applyStatePatch_(campaignId, patch, now) {
  const existing = getCampaignState_(campaignId) || {
    campaign_id: campaignId,
    location: "",
    region: "",
    season: "",
    ability: "",
    ability_limits: "",
    fatigue: "",
    current_pressure: "",
    next_hook: "",
    money: "",
    updated_at: now
  };

  const merged = Object.assign({}, existing);
  Object.keys(existing).forEach(function (key) {
    if (key === "campaign_id") {
      return;
    }
    if (patch[key] !== undefined && patch[key] !== null && String(patch[key]).trim() !== "") {
      merged[key] = sanitizeText_(patch[key]);
    }
  });
  merged.campaign_id = campaignId;
  merged.updated_at = now;
  upsertRow_("campaign_state", ["campaign_id"], merged);
}

function hasMeaningfulValue_(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return true;
}

function mergeTextField_(incoming, existing) {
  if (!hasMeaningfulValue_(incoming)) {
    return sanitizeText_(existing || "");
  }
  return sanitizeText_(incoming);
}

function mergeBoolField_(incoming, existing) {
  if (!hasMeaningfulValue_(incoming)) {
    return toBool_(existing);
  }
  return toBool_(incoming);
}

function applyNpcChanges_(campaignId, changes) {
  changes.forEach(function (c) {
    const name = sanitizeText_(c.npc_name);
    if (!name) {
      return;
    }
    const existing = getRowsByCampaign_("npcs", campaignId).find(function (r) {
      return String(r.npc_name) === name;
    }) || { campaign_id: campaignId, npc_name: name };

    const merged = Object.assign({}, existing, {
      campaign_id: campaignId,
      npc_name: name,
      role: mergeTextField_(c.role, existing.role),
      location: mergeTextField_(c.location, existing.location),
      trust: mergeTextField_(c.trust, existing.trust),
      mood: mergeTextField_(c.mood, existing.mood),
      goal: mergeTextField_(c.goal, existing.goal),
      fear: mergeTextField_(c.fear, existing.fear),
      secret: mergeTextField_(c.secret, existing.secret),
      last_seen: mergeTextField_(c.last_seen, existing.last_seen),
      next_move: mergeTextField_(c.next_move, existing.next_move),
      notes: mergeTextField_(c.notes, existing.notes)
    });

    upsertRow_("npcs", ["campaign_id", "npc_name"], merged);
  });
}

function applyRelationshipChanges_(campaignId, changes) {
  changes.forEach(function (c) {
    const name = sanitizeText_(c.npc_name);
    if (!name) {
      return;
    }
    const existing = getRowsByCampaign_("relationships", campaignId).find(function (r) {
      return String(r.npc_name) === name;
    }) || { campaign_id: campaignId, npc_name: name };

    const row = {
      campaign_id: campaignId,
      npc_name: name,
      relationship_status: mergeTextField_(c.relationship_status, existing.relationship_status),
      trust_text: mergeTextField_(c.trust_text, existing.trust_text),
      debt: mergeTextField_(c.debt, existing.debt),
      promise: mergeTextField_(c.promise, existing.promise),
      hard_line: mergeTextField_(c.hard_line, existing.hard_line),
      last_change: mergeTextField_(c.last_change, existing.last_change) || nowIso_()
    };
    upsertRow_("relationships", ["campaign_id", "npc_name"], row);
  });
}

function applyFactionChanges_(campaignId, changes) {
  changes.forEach(function (c) {
    const name = sanitizeText_(c.faction_name);
    if (!name) {
      return;
    }
    const existing = getRowsByCampaign_("factions", campaignId).find(function (r) {
      return String(r.faction_name) === name;
    }) || { campaign_id: campaignId, faction_name: name };

    upsertRow_("factions", ["campaign_id", "faction_name"], {
      campaign_id: campaignId,
      faction_name: name,
      interest_level: mergeTextField_(c.interest_level, existing.interest_level),
      knowledge: mergeTextField_(c.knowledge, existing.knowledge),
      attitude: mergeTextField_(c.attitude, existing.attitude),
      next_move: mergeTextField_(c.next_move, existing.next_move),
      clock: mergeTextField_(c.clock, existing.clock),
      notes: mergeTextField_(c.notes, existing.notes)
    });
  });
}

function applyInventoryChanges_(campaignId, changes) {
  changes.forEach(function (c) {
    const item = sanitizeText_(c.item);
    if (!item) {
      return;
    }
    const current = getRowsByCampaign_("inventory", campaignId).find(function (r) {
      return String(r.item) === item;
    });

    const currentQty = current ? Number(current.quantity || 0) : 0;
    const delta = Number(c.quantity_delta || 0);
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      deleteRowsByFilter_("inventory", function (r) {
        return String(r.campaign_id) === campaignId && String(r.item) === item;
      });
      return;
    }

    upsertRow_("inventory", ["campaign_id", "item"], {
      campaign_id: campaignId,
      item: item,
      quantity: nextQty,
      condition: mergeTextField_(c.condition, current ? current.condition : ""),
      notes: mergeTextField_(c.notes, current ? current.notes : "")
    });
  });
}

function applyInjuryChanges_(campaignId, changes) {
  changes.forEach(function (c) {
    const injury = sanitizeText_(c.injury);
    if (!injury) {
      return;
    }
    const existing = getRowsByCampaign_("injuries", campaignId).find(function (r) {
      return String(r.injury) === injury;
    }) || { campaign_id: campaignId, injury: injury };

    upsertRow_("injuries", ["campaign_id", "injury"], {
      campaign_id: campaignId,
      injury: injury,
      severity: mergeTextField_(c.severity, existing.severity),
      effect: mergeTextField_(c.effect, existing.effect),
      recovery_path: mergeTextField_(c.recovery_path, existing.recovery_path),
      active: mergeBoolField_(c.active, existing.active)
    });
  });
}

function applyRumorsAdded_(campaignId, rumors) {
  rumors.forEach(function (r) {
    const rumor = sanitizeText_(r.rumor);
    if (!rumor) {
      return;
    }
    const existing = getRowsByCampaign_("rumors", campaignId).find(function (row) {
      return String(row.rumor) === rumor;
    }) || { campaign_id: campaignId, rumor: rumor };

    upsertRow_("rumors", ["campaign_id", "rumor"], {
      campaign_id: campaignId,
      rumor: rumor,
      source: mergeTextField_(r.source, existing.source),
      reliability: mergeTextField_(r.reliability, existing.reliability),
      active: mergeBoolField_(r.active, existing.active)
    });
  });
}

function applyLocationChanges_(campaignId, changes) {
  changes.forEach(function (c) {
    const locationName = sanitizeText_(c.location_name);
    if (!locationName) {
      return;
    }
    const existing = getRowsByCampaign_("locations", campaignId).find(function (r) {
      return String(r.location_name) === locationName;
    }) || { campaign_id: campaignId, location_name: locationName };

    upsertRow_("locations", ["campaign_id", "location_name"], {
      campaign_id: campaignId,
      location_name: locationName,
      region: mergeTextField_(c.region, existing.region),
      known_routes: mergeTextField_(c.known_routes, existing.known_routes),
      danger_level: mergeTextField_(c.danger_level, existing.danger_level),
      notes: mergeTextField_(c.notes, existing.notes)
    });
  });
}

function applyVisualUpdate_(campaignId, visual) {
  if (!visual || (!visual.subject && !visual.visual_prompt && !visual.visual_description)) {
    return;
  }
  const subject = sanitizeText_(visual.subject) || "escena_actual";
  const existing = getRowsByCampaign_("visual_continuity", campaignId).find(function (v) {
    return String(v.subject) === subject;
  }) || { campaign_id: campaignId, subject: subject };

  upsertRow_("visual_continuity", ["campaign_id", "subject"], {
    campaign_id: campaignId,
    subject: subject,
    visual_description: mergeTextField_(visual.visual_description, existing.visual_description),
    clothing: mergeTextField_(visual.clothing, existing.clothing),
    injuries: mergeTextField_(visual.injuries, existing.injuries),
    mood: mergeTextField_(visual.mood, existing.mood),
    last_prompt: mergeTextField_(visual.visual_prompt, existing.last_prompt)
  });
}

function applyChapterSummary_(campaignId, chapterSummary, now) {
  if (!chapterSummary || !toBool_(chapterSummary.should_create)) {
    return;
  }
  const chapterNumber = sanitizeText_(chapterSummary.chapter_number) || String(getRowsByCampaign_("chapter_summaries", campaignId).length + 1);
  upsertRow_("chapter_summaries", ["campaign_id", "chapter_number"], {
    campaign_id: campaignId,
    chapter_number: chapterNumber,
    summary: sanitizeText_(chapterSummary.summary),
    unresolved_threads: sanitizeText_(chapterSummary.unresolved_threads),
    created_at: now
  });
}

function ensureCampaignHasOpeningScene_(campaignId) {
  const id = sanitizeId_(campaignId);
  const msgs = getRowsByCampaign_("messages", id);
  if (msgs.length > 0) {
    return;
  }

  const campaign = getCampaignById_(id);
  if (!campaign) {
    throw new Error("Campaña no encontrada para escena inicial.");
  }

  const opening = generateOpeningScene_(campaign);

  upsertRow_("campaign_state", ["campaign_id"], {
    campaign_id: id,
    location: opening.state.location,
    region: opening.state.region,
    season: opening.state.season,
    ability: opening.state.ability,
    ability_limits: opening.state.ability_limits,
    fatigue: opening.state.fatigue,
    current_pressure: opening.state.current_pressure,
    next_hook: opening.state.next_hook,
    money: opening.state.money,
    updated_at: nowIso_()
  });

  appendRow_("messages", {
    timestamp: nowIso_(),
    campaign_id: id,
    role: "assistant",
    content: opening.narration,
    summary_flag: false
  });

  upsertRow_("locations", ["campaign_id", "location_name"], {
    campaign_id: id,
    location_name: opening.state.location,
    region: opening.state.region,
    known_routes: opening.route,
    danger_level: "moderado",
    notes: "Escena de inicio"
  });
}

function generateOpeningScene_(campaign) {
  const seeds = ["Brumas de Ceniza", "Delta Loto", "Paso de Yuma", "Borde de Kiri"];
  const regions = ["Archipiélago Sur", "Tierras Rojas", "Cinturón del Río", "Costa de Jade"];
  const seasons = ["monzón temprano", "invierno seco", "otoño de tormentas", "primavera ventosa"];
  const abilities = ["doble filo de aire y agua", "fuego controlado de corto alcance", "tierra vibrante en pulsos", "corrientes de vapor y niebla"];

  const idx = hashToIndex_(campaign.campaign_id, seeds.length);
  const location = seeds[idx];
  const region = regions[(idx + 1) % regions.length];
  const season = seasons[(idx + 2) % seasons.length];
  const ability = abilities[(idx + 3) % abilities.length];
  const playerName = sanitizeText_(campaign.character_name) || "viajero";

  const narration = [
    "El puente colgante de " + location + " cruje bajo tus botas mientras corres cuesta abajo con un paquete lacrado contra el pecho.",
    "A tu izquierda, una carreta volcada deja escapar sacos de arroz; a tu derecha, un canal de agua baja turbio por la lluvia reciente.",
    "No te persigue un ejército, pero sí tres cobradores locales que quieren recuperar el paquete antes del anochecer.",
    playerName + ", notas que cada ráfaga de viento te empuja hacia los tablones sueltos, y usar tu " + ability + " aquí podría salvar a una familia atrapada bajo la carreta o revelar que llevas algo valioso.",
    "Un niño te grita desde el borde del canal señalando una ruta corta entre patios de tintoreros, mientras una anciana herida te suplica ayuda para sacar a su nieta.",
    "El cielo truena una sola vez; tienes segundos para elegir cómo moverte sin romper del todo la frágil calma del barrio."
  ].join(" ");

  return {
    narration: narration,
    route: "Puente viejo -> patios de tintoreros -> mercado cubierto",
    state: {
      location: location,
      region: region,
      season: season,
      ability: ability,
      ability_limits: "Precisión inestable cuando hay civiles cerca.",
      fatigue: "leve",
      current_pressure: "cobradores locales y caos en el puente",
      next_hook: "decidir entre proteger civiles o asegurar el paquete",
      money: "12"
    }
  };
}

function hashToIndex_(text, mod) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash) % mod;
}
