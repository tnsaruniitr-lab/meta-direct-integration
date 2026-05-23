'use strict';

require('dotenv').config();

function required(name, value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value);
}

function optional(value, fallback = undefined) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  return String(value);
}

const NODE_ENV = optional(process.env.NODE_ENV, 'development');
const PORT = Number(optional(process.env.PORT, '3000'));
const LOG_LEVEL = optional(process.env.LOG_LEVEL, NODE_ENV === 'production' ? 'info' : 'debug');

const config = {
  nodeEnv: NODE_ENV,
  port: PORT,
  logLevel: LOG_LEVEL,

  verifyToken: required('VERIFY_TOKEN', process.env.VERIFY_TOKEN),
  whatsappToken: required('WHATSAPP_TOKEN', process.env.WHATSAPP_TOKEN),
  phoneNumberId: required('PHONE_NUMBER_ID', process.env.PHONE_NUMBER_ID),
  wabaId: required('WABA_ID', process.env.WABA_ID),
  metaAppSecret: optional(process.env.META_APP_SECRET),

  internalApiKey: required('INTERNAL_API_KEY', process.env.INTERNAL_API_KEY),

  botApiUrl: optional(process.env.BOT_API_URL),

  telegramBotToken: optional(process.env.TELEGRAM_BOT_TOKEN),
  telegramChatId: optional(process.env.TELEGRAM_CHAT_ID),

  graphApiVersion: 'v25.0',
  graphApiBase: 'https://graph.facebook.com',

  jsonBodyLimit: '256kb',

  version: require('../../package.json').version,
  serviceName: 'growthmonk-messaging-adapter'
};

if (Number.isNaN(config.port) || config.port <= 0) {
  throw new Error('PORT must be a positive integer');
}

module.exports = config;
