'use strict';

const axios = require('axios');
const config = require('../config/env');
const logger = require('../config/logger');

const SEND_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

const client = axios.create({
  baseURL: `${config.graphApiBase}/${config.graphApiVersion}`,
  timeout: SEND_TIMEOUT_MS
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRecipient(to) {
  return String(to || '').replace(/[^\d]/g, '');
}

async function sendWhatsAppText({ to, body }) {
  const recipient = normalizeRecipient(to);
  if (!recipient) throw Object.assign(new Error('Recipient is required'), { status: 400, publicMessage: 'Recipient is required' });
  if (!body || typeof body !== 'string') throw Object.assign(new Error('Message body is required'), { status: 400, publicMessage: 'Message body is required' });

  const url = `/${encodeURIComponent(config.phoneNumberId)}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: { preview_url: false, body }
  };

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const res = await client.post(url, payload, {
        headers: {
          Authorization: `Bearer ${config.whatsappToken}`,
          'Content-Type': 'application/json'
        }
      });
      const messages = Array.isArray(res.data?.messages) ? res.data.messages : [];
      const outboundId = messages[0]?.id;
      logger.info(
        { to: recipient, outboundId, attempt },
        'WhatsApp outbound message sent'
      );
      return { ok: true, outboundId, status: res.status };
    } catch (err) {
      const status = err.response?.status;
      const errorBody = err.response?.data;
      const isTransient = !status || (status >= 500 && status < 600);

      logger.warn(
        {
          to: recipient,
          attempt,
          status,
          code: err.code,
          metaError: errorBody?.error
        },
        'WhatsApp send attempt failed'
      );

      if (!isTransient || attempt > MAX_RETRIES) {
        const e = new Error('WhatsApp send failed');
        e.status = status || 502;
        e.publicMessage = 'Failed to send message';
        e.cause = errorBody?.error || err.message;
        throw e;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

module.exports = { sendWhatsAppText };
