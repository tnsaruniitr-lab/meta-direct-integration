'use strict';

const axios = require('axios');
const config = require('../config/env');
const logger = require('../config/logger');

const TELEGRAM_TIMEOUT_MS = 5_000;

function isEnabled() {
  return Boolean(config.telegramBotToken && config.telegramChatId);
}

async function sendTelegramAlert(text) {
  if (!isEnabled()) return false;
  if (!text || typeof text !== 'string') return false;

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  try {
    await axios.post(
      url,
      {
        chat_id: config.telegramChatId,
        text,
        disable_web_page_preview: true,
        parse_mode: 'HTML'
      },
      { timeout: TELEGRAM_TIMEOUT_MS }
    );
    return true;
  } catch (err) {
    logger.warn(
      {
        status: err.response?.status,
        code: err.code,
        message: err.message
      },
      'Telegram alert failed'
    );
    return false;
  }
}

module.exports = { isEnabled, sendTelegramAlert };
