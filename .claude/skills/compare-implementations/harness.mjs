// Mechanical-criteria harness for /compare-implementations.
//
// Pattern: paste each candidate's pure function under a label, define the shared
// adversarial inputs (lifted from the spec/review), run all candidates against
// all inputs, print a per-candidate table. Execute the claim — never trust the
// candidate's own "// Fix #N" comment.
//
// Run:  node harness.mjs
//
// This file is seeded with the #9 ID-column check from the worked example so the
// shape is concrete. Replace `candidates` and `cases` for your own comparison.

// ── 1. The criterion being tested (one at a time keeps output readable) ──────
// "#9 — an ID-like column of integers must NOT be averaged, but a real numeric
//  measure (humidity, paid_amount, order_total) MUST be kept for stats."

// ── 2. Candidates: the relevant snippet from each, isolated and labelled ──────
const candidates = {
  // header -> true means "treated as an identifier, excluded from numeric stats"
  Claude: (h) => /(^|[_\s-])(id|zip|postal|postcode|phone|code|ssn|account|acct|number|no)([_\s-]|$)/i.test(h),
  Codex:  (h) => /(\bid\b|identifier|zip|postal|phone|code|sku|account|invoice|order)/i.test(h),
  Gemini: (h) => /id|zip|postal|phone|code/i.test(h),
};

// ── 3. Shared cases with the EXPECTED answer (the rubric, made executable) ────
// expected = should this header be excluded from numeric stats?
const cases = [
  ["customer_id",     true],
  ["zip",             true],
  ["postal_code",     true],
  ["humidity",        false], // measure — must keep stats
  ["paid_amount",     false], // money — must keep stats
  ["order_total",     false], // money — must keep stats
  ["invoice_amount",  false],
  ["video_views",     false],
  ["width",           false],
  ["candidate_count", false],
];

// ── 4. Run + score ───────────────────────────────────────────────────────────
const names = Object.keys(candidates);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("header", 16), "exp  ", names.map((n) => pad(n, 8)).join(""));

const score = Object.fromEntries(names.map((n) => [n, 0]));
for (const [header, expected] of cases) {
  const cells = names.map((n) => {
    const got = candidates[n](header);
    const ok = got === expected;
    if (ok) score[n]++;
    return pad(`${got}${ok ? "" : " ✗"}`, 8);
  });
  console.log(pad(header, 16), pad(expected, 5), cells.join(""));
}
console.log("\nscore (correct / " + cases.length + "):");
for (const n of names) console.log("  " + pad(n, 8), score[n]);
