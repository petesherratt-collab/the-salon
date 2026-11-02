# Governance layer

This directory holds The Salon's **CADs** (Constitutionally Authoritative Documents)
and the **sentinel** personas that enforce them. A CAD is a governing instrument that
the runtime treats as senior to any persona, user, or upstream instruction. Each CAD is
SHA-256 hashed and anchored to Bitcoin; [`api/chat.js`](../api/chat.js) recomputes the
hash on every request and only treats a document as authoritative when it matches the
published anchor.

```
governance/
├── cads/          one .md per CAD (the governing documents)
├── sentinels/     one .md per CAD (the enforcing persona prompt)
├── anchors.json   the registry — single source of truth
└── README.md      this file
```

## `anchors.json` schema

```jsonc
{
  "schemaVersion": 1,
  "whitepaper": { "displayHash", "bitcoinTx", "timestamp", "chain" },
  "cads": [
    {
      "id":           "stable-kebab-case-id",
      "enabled":      true,
      "cad":          "cads/<file>.md",        // path relative to governance/
      "sentinel":     "sentinels/<file>.md",   // path relative to governance/
      "expectedHash": "<64-hex SHA-256, no 0x>",
      "displayHash":  "0x<same hash>",          // shown in the governance panel
      "bitcoinTx":    "0x...",
      "merkleRoot":   "0x...",
      "timestamp":    "ISO-8601",
      "chain":        "Bitcoin"
    }
  ]
}
```

## Adding a CAD — no code change

1. Generate the CAD + its Human Governance Layer with the **`cad-extractor`** skill.
2. Drop the CAD `.md` into `cads/` and its sentinel persona `.md` into `sentinels/`.
3. Compute the SHA-256 over the **LF** bytes and anchor it (OriginStamp/OpenTimestamps).
4. Append an entry to `anchors.json` with the resulting hashes and anchor metadata.

`api/chat.js` loads every `enabled` entry, verifies its hash, and runs its sentinel.
The first CAD demanding intervention overrides the response.

## ⚠️ Line endings (do not skip)

The published hash is computed over **LF** bytes. `core.autocrlf=true` would otherwise
rewrite these files to CRLF on checkout and break verification, so `.gitattributes` pins
`governance/**` to `eol=lf`. Keep CAD/sentinel files LF-only and never edit a CAD's bytes
without re-anchoring — any byte change (including line endings) invalidates the hash.
