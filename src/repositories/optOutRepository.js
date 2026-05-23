'use strict';

// In-memory opt-out registry. Swap for a durable store once persistence is needed.

const optedOut = new Map();

function normalize(userId) {
  return String(userId || '').trim().toLowerCase();
}

function isOptedOut(userId) {
  const key = normalize(userId);
  if (!key) return false;
  return optedOut.has(key);
}

function optOut(userId) {
  const key = normalize(userId);
  if (!key) return;
  optedOut.set(key, new Date().toISOString());
}

function optIn(userId) {
  const key = normalize(userId);
  if (!key) return;
  optedOut.delete(key);
}

function size() {
  return optedOut.size;
}

module.exports = { isOptedOut, optOut, optIn, size };
