'use strict';

const express = require('express');
const config = require('../config/env');
const logger = require('../config/logger');
const whatsappService = require('../services/whatsappService');

const router = express.Router();

router.post('/send-test', async (req, res, next) => {
  const apiKey = req.get('x-api-key');
  if (!apiKey || apiKey !== config.internalApiKey) {
    logger.warn('Rejecting /send-test: missing or invalid x-api-key');
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const { to, body } = req.body || {};
  if (typeof to !== 'string' || typeof body !== 'string' || !to.trim() || !body.trim()) {
    res.status(400).json({ error: 'invalid_payload', message: '"to" and "body" are required strings' });
    return;
  }
  if (body.length > 4096) {
    res.status(400).json({ error: 'invalid_payload', message: 'body must be 4096 characters or fewer' });
    return;
  }

  try {
    const result = await whatsappService.sendWhatsAppText({ to: to.trim(), body });
    res.json({
      ok: true,
      outbound_message_id: result.outboundId || null,
      provider_status: result.status
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
