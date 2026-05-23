'use strict';

const axios = require('axios');
const config = require('../config/env');
const logger = require('../config/logger');

const BOT_TIMEOUT_MS = 8_000;

function isEnabled() {
  return Boolean(config.botApiUrl);
}

// Forwards an inbound GrowthMonk customer message to the configured bot endpoint
// and returns its reply text, or null if the bot is disabled or fails.
async function getBotReply({ phone, text, messageId, phoneNumberId, wabaId }) {
  if (!isEnabled()) return null;

  const payload = {
    user_id: `whatsapp:${phone}`,
    channel: 'whatsapp',
    message: text,
    metadata: {
      message_id: messageId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId
    }
  };

  try {
    const res = await axios.post(config.botApiUrl, payload, {
      timeout: BOT_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' }
    });
    const reply = typeof res.data?.reply === 'string' ? res.data.reply.trim() : '';
    if (!reply) {
      logger.warn({ messageId }, 'Bot returned empty reply');
      return null;
    }
    return reply;
  } catch (err) {
    logger.warn(
      {
        messageId,
        status: err.response?.status,
        code: err.code,
        message: err.message
      },
      'Bot API request failed; falling back'
    );
    return null;
  }
}

module.exports = { isEnabled, getBotReply };
