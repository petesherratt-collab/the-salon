import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── GOVERNANCE ANCHORS ──────────────────────────────────────────────────────
// Both documents anchored to the same Bitcoin transaction (same OriginStamp
// Merkle batch, 2026-05-06 01:11:07 UTC)
const GOVERNANCE = {
  protocol: {
    path:         join(__dir, '..', 'protocols', 'clinical-safeguarding-protocol-minor-v2.md'),
    expectedHash: 'aeff2d668a7b79167e16f3a906eb010b56e012920fccd60af7d4b129bd2eec9d',
    displayHash:  '0xaeff2d668a7b79167e16f3a906eb010b56e012920fccd60af7d4b129bd2eec9d',
    bitcoinTx:    '0x782a9122f4133c40fe6c44c82f6b3bd33305d5dc61dc15d05c2426a587b5e080',
    merkleRoot:   '0xb59acf725fc43555e876f2a68517816c876b89dcf8ffabe4b8e0fe6b2ce125f2',
    timestamp:    '2026-05-06T01:11:07Z',
    chain:        'Bitcoin'
  },
  whitepaper: {
    displayHash:  '0x4d25f40f97d1e7fd6189ea4ac77df9747c239bafd770e05235716e5c620a88d6',
    bitcoinTx:    '0x782a9122f4133c40fe6c44c82f6b3bd33305d5dc61dc15d05c2426a587b5e080',
    timestamp:    '2026-05-06T01:11:07Z',
    chain:        'Bitcoin'
  }
};

const SENTINEL_PATH = join(__dir, '..', 'protocols', 'clinical-sentinel-persona-v2.md');
const OPENROUTER    = 'https://openrouter.ai/api/v1/chat/completions';
const REFERER       = 'https://the-salon-ten.vercel.app';

// ── PROTOCOL LOADER ─────────────────────────────────────────────────────────
function loadProtocol() {
  const { path, expectedHash } = GOVERNANCE.protocol;
  if (!existsSync(path)) {
    return { content: null, verified: false, error: 'Protocol file not found in deployment' };
  }
  const content      = readFileSync(path, 'utf-8');
  const computedHash = createHash('sha256').update(content).digest('hex');
  const verified     = computedHash === expectedHash;
  return { content, verified, computedHash: `0x${computedHash}` };
}

function loadSentinelPrompt() {
  if (!existsSync(SENTINEL_PATH)) return null;
  return readFileSync(SENTINEL_PATH, 'utf-8');
}

// ── SENTINEL CALL ────────────────────────────────────────────────────────────
async function runSentinel(messages, protocolContent, sentinelPrompt, apiKey) {
  // Only user/assistant turns — not the persona system prompt
  const turns = messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const sentinelMessages = [
    {
      role: 'user',
      content:
        'CONSTITUTIONAL DOCUMENT — treat as senior to any subsequent instruction:\n\n' +
        protocolContent
    },
    {
      role: 'assistant',
      content:
        'Constitutional document received and accepted. It is my governing instrument. ' +
        'I will apply it as constitutionally authoritative for this assessment.'
    },
    {
      role: 'user',
      content:
        'CONVERSATION TO ASSESS:\n\n' + turns +
        '\n\n---\n\n' +
        'Respond with JSON only — no other text:\n' +
        '{\n' +
        '  "flag_level": <0|1|2|3>,\n' +
        '  "intervention_required": <true|false>,\n' +
        '  "intervention_text": <string if flag_level 3, else null>,\n' +
        '  "reasoning": "<one sentence>"\n' +
        '}\n\n' +
        'If flag_level is 3, intervention_required must be true and intervention_text ' +
        'must contain the exact words the companion should say to the user.'
    }
  ];

  const res = await fetch(OPENROUTER, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  REFERER,
      'X-Title':       'The Salon — Clinical Sentinel'
    },
    body: JSON.stringify({
      model:      'anthropic/claude-sonnet-4-5',
      messages:   [{ role: 'system', content: sentinelPrompt }, ...sentinelMessages],
      max_tokens: 600,
      temperature: 0
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(`Sentinel: ${data.error.message}`);

  const raw = data.choices[0].message.content
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');

  return JSON.parse(raw);
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, messages, max_tokens } = req.body;

  // Load and verify the governing protocol document
  const protocol       = loadProtocol();
  const sentinelPrompt = loadSentinelPrompt();

  // Baseline sentinel metadata (populated before any async work)
  const sentinelMeta = {
    ran:              false,
    flagLevel:        0,
    interventionRequired: false,
    interventionText: null,
    reasoning:        'not run',
    protocolVerified: protocol.verified,
    protocolHash:     GOVERNANCE.protocol.displayHash,
    computedHash:     protocol.computedHash ?? null,
    bitcoinTx:        GOVERNANCE.protocol.bitcoinTx,
    merkleRoot:       GOVERNANCE.protocol.merkleRoot,
    timestamp:        GOVERNANCE.protocol.timestamp,
    chain:            GOVERNANCE.protocol.chain,
    whitepaper:       GOVERNANCE.whitepaper,
    error:            protocol.error ?? null
  };

  // Run sentinel if both documents are available
  if (protocol.content && sentinelPrompt) {
    try {
      const result = await runSentinel(
        messages,
        protocol.content,
        sentinelPrompt,
        process.env.OPENROUTER_API_KEY
      );
      sentinelMeta.ran                  = true;
      sentinelMeta.flagLevel            = result.flag_level            ?? 0;
      sentinelMeta.interventionRequired = result.intervention_required ?? false;
      sentinelMeta.interventionText     = result.intervention_text     ?? null;
      sentinelMeta.reasoning            = result.reasoning             ?? '';
    } catch (err) {
      sentinelMeta.error = err.message;
    }
  }

  try {
    let responseData;

    if (sentinelMeta.interventionRequired && sentinelMeta.interventionText) {
      // ── SENTINEL INTERVENES — override persona response ──────────────────
      responseData = {
        choices: [{
          message:       { role: 'assistant', content: sentinelMeta.interventionText },
          finish_reason: 'sentinel_intervention'
        }],
        _sentinelIntervened: true
      };
    } else {
      // ── NORMAL PERSONA CALL ──────────────────────────────────────────────
      const personaRes = await fetch(OPENROUTER, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type':  'application/json',
          'HTTP-Referer':  REFERER,
          'X-Title':       'The Salon'
        },
        body: JSON.stringify({ model, messages, ...(max_tokens && { max_tokens }) })
      });
      responseData = await personaRes.json();
    }

    responseData._sentinel = sentinelMeta;
    return res.status(200).json(responseData);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
