import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── GOVERNANCE LAYER ──────────────────────────────────────────────────────────
// CADs (Constitutionally Authoritative Documents) and their enforcing sentinels
// live under /governance and are declared in governance/anchors.json. Each CAD is
// SHA-256 hashed and anchored to Bitcoin; the loader recomputes the hash at runtime
// and only treats a document as authoritative when it matches the published anchor.
//
// Adding a CAD requires NO code change: drop the .md files into governance/cads and
// governance/sentinels, then append an entry to anchors.json. NOTE: anchors.json is
// read from a static literal path so Vercel's file tracer bundles it; the per-CAD
// document paths are dynamic, so vercel.json pins "includeFiles": "governance/**".
const GOV_DIR    = join(__dir, '..', 'governance');
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const REFERER    = 'https://the-salon-ten.vercel.app';

// ── REGISTRY + DOCUMENT LOADERS ───────────────────────────────────────────────
function loadRegistry() {
  const path = join(GOV_DIR, 'anchors.json');
  if (!existsSync(path)) return { whitepaper: null, cads: [] };
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// Returns one result object per enabled CAD. `content`/`sentinelPrompt` are null
// when a referenced file is missing from the deployment; `verified` is true only
// when the recomputed SHA-256 matches the entry's expectedHash.
function loadGovernance(registry) {
  return (registry.cads ?? [])
    .filter(c => c.enabled)
    .map(c => {
      const cadPath      = join(GOV_DIR, c.cad);
      const sentinelPath = join(GOV_DIR, c.sentinel);
      const exists       = existsSync(cadPath);
      const content      = exists ? readFileSync(cadPath, 'utf-8') : null;
      const computedHash  = content !== null
        ? createHash('sha256').update(content).digest('hex')
        : null;
      return {
        id:               c.id,
        content,
        sentinelPrompt:   existsSync(sentinelPath) ? readFileSync(sentinelPath, 'utf-8') : null,
        verified:         computedHash === c.expectedHash,
        computedHash:     computedHash ? `0x${computedHash}` : null,
        displayHash:      c.displayHash,
        bitcoinTx:        c.bitcoinTx,
        merkleRoot:       c.merkleRoot,
        timestamp:        c.timestamp,
        chain:            c.chain,
        error:            exists ? null : 'CAD file not found in deployment'
      };
    });
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
      model:      'anthropic/claude-sonnet-4.5',
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

  // Load the registry and verify every enabled CAD against its published anchor
  const registry = loadRegistry();
  const cads      = loadGovernance(registry);

  // Per-CAD sentinel metadata. Each enabled CAD with a verified document and a
  // sentinel prompt gets its conversation assessed. Sentinels run sequentially —
  // one CAD today, so behaviour is identical to the previous single-CAD path.
  const governance = cads.map(c => ({
    id:                   c.id,
    ran:                  false,
    flagLevel:            0,
    interventionRequired: false,
    interventionText:     null,
    reasoning:            'not run',
    protocolVerified:     c.verified,
    protocolHash:         c.displayHash,
    computedHash:         c.computedHash,
    bitcoinTx:            c.bitcoinTx,
    merkleRoot:           c.merkleRoot,
    timestamp:            c.timestamp,
    chain:                c.chain,
    whitepaper:           registry.whitepaper,
    error:                c.error
  }));

  for (let i = 0; i < cads.length; i++) {
    const c = cads[i];
    if (!c.content || !c.sentinelPrompt) continue;
    try {
      const result = await runSentinel(
        messages,
        c.content,
        c.sentinelPrompt,
        process.env.OPENROUTER_API_KEY
      );
      governance[i].ran                  = true;
      governance[i].flagLevel            = result.flag_level            ?? 0;
      governance[i].interventionRequired = result.intervention_required ?? false;
      governance[i].interventionText     = result.intervention_text     ?? null;
      governance[i].reasoning            = result.reasoning             ?? '';
    } catch (err) {
      governance[i].error = err.message;
    }
  }

  // Intervention policy: the first CAD demanding intervention wins and overrides
  // the persona response. `_sentinel` exposes the active CAD (the intervening one,
  // else the first enabled CAD) in the exact shape the front-end already consumes.
  const sentinelMeta = governance.find(g => g.interventionRequired && g.interventionText)
    ?? governance[0]
    ?? { ran: false, flagLevel: 0, interventionRequired: false, interventionText: null,
         reasoning: 'no governance configured', protocolVerified: false, protocolHash: null,
         computedHash: null, bitcoinTx: null, merkleRoot: null, timestamp: null,
         chain: null, whitepaper: registry.whitepaper, error: 'no enabled CAD' };

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
        body: JSON.stringify({ model: 'anthropic/claude-sonnet-4.5', messages, ...(max_tokens && { max_tokens }) })
      });
      responseData = await personaRes.json();
    }

    responseData._sentinel   = sentinelMeta;   // active CAD — legacy/UI-compatible shape
    responseData._governance = governance;      // all enabled CADs (future multi-CAD panel)
    return res.status(200).json(responseData);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
