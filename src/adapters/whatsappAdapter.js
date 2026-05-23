'use strict';

const config = require('../config/env');
const logger = require('../config/logger');
const messageRepository = require('../repositories/messageRepository');
const optOutRepository = require('../repositories/optOutRepository');
const leadDetection = require('../services/leadDetectionService');
const botService = require('../services/botService');
const telegramService = require('../services/telegramService');
const whatsappService = require('../services/whatsappService');

const FALLBACK_REPLY =
  'Thanks for your message. A GrowthMonk team member will get back to you shortly.';
const OPT_OUT_REPLY =
  "You've been opted out of GrowthMonk messages. Reply START at any time to resume.";
const HANDOFF_REPLY =
  "Thanks — a GrowthMonk team member will reach out to you shortly.";

// Convert a WhatsApp Cloud API webhook payload into a flat list of normalized
// internal messages. Status-only events are ignored.
function parseInboundEvents(body) {
  const events = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'messages') continue;
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      const wabaId = entry.id;

      if (Array.isArray(value.statuses) && value.statuses.length && !Array.isArray(value.messages)) {
        events.push({ type: 'status', count: value.statuses.length, phoneNumberId, wabaId });
        continue;
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;

        const messageId = msg.id;
        const from = msg.from;
        const timestamp = msg.timestamp;
        const type = msg.type;

        if (type !== 'text') {
          events.push({
            type: 'unsupported',
            messageType: type,
            messageId,
            from,
            phoneNumberId,
            wabaId
          });
          continue;
        }

        const text = msg.text?.body || '';

        events.push({
          type: 'message',
          normalized: {
            channel: 'whatsapp',
            external_user_id: from,
            conversation_id: `whatsapp:${from}`,
            message_id: messageId,
            message_text: text,
            message_type: 'text',
            timestamp: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : new Date().toISOString(),
            raw_payload: msg
          },
          phoneNumberId,
          wabaId
        });
      }
    }
  }

  return events;
}

async function trySend(to, body, context) {
  try {
    await whatsappService.sendWhatsAppText({ to, body });
  } catch (err) {
    logger.error(
      { ...context, err: { message: err.message, status: err.status, cause: err.cause } },
      'Failed to send WhatsApp reply'
    );
  }
}

async function handleNormalizedMessage(normalized, ctx) {
  const { external_user_id: from, message_id: messageId, message_text: text } = normalized;
  const { phoneNumberId, wabaId } = ctx;

  if (messageRepository.hasSeen(messageId)) {
    logger.info({ messageId, from }, 'Duplicate inbound message ignored');
    return;
  }
  messageRepository.markSeen(messageId);

  const safeMeta = {
    channel: 'whatsapp',
    from,
    messageId,
    phoneNumberId,
    wabaId,
    textLength: text.length
  };
  logger.info(safeMeta, 'Inbound WhatsApp message received');

  // Opt-out detection always wins.
  const optOutHit = leadDetection.detectOptOut(text);
  if (optOutHit) {
    optOutRepository.optOut(from);
    logger.info({ from, messageId, keyword: optOutHit }, 'Opt-out keyword detected');
    await trySend(from, OPT_OUT_REPLY, { from, messageId, kind: 'opt_out_ack' });
    return;
  }

  // If the user previously opted out, suppress non-essential replies.
  if (optOutRepository.isOptedOut(from)) {
    logger.info({ from, messageId }, 'Message from opted-out user suppressed');
    return;
  }

  // Human handoff.
  const handoffHit = leadDetection.detectHumanHandoff(text);
  if (handoffHit) {
    logger.info({ from, messageId, keyword: handoffHit }, 'Human handoff requested');
    if (telegramService.isEnabled()) {
      const ok = await telegramService.sendTelegramAlert(
        `<b>Human handoff requested</b>\nFrom: <code>${from}</code>\nMessage: ${escapeHtml(text).slice(0, 500)}`
      );
      if (!ok) logger.warn({ from, messageId }, 'Telegram handoff alert failed');
    }
    await trySend(from, HANDOFF_REPLY, { from, messageId, kind: 'handoff_ack' });
    return;
  }

  // Hot lead detection — fires alongside the normal reply.
  const hotLeadHit = leadDetection.detectHotLead(text);
  if (hotLeadHit) {
    logger.info({ from, messageId, keyword: hotLeadHit }, 'Hot lead detected');
    if (telegramService.isEnabled()) {
      const ok = await telegramService.sendTelegramAlert(
        `<b>Hot lead</b> (<code>${hotLeadHit}</code>)\nFrom: <code>${from}</code>\nMessage: ${escapeHtml(text).slice(0, 500)}`
      );
      if (!ok) logger.warn({ from, messageId }, 'Telegram hot-lead alert failed');
    }
  }

  // Compose reply: bot if configured, otherwise fallback.
  let reply = null;
  if (botService.isEnabled()) {
    reply = await botService.getBotReply({
      phone: from,
      text,
      messageId,
      phoneNumberId,
      wabaId
    });
  }
  if (!reply) reply = FALLBACK_REPLY;

  await trySend(from, reply, { from, messageId, kind: 'auto_reply' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Public: process a parsed webhook body asynchronously after we've already 200'd Meta.
async function processWebhookBody(body) {
  const events = parseInboundEvents(body);
  for (const event of events) {
    try {
      if (event.type === 'status') {
        logger.debug({ count: event.count }, 'Ignoring WhatsApp status-only event');
        continue;
      }
      if (event.type === 'unsupported') {
        logger.info(
          { messageType: event.messageType, messageId: event.messageId, from: event.from },
          'Ignoring unsupported WhatsApp message type'
        );
        continue;
      }
      await handleNormalizedMessage(event.normalized, {
        phoneNumberId: event.phoneNumberId,
        wabaId: event.wabaId
      });
    } catch (err) {
      logger.error({ err }, 'Failed processing inbound WhatsApp event');
    }
  }
}

module.exports = {
  channel: 'whatsapp',
  config: { phoneNumberId: config.phoneNumberId, wabaId: config.wabaId },
  parseInboundEvents,
  processWebhookBody,
  FALLBACK_REPLY
};
