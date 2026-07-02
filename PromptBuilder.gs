function buildPrompt(payload) {
  const rules = [
    "Eres SUKO RPG, narrador diegético en un mundo elemental inspirado en cuatro naciones.",
    "Responde SOLO JSON válido y sin markdown.",
    "Longitud narrativa: normal 120-220 palabras; escena importante hasta 350; clímax/combate mayor hasta 500.",
    "No des opciones A/B/C ni menús.",
    "No mostrar estadísticas como videojuego.",
    "Evita info-dumps de lore.",
    "No conviertas cada escena en persecución, guardias o peligro constante.",
    "Tras 1-2 escenas tensas, da respiro: comida, viaje, entrenamiento, humor, cultura, relación, misterio o recuperación.",
    "Recuerda heridas, deudas, rumores, promesas, facciones y consecuencias.",
    "No hay plot armor, pero evita castigo constante.",
    "NPCs con deseos, miedos, secretos y límites propios.",
    "Las facciones avanzan aunque el jugador no esté presente.",
    "Termina con situación abierta, no con menú."
  ].join("\n- ");

  const schema = {
    narration: "string",
    state_patch: {
      location: "string",
      region: "string",
      season: "string",
      ability: "string",
      ability_limits: "string",
      fatigue: "string",
      current_pressure: "string",
      next_hook: "string",
      money: "string"
    },
    npc_changes: [{ npc_name: "", role: "", location: "", trust: "", mood: "", goal: "", fear: "", secret: "", last_seen: "", next_move: "", notes: "" }],
    relationship_changes: [{ npc_name: "", relationship_status: "", trust_text: "", debt: "", promise: "", hard_line: "", last_change: "" }],
    faction_changes: [{ faction_name: "", interest_level: "", knowledge: "", attitude: "", next_move: "", clock: "", notes: "" }],
    inventory_changes: [{ item: "", quantity_delta: 0, condition: "", notes: "" }],
    injury_changes: [{ injury: "", severity: "", effect: "", recovery_path: "", active: true }],
    rumors_added: [{ rumor: "", source: "", reliability: "", active: true }],
    location_changes: [{ location_name: "", region: "", known_routes: "", danger_level: "", notes: "" }],
    visual_update: { should_generate_image: false, subject: "", visual_prompt: "", visual_description: "", clothing: "", injuries: "", mood: "" },
    chapter_summary: { should_create: false, chapter_number: "", summary: "", unresolved_threads: "" },
    debug_notes: "string"
  };

  const compactPayload = {
    campaign: payload.campaign,
    state: payload.state,
    recent_messages: payload.recentMessages,
    npcs: payload.npcs,
    relationships: payload.relationships,
    factions: payload.factions,
    inventory: payload.inventory,
    injuries: payload.injuries,
    rumors: payload.rumors,
    locations: payload.locations,
    player_action: payload.userMessage
  };

  return [
    "SUKO RPG SYSTEM RULES:",
    "- " + rules,
    "",
    "OUTPUT_JSON_SCHEMA:",
    JSON.stringify(schema),
    "",
    "GAME_CONTEXT_JSON:",
    JSON.stringify(compactPayload),
    "",
    "Devuelve SOLO JSON válido acorde al schema."
  ].join("\n");
}
