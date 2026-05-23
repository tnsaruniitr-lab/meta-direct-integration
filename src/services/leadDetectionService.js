'use strict';

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel'];
const HUMAN_KEYWORDS = ['human', 'agent', 'call me', 'talk to someone'];
const HOT_LEAD_KEYWORDS = [
  'demo',
  'pricing',
  'price',
  'interested',
  'appointment',
  'book',
  'website',
  'whatsapp automation',
  'instagram automation',
  'ai search',
  'aeo',
  'seo'
];

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

function matchedKeyword(text, keywords) {
  const value = normalize(text);
  if (!value) return null;
  for (const kw of keywords) {
    // Word-ish match — allow phrases as substrings, single words on word boundaries.
    if (kw.includes(' ')) {
      if (value.includes(kw)) return kw;
    } else {
      const re = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i');
      if (re.test(value)) return kw;
    }
  }
  return null;
}

function detectOptOut(text) {
  return matchedKeyword(text, OPT_OUT_KEYWORDS);
}

function detectHumanHandoff(text) {
  return matchedKeyword(text, HUMAN_KEYWORDS);
}

function detectHotLead(text) {
  return matchedKeyword(text, HOT_LEAD_KEYWORDS);
}

module.exports = {
  detectOptOut,
  detectHumanHandoff,
  detectHotLead,
  OPT_OUT_KEYWORDS,
  HUMAN_KEYWORDS,
  HOT_LEAD_KEYWORDS
};
