'use strict';

const express = require('express');
const config = require('../config/env');
const logger = require('../config/logger');
const signatureService = require('../services/signatureService');
const whatsappAdapter = require('../adapters/whatsappAdapter');

const router = express.Router();

// Meta webhook verification handshake.
router.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && typeof token === 'string' && token === config.verifyToken) {
    logger.info({ mode }, 'WhatsApp webhook verification succeeded');
    res.status(200).send(typeof challenge === 'string' ? challenge : '');
    return;
  }

  logger.warn({ mode, hasToken: Boolean(token) }, 'WhatsApp webhook verification failed');
  res.status(403).send('Forbidden');
});

// Inbound webhook from Meta.
router.post('/webhooks/whatsapp', (req, res) => {
  // Signature check is a no-op when META_APP_SECRET isn't configured.
  if (!signatureService.verifyMetaSignature(req)) {
    logger.warn('Rejecting webhook: invalid X-Hub-Signature-256');
    res.status(401).send('Invalid signature');
    return;
  }

  // Acknowledge Meta immediately — they retry aggressively on slow responses.
  res.status(200).send('EVENT_RECEIVED');

  // Process asynchronously. setImmediate keeps this off the response cycle.
  setImmediate(() => {
    whatsappAdapter.processWebhookBody(req.body).catch((err) => {
      logger.error({ err }, 'Unhandled error processing WhatsApp webhook body');
    });
  });
});

module.exports = router;
