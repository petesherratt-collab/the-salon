// Self-contained test suite for data-pipeline.jsx's pure functions.
// Run with: node data-pipeline.test.mjs  (no dependencies; extracts the
// functions from the JSX at runtime, so it always tests the shipped code).
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "data-pipeline.jsx"), "utf8");
const cut = src.indexOf("export default function App");
if (cut === -1) throw new Error("could not find App boundary in data-pipeline.jsx");
const fns = src.slice(0, cut).replace(/^import .*$/m, "") +
  "\nexport { dedupeHeaders, tokenizeCSV, parseCSV, detectDelimiter, detectDecimalConvention, parseNumber, summariseData, extractFirstJsonObject, parseTiers };\n";
const tmp = join(here, ".data-pipeline-fns.test-tmp.mjs");
writeFileSync(tmp, fns);
const p = await import(tmp);
rmSync(tmp);

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}\n      got  ${g}\n      want ${w}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

section("CSV tokenizer / parser");
check("BOM stripped", p.parseCSV("﻿a,b\n1,2")[0], { a: "1", b: "2" });
check("quoted newline", p.parseCSV('a,b\n"x\ny",2')[0], { a: "x\ny", b: "2" });
check("escaped quotes", p.parseCSV('a,b\n"he said ""hi""",2')[0], { a: 'he said "hi"', b: "2" });
check("CRLF", p.parseCSV("a,b\r\n1,2\r\n3,4").length, 2);
check("dedupe collision", p.dedupeHeaders(["Amount","Amount","Amount_1"]), ["Amount","Amount_1","Amount_1_1"]);
check("leading ws before quote", p.parseCSV('a,b\n  "x, y",2')[0], { a: "x, y", b: "2" });
check("unquoted trim", p.parseCSV("a,b\n  1  ,2")[0], { a: "1", b: "2" });
let threw = false; try { p.tokenizeCSV('a,b\n"unclosed,2', ","); } catch { threw = true; }
check("unclosed quote throws", threw, true);

section("delimiter detection");
check("semicolon", p.detectDelimiter("a;b;c\n1;2;3"), ";");
check("tab", p.detectDelimiter("a\tb\n1\t2"), "\t");
check("escaped quotes don't confuse it",
  p.detectDelimiter('name,note\n"x","said ""a;b;c;d;e;f;g;h"" ok"\n1,2'), ",");

section("headerless mode");
check("firstRowIsHeader=false", p.parseCSV("1,2\n3,4", ",", false),
  [{ Column_1: "1", Column_2: "2" }, { Column_1: "3", Column_2: "4" }]);
check("single row headerless", p.parseCSV("5,6", ",", false), [{ Column_1: "5", Column_2: "6" }]);
check("header mode default", p.parseCSV("a,b\n1,2"), [{ a: "1", b: "2" }]);

section("decimal conventions");
const di_e = p.detectDecimalConvention(["1.234,56", "999,99", "2.000,00"]);
const di_u = p.detectDecimalConvention(["1,234.56", "999.99", "2,000.00"]);
check("euro column detected", di_e.convention, "euro");
check("us column detected", di_u.convention, "us");
check("pure column not mixed", di_e.mixed, false);
check("euro parse", p.parseNumber("1.234,56", di_e), 1234.56);
check("us parse", p.parseNumber("1,234.56", di_u), 1234.56);
const di_m = p.detectDecimalConvention(["1.234,56", "999,99", "12,5", "1,234.56", "88.25"]);
check("mixed flagged", di_m.mixed, true);
check("mixed: euro value right", p.parseNumber("1.234,56", di_m), 1234.56);
check("mixed: us value right", p.parseNumber("1,234.56", di_m), 1234.56);
check("mixed: plain decimal right", p.parseNumber("88.25", di_m), 88.25);
check("ambiguous 1,234 follows euro column vote", p.parseNumber("1,234", "euro"), 1.234);
check("percent stripped", p.parseNumber("12.5%", "us"), 12.5);
check("currency stripped", p.parseNumber("$1,234.56", "us"), 1234.56);
check("garbage null", p.parseNumber("12 items", "us"), null);

section("cross-convention fallback is gated (no fake numbers)");
// Version strings and IPs must NOT be coerced into numbers by the fallback —
// that would flip the column to numeric and produce fictitious statistics.
const di_v = p.detectDecimalConvention(["1.2.3", "2.4.1", "10.0.0", "3.1.4"]);
check("version string -> null", p.parseNumber("1.2.3", di_v), null);
const di_ip = p.detectDecimalConvention(["192.168.1.1", "10.0.0.254", "172.16.31.5"]);
check("IP -> null", p.parseNumber("192.168.1.1", di_ip), null);
check("version column stays categorical",
  p.summariseData([{version:"1.2.3",n:"x"},{version:"2.4.1",n:"x"},{version:"10.0.0",n:"x"},{version:"3.1.4",n:"x"}]).includes("NUMERIC"), false);
check("ip column stays categorical",
  p.summariseData([{server_ip:"192.168.1.1",n:"x"},{server_ip:"10.0.0.254",n:"x"},{server_ip:"172.16.31.5",n:"x"}]).includes("NUMERIC"), false);
// …but a genuinely euro-grouped value inside a US-majority column IS rescued:
const di_us2 = p.detectDecimalConvention(["1,234.56","999.99","2,000.00","88.25","150.75","1.234.567"]);
check("euro-grouped value rescued in us column", p.parseNumber("1.234.567", di_us2), 1234567);
const di_eu2 = p.detectDecimalConvention(["1.234,56","999,99","2.000,00","88,25","150,75","1,234,567"]);
check("us-grouped value rescued in euro column", p.parseNumber("1,234,567", di_eu2), 1234567);

section("summary caps");
const wide = {}; for (let i = 1; i <= 60; i++) wide[`col${i}`] = String(i);
const wideSum = p.summariseData([wide, wide, wide]);
check("wide file notes cap", wideSum.includes("capped to first 50"), true);
check("wide file reports true col count", wideSum.includes("Columns: 60"), true);
const bigRows = [];
for (let i = 0; i < 40; i++) { const r = {}; for (let j = 0; j < 50; j++) r[`c${j}`] = `longvalue_${i}_${j}_` + "x".repeat(100); bigRows.push(r); }
const bigSum = p.summariseData(bigRows, true);
check("char cap enforced", bigSum.length <= 18000 + 120, true);
check("truncation notice present", bigSum.includes("[Summary truncated"), true);

section("privacy default");
const catSum = p.summariseData([{ name: "Alice" }, { name: "Bob" }, { name: "Alice" }]);
check("values hidden by default", catSum.includes("Alice"), false);
check("counts still present", catSum.includes("(2 unique values)"), true);
const optIn = p.summariseData([{ name: "Alice" }, { name: "Bob" }, { name: "Alice" }], true);
check("opt-in sends values", optIn.includes("Alice"), true);

section("parseTiers hardening");
const evil = `preamble {"tiers":[
 {"tier":"1","label":"${"L".repeat(300)}","description":"d","items":["${"A".repeat(600)}","b","c","d"]},
 {"tier":99,"label":"bad","items":["x"]},
 {"tier":2.5,"label":"frac","items":["x"]},
 {"tier":2,"label":"ok","description":"fine","items":["one","two"]}
]} trailing }`;
const t = p.parseTiers(evil);
check("string tier coerced", t[0].tier, 1);
check("label capped 80", t[0].label.length, 80);
check("items capped to 2", t[0].items.length, 2);
check("item chars capped 280", t[0].items[0].length, 280);
check("tier 99 dropped", t.some(x => x.tier === 99), false);
check("fractional tier dropped", t.some(x => x.tier === 2.5), false);
check("valid tier kept", t.some(x => x.tier === 2), true);
check("no JSON -> null (halt path)", p.parseTiers("no json here at all"), null);
check("empty tiers -> []", p.parseTiers('{"tiers":[]}'), []);
check("stray brace inside string survives",
  p.parseTiers('x {"tiers":[{"tier":1,"label":"has } brace","description":"d","items":["a}b","c"]}]} y')[0].items[0], "a}b");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
