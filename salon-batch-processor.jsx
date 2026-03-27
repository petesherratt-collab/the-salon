import { useState, useRef, useCallback } from "react";

const OPENROUTER_API_KEY = "YOUR_OPENROUTER_KEY_HERE"; // paste your key from salon.html

const PERSONAS = [
  { id: "machiavelli", name: "Machiavelli", emoji: "⚔️", domain: "Power & Politics" },
  { id: "montaigne",   name: "Montaigne",   emoji: "📜", domain: "Self & Society" },
  { id: "aurelius",    name: "Marcus Aurelius", emoji: "🏛️", domain: "Stoic Ethics" },
  { id: "austen",      name: "Austen",      emoji: "🪞", domain: "Society & Motive" },
  { id: "nietzsche",   name: "Nietzsche",   emoji: "⚡", domain: "Will & Value" },
  { id: "camus",       name: "Camus",       emoji: "🌊", domain: "Absurdity & Revolt" },
  { id: "basho",       name: "Bashō",       emoji: "🌿", domain: "Impermanence & Presence" },
  { id: "mill",        name: "Mill",        emoji: "⚖️", domain: "Liberty & Utility" },
];

const JUDGEMENT_SYSTEM = (persona) => `You are ${persona.name}, the historical thinker, operating as a Salon persona. Your domain is ${persona.domain}.

Deliver a Judgement in exactly this structure (no headers, no meta-commentary):

1. FRAMING (1–2 sentences): Restate the topic through your distinctive philosophical lens.
2. REFRAME (2–3 sentences): Apply your core ideas to illuminate what is really at stake.
3. VERDICT (1 sentence): An unambiguous, declarative judgement. No hedging.
4. MAXIM (1 sentence, italicised with *asterisks*): A standalone aphorism distilling your verdict — quotable, sharp, memorable.

Total length: 120–180 words. Write in first person. Be specific, not generic. Channel your actual recorded thought where possible.`;

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = lines[0].toLowerCase().trim();
  const hasHeader = header === "topic" || header === "question" || header === "prompt" || header === "topics";
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map(l => l.trim()).filter(Boolean);
}

function escapeCsvCell(val) {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvExport(topics, results) {
  const headers = ["Topic", ...PERSONAS.map(p => `${p.name} — Judgement`)];
  const rows = topics.map(topic => {
    const row = [topic];
    PERSONAS.forEach(p => {
      row.push(results[`${topic}::${p.id}`]?.text || "");
    });
    return row;
  });
  return [headers, ...rows].map(r => r.map(escapeCsvCell).join(",")).join("\n");
}

function parseJudgement(text) {
  if (!text) return { framing: "", reframe: "", verdict: "", maxim: "" };

  const maximMatch = text.match(/\*([^*]+)\*/);
  const maxim = maximMatch ? maximMatch[1].trim() : "";

  const bodyText = text.replace(/\*[^*]+\*/, "").trim();
  const bodyLines = bodyText.split(/\n+/).map(l => l.trim()).filter(Boolean);

  const midLines = bodyLines.slice(2);
  const verdict = midLines.length
    ? midLines.reduce((a, b) => a.length <= b.length ? a : b)
    : "";

  const framing = bodyLines.slice(0, 2).join(" ");

  const reframe = bodyLines
    .slice(2)
    .filter(l => l !== verdict)
    .join(" ");

  return { framing, reframe, verdict, maxim };
}

function buildSplitCsvExport(topics, results, activePers) {
  const headers = [
    "Topic",
    ...activePers.flatMap(p => [
      `${p.name} — Framing`,
      `${p.name} — Reframe`,
      `${p.name} — Verdict`,
      `${p.name} — Maxim`,
    ])
  ];

  const rows = topics.map(topic => {
    const row = [topic];
    activePers.forEach(p => {
      const cell = results[`${topic}::${p.id}`];
      const parsed = parseJudgement(cell?.status === "done" ? cell.text : "");
      row.push(parsed.framing, parsed.reframe, parsed.verdict, parsed.maxim);
    });
    return row;
  });

  return [headers, ...rows].map(r => r.map(escapeCsvCell).join(",")).join("\n");
}

async function fetchJudgement(topic, persona, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [
          { role: "system", content: JUDGEMENT_SYSTEM(persona) },
          { role: "user", content: topic },
        ],
      }),
    });

    if (response.status === 429 && attempt < retries) {
      await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
  throw new Error("Rate limit — max retries exceeded");
}

const STATUS = { idle: "idle", running: "running", done: "done", error: "error" };

export default function App() {
  const [topics, setTopics] = useState([]);
  const [results, setResults] = useState({});
  const [jobStatus, setJobStatus] = useState(STATUS.idle);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState([]);
  const [selectedPersonas, setSelectedPersonas] = useState(PERSONAS.map(p => p.id));
  const [concurrency, setConcurrency] = useState(4);
  const [csvText, setCsvText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");
  const [expandedCell, setExpandedCell] = useState(null);
  const abortRef = useRef(false);
  const fileRef = useRef(null);

  const activePers = PERSONAS.filter(p => selectedPersonas.includes(p.id));

  const loadCsv = useCallback((text) => {
    const parsed = parseCsv(text);
    if (parsed.length) {
      setTopics(parsed);
      setCsvText(text);
      setResults({});
      setErrors([]);
      setJobStatus(STATUS.idle);
      setProgress({ done: 0, total: 0 });
      if (parsed.length > 0) setActiveTab("setup");
    }
  }, []);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => loadCsv(e.target.result);
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = (e) => {
    const text = e.target.value;
    setCsvText(text);
    const parsed = parseCsv(text);
    setTopics(parsed);
  };

  const togglePersona = (id) => {
    setSelectedPersonas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const runBatch = async () => {
    if (!topics.length || !activePers.length) return;
    abortRef.current = false;
    setJobStatus(STATUS.running);
    setActiveTab("results");
    const pairs = [];
    topics.forEach(t => activePers.forEach(p => pairs.push([t, p])));
    setProgress({ done: 0, total: pairs.length });
    setResults({});
    setErrors([]);

    let idx = 0;
    let done = 0;
    const errList = [];

    async function worker() {
      while (idx < pairs.length && !abortRef.current) {
        const i = idx++;
        const [topic, persona] = pairs[i];
        const key = `${topic}::${persona.id}`;
        try {
          setResults(r => ({ ...r, [key]: { status: "loading" } }));
          const text = await fetchJudgement(topic, persona);
          setResults(r => ({ ...r, [key]: { status: "done", text } }));
        } catch (err) {
          errList.push({ topic, persona: persona.name, msg: err.message });
          setResults(r => ({ ...r, [key]: { status: "error", text: err.message } }));
        }
        done++;
        setProgress({ done, total: pairs.length });
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    setErrors(errList);
    setJobStatus(abortRef.current ? STATUS.idle : STATUS.done);
  };

  const stopBatch = () => { abortRef.current = true; };

  const downloadCsv = () => {
    const csv = buildCsvExport(topics, results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salon-judgements-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSplitCsv = () => {
    const csv = buildSplitCsvExport(topics, results, activePers);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salon-judgements-split-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const isRunning = jobStatus === STATUS.running;

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>
            The Judgement
          </h1>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Batch Processor</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Upload a CSV of topics — receive a Judgement from each Salon persona. Export your content library.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem" }}>
        {["setup", "results"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid var(--color-text-primary)" : "2px solid transparent",
            padding: "8px 16px", fontSize: 14, fontWeight: activeTab === tab ? 500 : 400,
            color: activeTab === tab ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            cursor: "pointer", marginBottom: -1
          }}>
            {tab === "setup" ? "Setup" : `Results${progress.total ? ` (${progress.done}/${progress.total})` : ""}`}
          </button>
        ))}
      </div>

      {activeTab === "setup" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

          {/* Upload */}
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
              Upload CSV or paste topics
            </p>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `1px dashed ${dragOver ? "var(--color-border-primary)" : "var(--color-border-secondary)"}`,
                borderRadius: "var(--border-radius-lg)", padding: "1.5rem",
                textAlign: "center", cursor: "pointer", marginBottom: 12,
                background: dragOver ? "var(--color-background-secondary)" : "transparent",
                transition: "all 0.15s"
              }}>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }}
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                {topics.length
                  ? <><span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{topics.length} topics loaded</span> — click to replace</>
                  : "Drop CSV here or click to browse"}
              </div>
            </div>

            <textarea
              placeholder={"One topic per line, or paste CSV:\n\nShould leaders always tell the truth?\nIs ambition a virtue or a vice?\nCan a state be just and still go to war?"}
              value={csvText}
              onChange={handlePaste}
              style={{
                width: "100%", minHeight: 180, resize: "vertical", fontSize: 13,
                fontFamily: "var(--font-mono)", boxSizing: "border-box",
                background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: "var(--border-radius-md)", padding: "10px 12px", color: "var(--color-text-primary)"
              }}
            />

            {topics.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
                {topics.length} topics × {activePers.length} personas = <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{topics.length * activePers.length} Judgements</span>
              </div>
            )}
          </div>

          {/* Persona + Options */}
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
              Select personas
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: "1.5rem" }}>
              {PERSONAS.map(p => {
                const on = selectedPersonas.includes(p.id);
                return (
                  <button key={p.id} onClick={() => togglePersona(p.id)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    border: `0.5px solid ${on ? "var(--color-border-primary)" : "var(--color-border-tertiary)"}`,
                    borderRadius: "var(--border-radius-md)", background: on ? "var(--color-background-secondary)" : "transparent",
                    cursor: "pointer", textAlign: "left"
                  }}>
                    <span style={{ fontSize: 16 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: on ? 500 : 400, color: on ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{p.domain}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
              Concurrency: {concurrency} parallel calls
            </p>
            <input type="range" min={1} max={8} step={1} value={concurrency}
              onChange={e => setConcurrency(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 4 }} />
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
              Higher = faster but more rate-limit risk
            </div>

            <button
              onClick={runBatch}
              disabled={!topics.length || !activePers.length || isRunning}
              style={{
                marginTop: "1.5rem", width: "100%", padding: "10px 16px",
                fontSize: 14, fontWeight: 500, cursor: topics.length && activePers.length && !isRunning ? "pointer" : "not-allowed",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                background: topics.length && activePers.length && !isRunning ? "var(--color-background-secondary)" : "transparent",
                color: topics.length && activePers.length && !isRunning ? "var(--color-text-primary)" : "var(--color-text-tertiary)"
              }}>
              {isRunning ? "Running…" : `Run Batch — ${topics.length * activePers.length} Judgements`}
            </button>
          </div>
        </div>
      )}

      {activeTab === "results" && (
        <div>
          {/* Progress bar */}
          {(isRunning || jobStatus === STATUS.done) && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                  {isRunning ? `Processing… ${progress.done} / ${progress.total}` : `Complete — ${progress.done} Judgements`}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {isRunning && (
                    <button onClick={stopBatch} style={{
                      fontSize: 12, padding: "4px 10px", border: "0.5px solid var(--color-border-secondary)",
                      borderRadius: "var(--border-radius-md)", background: "transparent",
                      color: "var(--color-text-secondary)", cursor: "pointer"
                    }}>Stop</button>
                  )}
                  {jobStatus === STATUS.done && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={downloadCsv} style={{
                        fontSize: 12, padding: "4px 10px",
                        border: "0.5px solid var(--color-border-secondary)",
                        borderRadius: "var(--border-radius-md)",
                        background: "var(--color-background-secondary)",
                        color: "var(--color-text-primary)", cursor: "pointer", fontWeight: 500
                      }}>Export CSV ↓</button>
                      <button onClick={downloadSplitCsv} style={{
                        fontSize: 12, padding: "4px 10px",
                        border: "0.5px solid var(--color-border-secondary)",
                        borderRadius: "var(--border-radius-md)",
                        background: "transparent",
                        color: "var(--color-text-secondary)", cursor: "pointer"
                      }}>Export split columns ↓</button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`, background: "var(--color-text-primary)",
                  borderRadius: 2, transition: "width 0.3s"
                }} />
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div style={{
              marginBottom: "1rem", padding: "10px 12px", fontSize: 13,
              background: "var(--color-background-danger)", borderRadius: "var(--border-radius-md)",
              color: "var(--color-text-danger)", border: "0.5px solid var(--color-border-danger)"
            }}>
              {errors.length} error{errors.length > 1 ? "s" : ""}: {errors.map(e => `${e.persona} / ${e.topic.slice(0, 30)}`).join(", ")}
            </div>
          )}

          {/* Results grid */}
          {topics.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 180 }} />
                  {activePers.map(p => <col key={p.id} style={{ width: 160 }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500, fontSize: 12, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>Topic</th>
                    {activePers.map(p => (
                      <th key={p.id} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500, fontSize: 12, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                        {p.emoji} {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic, ti) => (
                    <tr key={ti} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding: "10px 10px", verticalAlign: "top", color: "var(--color-text-primary)", fontWeight: 500, fontSize: 13 }}>
                        {topic}
                      </td>
                      {activePers.map(p => {
                        const key = `${topic}::${p.id}`;
                        const cell = results[key];
                        const isExpanded = expandedCell === key;
                        return (
                          <td key={p.id} style={{ padding: "10px 10px", verticalAlign: "top" }}>
                            {!cell ? (
                              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>—</span>
                            ) : cell.status === "loading" ? (
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Thinking</span>
                                <span className="dots" style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}>…</span>
                              </div>
                            ) : cell.status === "error" ? (
                              <span style={{ fontSize: 12, color: "var(--color-text-danger)" }}>Error</span>
                            ) : (
                              <div>
                                <div style={{
                                  fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6,
                                  overflow: "hidden", maxHeight: isExpanded ? "none" : 72,
                                  maskImage: isExpanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)",
                                  WebkitMaskImage: isExpanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)"
                                }}>
                                  {cell.text}
                                </div>
                                <button onClick={() => setExpandedCell(isExpanded ? null : key)} style={{
                                  marginTop: 4, fontSize: 11, color: "var(--color-text-tertiary)", background: "none",
                                  border: "none", padding: 0, cursor: "pointer"
                                }}>
                                  {isExpanded ? "collapse ↑" : "expand ↓"}
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {topics.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-tertiary)", fontSize: 14 }}>
              Load topics in the Setup tab to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
