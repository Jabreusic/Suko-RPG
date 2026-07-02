function setupDatabase() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureDatabaseIntegrity_();
    ensureDemoCampaign_();
    return {
      ok: true,
      message: "Base de datos SUKO lista.",
      spreadsheetId: getSpreadsheet_().getId()
    };
  } catch (err) {
    logEvent_("", "ERROR", "setupDatabase failed", err.stack || err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function ensureDemoCampaign_() {
  const existing = getAllRows_("campaigns").find(function (c) {
    return String(c.player_name).toLowerCase() === "demo";
  });
  if (existing) {
    return existing.campaign_id;
  }

  const demoId = createCampaignCore_("Demo", "Suko").campaign_id;
  return demoId;
}

function clearCampaignData(campaignId) {
  const id = sanitizeId_(campaignId);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    [
      "messages",
      "campaign_state",
      "characters",
      "npcs",
      "relationships",
      "factions",
      "inventory",
      "injuries",
      "rumors",
      "locations",
      "chapter_summaries",
      "visual_continuity"
    ].forEach(function (sheetName) {
      deleteRowsByFilter_(sheetName, function (r) {
        return String(r.campaign_id) === id;
      });
    });

    const campaign = getCampaignById_(id);
    if (campaign) {
      campaign.updated_at = nowIso_();
      campaign.status = "reset";
      upsertRow_("campaigns", ["campaign_id"], campaign);
    }
    ensureCampaignHasOpeningScene_(id);
    return { ok: true, message: "Campaña reiniciada." };
  } finally {
    lock.releaseLock();
  }
}

function exportCampaignBackup(campaignId) {
  const id = sanitizeId_(campaignId);
  const data = {
    campaign: getCampaignById_(id),
    state: getCampaignState_(id),
    messages: getRowsByCampaign_("messages", id),
    characters: getRowsByCampaign_("characters", id),
    npcs: getRowsByCampaign_("npcs", id),
    relationships: getRowsByCampaign_("relationships", id),
    factions: getRowsByCampaign_("factions", id),
    inventory: getRowsByCampaign_("inventory", id),
    injuries: getRowsByCampaign_("injuries", id),
    rumors: getRowsByCampaign_("rumors", id),
    locations: getRowsByCampaign_("locations", id),
    chapter_summaries: getRowsByCampaign_("chapter_summaries", id),
    visual_continuity: getRowsByCampaign_("visual_continuity", id)
  };
  return JSON.stringify(data, null, 2);
}
