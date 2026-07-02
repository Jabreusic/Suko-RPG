  } catch (err) {
    console.error('[/api/message ERROR]', err.message);
    if (err.stack) console.error('[STACK]', err.stack.slice(0, 200));
    await logEvent(req.body.campaignId || '', 'ERROR', 'handlePlayerMessage failed', err.message);
    res.status(500).json({
      ok: false,
      error: 'No pude procesar tu acción ahora.'
    });
  }
});
