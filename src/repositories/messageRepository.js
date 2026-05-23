'use strict';

// In-memory deduplication store for inbound WhatsApp message IDs.
// Replace with a durable store (Redis, Postgres) before scaling beyond a single instance.

const SEEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10_000;

const seen = new Map();

function evictExpired(now) {
  for (const [id, ts] of seen) {
    if (now - ts > SEEN_TTL_MS) seen.delete(id);
  }
}

function hasSeen(messageId) {
  if (!messageId) return false;
  const ts = seen.get(messageId);
  if (!ts) return false;
  if (Date.now() - ts > SEEN_TTL_MS) {
    seen.delete(messageId);
    return false;
  }
  return true;
}

function markSeen(messageId) {
  if (!messageId) return;
  const now = Date.now();
  if (seen.size >= MAX_ENTRIES) evictExpired(now);
  if (seen.size >= MAX_ENTRIES) {
    const oldestKey = seen.keys().next().value;
    if (oldestKey) seen.delete(oldestKey);
  }
  seen.set(messageId, now);
}

function size() {
  return seen.size;
}

module.exports = { hasSeen, markSeen, size };
