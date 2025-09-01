import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { Save, Sparkles, Plus, Trash2, Brain, X, AlertTriangle, Send } from "lucide-react";

/* --------------------------- persistence / helpers --------------------------- */
const KEY_HISTORY = "mpr-history";
const KEY_KPIS = "mpr-kpis";
const KEY_WARN_MUTE_DATE = "mpr-warn-mute-date";

const todayKey = () => new Date().toISOString().slice(0, 10);
const load = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const isMutedToday = () => localStorage.getItem(KEY_WARN_MUTE_DATE) === todayKey();
const muteForToday = () => localStorage.setItem(KEY_WARN_MUTE_DATE, todayKey());
const clearMute = () => localStorage.removeItem(KEY_WARN_MUTE_DATE);

/* --------------------------- plan/day parsing for alerts --------------------------- */
function normalizePlan(plan = "") {
  let t = " " + (plan || "") + " ";
  t = t.replace(/(^|[^a-z])m(?=[^a-z])/gi, "$1Mon");
  t = t.replace(/(^|[^a-z])w(?=[^a-z])/gi, "$1Wed");
  t = t.replace(/(^|[^a-z])f(?=[^a-z])/gi, "$1Fri");
  t = t.replace(/\btu\b/gi, "Tue").replace(/\bth(u|)\b/gi, "Thu");
  t = t.replace(/[\/\\|]/g, " ").replace(/–|—/g, "-");
  return t;
}
function extractDaysFromPlan(plan = "") {
  const t = normalizePlan(plan).toLowerCase();
  const hits = new Set();
  const addIf = (day, patterns) => { if (patterns.some(p => new RegExp(`\\b${p}\\b`, "i").test(t))) hits.add(day); };
  addIf("Sun", ["sun","su"]); addIf("Mon", ["mon"]); addIf("Tue", ["tue"]);
  addIf("Wed", ["wed"]); addIf("Thu", ["thu","thur"]); addIf("Fri", ["fri"]); addIf("Sat", ["sat","sa"]);
  return Array.from(hits);
}
const isAlertDueToday = (plan, dow) => {
  const days = extractDaysFromPlan(plan);
  return days.length > 0 && days.includes(dow);
};

/* --------------------------- default data --------------------------- */
const DEFAULT_STACK_ROWS = [
  { id: "motsc",   time: "Morning (Fast)", compound: "MOTs-C",                        doseIU: "15",  doseMg: "2.0",       category: "Mitochondrial / Energy", notes: "SubQ" },
  { id: "aod9604", time: "Morning (Fast)", compound: "AOD-9604",                      doseIU: "15",  doseMg: "0.5",       category: "Fat Loss",               notes: "SubQ" },
  { id: "nadlcarn",time: "Morning (Fast)", compound: "NAD+ + L-Carn",                 doseIU: "100", doseMg: "—",         category: "Energy / Mitochondrial", notes: "SubQ" },
  { id: "cjcipa",  time: "AM",              compound: "CJC-1295 (no DAC) + Ipamorelin", doseIU: "10", doseMg: "1.0",     category: "GH / Recovery",          notes: "SubQ, empty stomach" },
  { id: "klow80",  time: "Workout / AM Rest", compound: "KLOW 80",                   doseIU: "40",  doseMg: "—",          category: "Tissue Repair",          notes: "SubQ" },
  { id: "bpc_tb",  time: "Workout / AM Rest", compound: "BPC-157 + TB-500 combo",    doseIU: "10",  doseMg: "0.2 each",   category: "Tissue Repair",          notes: "SubQ" },
  { id: "tesa",    time: "Night (10 PM)",   compound: "Tesamorelin",                 doseIU: "10",  doseMg: "1.0",        category: "GH / Recovery",          notes: "SubQ, 2–3h after last meal" },
  { id: "dsip",    time: "Night (10 PM)",   compound: "DSIP",                        doseIU: "10",  doseMg: "0.1",        category: "Sleep / Recovery",       notes: "SubQ" },
  { id: "mel_lo",  time: "Night (10 PM)",   compound: "Melatonin – Lights Out",      doseIU: "—",   doseMg: "0.5 mL",     category: "Sleep",                  notes: "SubQ" },
  { id: "survo",   time: "Weekly",          compound: "Survodutide",                 doseIU: "40",  doseMg: "2.4",        category: "Fat Loss / Metabolic",   notes: "SubQ", days: ["Sat"] },
  { id: "testc",   time: "Weekly",          compound: "Testosterone Cypionate",      doseIU: "—",   doseMg: "200 mg Mon PM + 200 mg Fri AM", category: "Hormone", notes: "IM", days: ["Mon","Fri"] },
  { id: "trenE",   time: "Weekly",          compound: "Trenbolone Enanthate",        doseIU: "—",   doseMg: "100 mg Wed PM + 100 mg Sun AM", category: "Hormone", notes: "IM", days: ["Wed","Sun"] },
];

const DEFAULT_ALERTS = [
  { id: "alrt1", title: "Super Human Blend (SHB)", plan: "M-W-F after workout — 50 IU" },
  { id: "alrt2", title: "Super Shredded (SS)",     plan: "Tu-Th-Sat morning — 50 IU" },
  { id: "alrt3", title: "Fat Blaster",             plan: "Mon-Thu-Sat — 50 IU" },
];

/* --------------------------- mini KB (aliases + dosing) --------------------------- */
const MINI_KB = {
  "aod-9604": {
    aliases: ["aod", "aod9604", "aod-9604"],
    what: "Fragment of GH thought to affect fat metabolism.",
    dose: "Commonly reported: 200–500 mcg/day, often AM fasted (informational only).",
    cautions: ["Limited evidence; watch expectations and overlap with stimulatory protocols."],
    stackNotes: ["With GLP-1s (e.g., Survodutide) duplicates fat-loss focus; monitor recovery/nutrition."]
  },
  "mots-c": {
    aliases: ["mots", "motsc", "mots-c"],
    what: "Mitochondrial peptide; studied for metabolic/energy effects.",
    dose: "Anecdotal cycles vary (e.g., 5–10 mg/week divided) — informational only.",
    cautions: ["Limited human data; monitor how you feel."],
    stackNotes: ["Often AM/fasted; generally fine with others."]
  },
  "tesamorelin": {
    aliases: ["tesa", "tesamorelin"],
    what: "GHRH analog used to stimulate GH release; often PM on empty stomach.",
    dose: "Common research protocol: 1–2 mg/day (single PM or split) — informational only.",
    cautions: ["Fluid retention/edema", "Carpal-tunnel symptoms", "Glucose/insulin changes"],
    stackNotes: ["Overlaps with other GH secretagogues; space apart if combined."]
  },
  "cjc-1295": {
    aliases: ["cjc", "cjc1295", "cjc-1295"],
    what: "GHRH analog (no DAC for shorter pulses).",
    dose: "Frequently reported: 100–200 mcg 1–2×/day (informational only).",
    cautions: ["Flush/tingle", "Increased GH/IGF load when stacked"],
    stackNotes: ["If stacking with Tesamorelin, consider alternating timing."]
  },
  "ipamorelin": {
    aliases: ["ipa", "ipam", "ipamorelin"],
    what: "Ghrelin mimetic; pulses GH (often AM fasted).",
    dose: "Frequently reported: 100–300 mcg 1–3×/day (informational only).",
    cautions: ["Mild hunger, lightheadedness"],
    stackNotes: ["With other GH secretagogues → watch edema/CTS; space doses."]
  },
  "bpc-157": {
    aliases: ["bpc", "bpc157", "bpc-157"],
    what: "Repair peptide; often paired with TB-500.",
    dose: "Commonly reported: 200–500 mcg 1–2×/day (informational only).",
    cautions: ["BP/GI changes reported anecdotally"],
    stackNotes: ["BPC + TB-500 is a common soft-tissue combo."]
  },
  "tb-500": {
    aliases: ["tb500", "tb-500", "tb"],
    what: "Thymosin beta-4 fragment for tissue repair.",
    dose: "Anecdotal cycles: 2–10 mg/week divided (informational only).",
    cautions: ["Limited clinical data"],
    stackNotes: ["Stacks with BPC-157; cycle planning matters."]
  },
  "ghk-cu": {
    aliases: ["ghk", "ghkcu", "ghk-cu"],
    what: "Copper tripeptide; topical/systemic interest.",
    dose: "Varies by route (topical vs systemic); informational only.",
    cautions: ["Copper sensitivity rare"],
    stackNotes: ["Keep metals balanced."]
  },
  "kpv": {
    aliases: ["kpv"],
    what: "α-MSH fragment; anti-inflammatory interest.",
    dose: "Varies widely; informational only.",
    cautions: ["Limited human data"],
    stackNotes: ["Usually supportive; low interaction profile."]
  },
  "survodutide": {
    aliases: ["survo", "survodutide"],
    what: "GLP-1/GCG dual agonist under study; metabolic effects.",
    dose: "Protocol-dependent (investigational); informational only.",
    cautions: ["GI upset, appetite suppression, dehydration"],
    stackNotes: ["With other fat-loss agents → monitor energy/recovery."]
  },
  "testosterone cypionate": {
    aliases: ["test c", "test cyp", "testosterone", "testosterone cypionate"],
    what: "Androgen (TRT/BB contexts).",
    dose: "TRT protocols vary (e.g., 100–200 mg/week); bodybuilding doses differ — informational only.",
    cautions: ["BP/lipids, E2 balance, RBC/HCT — monitor labs"],
    stackNotes: ["With Tren → cardiovascular/neurologic risks ↑."]
  },
  "trenbolone enanthate": {
    aliases: ["tren e", "trene", "trenbolone enanthate", "tren"],
    what: "Potent androgen; high-risk profile.",
    dose: "Advanced users vary protocols; significant side-effect risks — informational only.",
    cautions: ["Lipids/BP, sleep, mood, neuro, renal markers"],
    stackNotes: ["With Test is common but high-risk; monitor closely."]
  },
  "nad+": {
    aliases: ["nad", "nad+"],
    what: "Metabolic cofactor; sometimes stacked with L-Carnitine.",
    dose: "Routes/dose vary (IV/oral); informational only.",
    cautions: ["Flush/headache in some users"],
    stackNotes: ["Hydrate."]
  },
  "melatonin": {
    aliases: ["mel", "melatonin"],
    what: "Sleep hormone for onset.",
    dose: "1–5 mg near bedtime commonly reported (informational only).",
    cautions: ["Grogginess, vivid dreams"],
    stackNotes: ["Use consistent timing."]
  }
};

/* --------------------------- conflict rules --------------------------- */
const CONFLICT_RULES = [
  {
    id: "gh-secretagogues-overlap",
    match: (names) =>
      (names.has("tesamorelin") && (names.has("cjc-1295") || names.has("ipamorelin"))) ||
      names.has("cjc-1295 + ipamorelin"),
    level: "caution",
    title: "Stacked GH secretagogues",
    explain: "Tesamorelin + CJC/Ipamorelin can over-load GH/IGF pulses. Consider spacing AM/PM or alternating days to reduce edema/CTS risk."
  },
  {
    id: "fatloss-duplication",
    match: (names) => (names.has("aod-9604") && names.has("survodutide")),
    level: "notice",
    title: "Multiple fat-loss agents",
    explain: "GLP-1/dual-agonist + AOD-9604 duplicates fat-loss focus. Ensure nutrition, electrolytes, and recovery are adequate."
  },
  {
    id: "androgenic-stack",
    match: (names) => (names.has("testosterone cypionate") && names.has("trenbolone enanthate")),
    level: "warning",
    title: "High-androgen stack",
    explain: "Test + Tren increases cardiovascular, lipid, BP, neuro, and sleep strain. Monitor labs, BP, and symptoms closely."
  }
];

const namesFromToday = (rows, alerts) => {
  const s = new Set();
  const add = (txt) => {
    if (!txt) return;
    const t = txt.toLowerCase();
    s.add(t);
    if (t.includes("cjc") && t.includes("ipa")) s.add("cjc-1295 + ipamorelin");
  };
  rows.forEach(r => add(r.compound));
  alerts.forEach(a => add(a.title));
  return s;
};
const runConflictScan = (rows, alerts) => {
  const names = namesFromToday(rows, alerts);
  return CONFLICT_RULES.filter(rule => rule.match(names));
};

/* --------------------------- fuzzy search helpers --------------------------- */
const normalizeStr = (s="") => s.toLowerCase().replace(/[^a-z0-9\+\- ]/g," ").replace(/\s+/g," ").trim();
function buildSearchIndex() {
  const idx = [];
  for (const key of Object.keys(MINI_KB)) {
    const entry = MINI_KB[key];
    const names = new Set([key, ...(entry.aliases || [])]);
    for (const n of names) idx.push({ key, n: normalizeStr(n) });
  }
  return idx;
}
const KB_INDEX = buildSearchIndex();
function findPeptideEntry(query="") {
  const q = normalizeStr(query);
  if (!q) return null;
  const exact = KB_INDEX.find(i => q === i.n || i.n === q);
  if (exact) return MINI_KB[exact.key];
  const soft = KB_INDEX.find(i => q.includes(i.n) || i.n.includes(q) || i.n.startsWith(q) || q.startsWith(i.n));
  if (soft) return MINI_KB[soft.key];
  const tokens = q.split(" ");
  const tokenHit = KB_INDEX.find(i => tokens.some(t => i.n.includes(t)));
  if (tokenHit) return MINI_KB[tokenHit.key];
  return null;
}

/* --------------------------- format Big Brain context --------------------------- */
function formatContextForHelp({ kpis, rows, alerts, todayDowShort }) {
  const fmt = (v) => (v ?? "").toString().trim() || "—";
  const scheduleLines = rows.map(r =>
    `- [${r.time}] ${r.compound} | IU: ${fmt(r.doseIU)} | mg: ${fmt(r.doseMg)} | ${r.category} | ${fmt(r.notes)}`
  ).join("\n");
  const alertLines = alerts.map(a =>
    `- ${a.title || "Untitled"} — ${a.plan || "No plan text"}`
  ).join("\n");
  return [
    `Peptide Dashboard Context — ${new Date().toLocaleString()} (${todayDowShort})`,
    ``,
    `KPIs: weight=${fmt(kpis.weight)}, sleep=${fmt(kpis.sleep)}, waist=${fmt(kpis.waist)}, energy=${fmt(kpis.energy)}`,
    ``,
    `Today's Schedule (visible rows):`,
    scheduleLines || "—",
    ``,
    `Due-Today Alerts:`,
    alertLines || "—",
    ``,
    `Ask:`,
    `1) Safety/interaction check on the above.`,
    `2) Dosing timing tips (AM/PM, fasted vs fed).`,
    `3) Any cautions for overlapping GH secretagogues or high-androgen stacks.`,
    ``,
    `Notes: educational purposes only.`
  ].join("\n");
}

/* =================================== APP =================================== */
export default function App() {
  /* clock */
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const todayDowShort = DOW_SHORT[now.getDay()];
  const clockFmt = useMemo(() => {
    const parts = new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "2-digit", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short"
    }).formatToParts(now);
    const get = (type) => parts.find(p => p.type === type)?.value || "";
    return `${get("weekday")} • ${get("month")} ${get("day")}, ${get("year")} — ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod")} ${get("timeZoneName")}`.replace(/\s+/g," ").trim();
  }, [now]);

  /* KPIs */
  const [kpis, setKpis] = useState(() => load(KEY_KPIS, { weight: "", sleep: "", waist: "", energy: "" }));
  useEffect(() => save(KEY_KPIS, kpis), [kpis]);

  /* Alerts (editable + checkbox) */
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS);
  const [alertsEdit, setAlertsEdit] = useState(false);
  const [alertsCheck, setAlertsCheck] = useState(() =>
    Object.fromEntries(DEFAULT_ALERTS.map(a => [a.id, { done:false, ts:null }]))
  );
  const addAlert = () => {
    if (alerts.length >= 8) return;
    const id = `alrt${crypto?.randomUUID?.() || Math.random().toString(36).slice(2,8)}`;
    setAlerts(a => [...a, { id, title: "", plan: "" }]);
    setAlertsCheck(ch => ({ ...ch, [id]: { done:false, ts:null } }));
  };
  const updateAlert = (id, field, val) => setAlerts(a => a.map(x => x.id === id ? { ...x, [field]: val } : x));
  const deleteAlert = (id) => { setAlerts(a => a.filter(x => x.id !== id)); setAlertsCheck(({ [id]:_, ...rest }) => rest); };
  const toggleAlert = (id) => setAlertsCheck(prev => {
    const next = !prev[id]?.done; return { ...prev, [id]: { done: next, ts: next ? new Date().toLocaleTimeString() : null } };
  });

  /* Schedule rows + checklist */
  const [rows, setRows] = useState(DEFAULT_STACK_ROWS);
  const resetRows = () => setRows(DEFAULT_STACK_ROWS);
  const [checklist, setChecklist] = useState(() =>
    Object.fromEntries(DEFAULT_STACK_ROWS.map(r => [r.id, { done:false, ts:null }]))
  );
  const [lastPulsedId, setLastPulsedId] = useState(null);
  const toggleRow = (rowId, current) => {
    const next = !current;
    setChecklist(prev => ({ ...prev, [rowId]: { done: next, ts: next ? new Date().toLocaleTimeString() : null } }));
    setLastPulsedId(rowId); setTimeout(() => setLastPulsedId(null), 700);
  };
  const [editMode, setEditMode] = useState(false);
  const updateRow = (id, field, value) => {
    if (field === "days") {
      const arr = value.split(",").map(s => s.trim()).filter(Boolean).map(s => {
        const t = s.slice(0,3).toLowerCase();
        return t==="sun"?"Sun":t==="mon"?"Mon":t==="tue"?"Tue":t==="wed"?"Wed":t==="thu"?"Thu":t==="fri"?"Fri":t==="sat"?"Sat":s;
      });
      setRows(prev => prev.map(r => (r.id === id ? { ...r, days: arr } : r)));
      return;
    }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  /* History + charts */
  const [history, setHistory] = useState(() => load(KEY_HISTORY, []));
  useEffect(() => save(KEY_HISTORY, history), [history]);
  const chartData = useMemo(() =>
    history.slice(-14).map(h => ({
      date: h.date.slice(5),
      weight: h.kpis?.weight ? Number(h.kpis.weight) : null,
      sleep:  h.kpis?.sleep  ? Number(h.kpis.sleep)  : null,
      energy: h.kpis?.energy ? Number(h.kpis.energy) : null,
    }))
  , [history]);

  const saveToday = () => {
    setHistory(prev => {
      const idx = prev.findIndex(r => r.date === todayKey());
      const record = { date: todayKey(), kpis: { ...kpis }, rows, checklist: { ...checklist }, alerts, alertsCheck: { ...alertsCheck } };
      const next = [...prev]; if (idx >= 0) next[idx] = record; else next.push(record); return next;
    });
  };
  const markAllComplete = () => {
    const allRows = Object.fromEntries(rows.map(r => [r.id, { done:true, ts:new Date().toLocaleTimeString() }]));
    const dueAlertIds = alerts.filter(a => isAlertDueToday(a.plan, todayDowShort)).map(a => a.id);
    const allAlerts = Object.fromEntries(dueAlertIds.map(id => [id, { done:true, ts:new Date().toLocaleTimeString() }]));
    setChecklist(allRows); setAlertsCheck(prev => ({ ...prev, ...allAlerts })); setTimeout(saveToday, 50);
  };

  /* visible rows / alerts */
  const visibleRows = useMemo(() => rows.filter(r => r.time !== "Weekly" || !Array.isArray(r.days) || r.days.length === 0 || r.days.includes(todayDowShort)), [rows, todayDowShort]);
  const visibleAlerts = useMemo(() => alertsEdit ? alerts : alerts.filter(a => isAlertDueToday(a.plan, todayDowShort)), [alerts, alertsEdit, todayDowShort]);

  /* GPT (local) */
  const [gptOpen, setGptOpen] = useState(false);
  const [chat, setChat] = useState([{ role: "system", text: "Peptide GPT ready. Educational info only (not medical advice)." }]);
  const [chatInput, setChatInput] = useState("");
  const conflictFindings = useMemo(() => runConflictScan(visibleRows, visibleAlerts), [visibleRows, visibleAlerts]);

  const kbLookup = (q) => {
    const entry = findPeptideEntry(q);
    if (!entry) return "I couldn’t match that to a peptide. Try aliases like “AOD”, “MOTs”, “TB500”, or “CJC IPA”.";
    const label = entry.aliases?.[0]?.toUpperCase?.() || "PEPTIDE";
    return [
      `• ${label}`,
      `  What: ${entry.what}`,
      entry.dose ? `  Dosing (informational only): ${entry.dose}` : "",
      `  Cautions: ${entry.cautions.join(", ")}`,
      `  Stack notes: ${entry.stackNotes.join(" ")}`
    ].filter(Boolean).join("\n");
  };

  const submitChat = () => {
    const q = chatInput.trim(); if (!q) return;
    const kb = kbLookup(q);
    let conflictText = "";
    if (!isMutedToday()) {
      const conflicts = runConflictScan(visibleRows, visibleAlerts);
      if (conflicts.length) conflictText = "\n\n⚠️ **Current stack cautions detected:**\n" + conflicts.map(c => `- ${c.title}: ${c.explain}`).join("\n");
    }
    setChat(prev => [...prev, { role: "user", text: q }, { role: "assistant", text: kb + conflictText }]);
    setChatInput("");
  };

  /* Big Brain (free) */
  const openBigBrain = async () => {
    const contextText = formatContextForHelp({
      kpis, rows: visibleRows, alerts: alerts.filter(a => isAlertDueToday(a.plan, todayDowShort)), todayDowShort
    });
    try { await navigator.clipboard.writeText(contextText); alert("Copied today’s context. Paste it into ChatGPT in the new tab!"); }
    catch { alert("Couldn't auto-copy. I’ll still open ChatGPT—come back and copy your context manually."); }
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  };

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/50 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-3 items-center">
          <div className="justify-self-start">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              Mike’s Peptide Ride <span className="text-pink-400">🚀</span>
              <motion.span className="inline-flex" initial={{ scale: 0.9, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ repeat: Infinity, repeatType: "mirror", duration: 2 }}>
                <Sparkles size={18} className="text-fuchsia-400" />
              </motion.span>
            </h1>
          </div>
          <div className="justify-self-center text-sm sm:text-base font-medium text-gray-200">{clockFmt}</div>
          <div className="justify-self-end">
            <a className="btn" href="https://researchdosing.com/dosing-information/" target="_blank" rel="noreferrer">Dosing Reference</a>
          </div>
        </div>
      </header>

      {/* Inline warning chips (respect mute) */}
      {!isMutedToday() && conflictFindings.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-4 grid gap-2">
          {conflictFindings.map(c => (
            <div key={c.id} className={`flex items-center gap-2 p-3 rounded-xl border warning-glow ${c.level==="warning"?"border-red-500/60":c.level==="caution"?"border-amber-500/60":"border-yellow-500/40"}`}>
              <AlertTriangle size={16} className={`${c.level==="warning"?"text-red-400":c.level==="caution"?"text-amber-400":"text-yellow-300"}`} />
              <div className="text-sm">
                <span className="font-semibold mr-1">{c.title}</span>
                <span className="text-gray-300">{c.explain}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 grid gap-6">
        {/* KPIs */}
        <motion.section className="grid grid-cols-2 md:grid-cols-4 gap-4" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          {[
            { key:"weight", label:"Weight", hint:"tap to add", unit:"lb" },
            { key:"sleep",  label:"Sleep (hrs)", hint:"track nightly", unit:"h" },
            { key:"waist",  label:"Waist (in)", hint:"weekly", unit:"in" },
            { key:"energy", label:"Energy", hint:"1–10", unit:"" },
          ].map(k => (
            <div key={k.key} className="card">
              <div className="card-title">{k.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <input className="input" placeholder={k.hint} value={kpis[k.key]} onChange={(e)=>setKpis(v=>({...v,[k.key]:e.target.value}))} />
                {k.unit && <span className="text-xs text-gray-500">{k.unit}</span>}
              </div>
            </div>
          ))}
        </motion.section>

        {/* Daily Alerts */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="card-title">Daily Alerts</div>
              <h2 className="text-lg font-semibold mt-1">Recurring blends & EOD reminders</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={()=>setAlertsEdit(e=>!e)}>{alertsEdit?"Done":"Edit"}</button>
              {alertsEdit && alerts.length < 8 && <button className="btn" onClick={addAlert}><Plus size={16}/>Add</button>}
            </div>
          </div>

          {visibleAlerts.length === 0 && !alertsEdit ? (
            <div className="mt-4 card text-sm text-gray-300">No Alerts Today 🎉</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleAlerts.map(a => {
                const st = alertsCheck[a.id] || { done:false, ts:null };
                return (
                  <div key={a.id} className="card">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="h-4 w-4 mt-1 accent-emerald-500" checked={!!st.done} onChange={()=>toggleAlert(a.id)} />
                      <div className="flex-1">
                        {alertsEdit ? (
                          <div className="space-y-2">
                            <input className="input" placeholder="Title (e.g., SHB)" value={a.title} onChange={(e)=>updateAlert(a.id,"title",e.target.value)} />
                            <input className="input" placeholder="Schedule (e.g., M-W-F after workout — 50 IU)" value={a.plan} onChange={(e)=>updateAlert(a.id,"plan",e.target.value)} />
                            <div className="text-xs text-gray-500">Detected days: {extractDaysFromPlan(a.plan).join(", ") || "—"}</div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                              <span>Done @ {st.ts ?? "—"}</span>
                              <button className="btn" onClick={()=>deleteAlert(a.id)}><Trash2 size={16}/>Delete</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="card-title">{a.title || "Untitled"}</div>
                            <div className="mt-2 text-sm text-gray-300">{a.plan || "Add schedule…"}</div>
                            <div className="mt-2 text-xs text-gray-500">Done @ {st.ts ?? "—"}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={saveToday}><Save size={16}/> Save Today</button>
            <button className="btn" onClick={markAllComplete}>Mark All Complete</button>
          </div>
        </motion.section>

        {/* Daily Schedule */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Daily Schedule</div>
              <h2 className="text-lg font-semibold mt-1">Protocol Overview</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={()=>setEditMode(e=>!e)}>{editMode?"Done":"Edit"}</button>
              {editMode && <button className="btn" onClick={resetRows}>Reset to Default</button>}
              {!editMode && <span className="badge">Tap checkboxes to log</span>}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Time</th>
                  <th>Compound</th>
                  <th>Dose (IU)</th>
                  <th>Dose (mg)</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th className="text-right">Done @</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => {
                  const st = checklist[row.id] || { done:false, ts:null };
                  const pulsing = lastPulsedId === row.id ? "row-pulse" : "";
                  const daysStr = Array.isArray(row.days) && row.days.length ? ` (Days: ${row.days.join(", ")})` : "";
                  return (
                    <tr key={row.id} className={pulsing}>
                      <td><input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={!!st.done} onChange={()=>toggleRow(row.id, st.done)} /></td>
                      <td className="whitespace-nowrap">{row.time}</td>
                      <td className="font-medium">{row.compound}</td>
                      <td>{editMode ? <input className="input" value={row.doseIU ?? ""} onChange={(e)=>updateRow(row.id,"doseIU",e.target.value)} /> : row.doseIU}</td>
                      <td>{editMode ? <input className="input" value={row.doseMg ?? ""} onChange={(e)=>updateRow(row.id,"doseMg",e.target.value)} /> : row.doseMg}</td>
                      <td><span className="badge">{row.category}</span></td>
                      <td>
                        {editMode ? (
                          <div className="grid gap-2">
                            <input className="input" value={row.notes ?? ""} onChange={(e)=>updateRow(row.id,"notes",e.target.value)} />
                            {row.time === "Weekly" && (
                              <input className="input" placeholder="Days (e.g., Mon,Fri)" value={Array.isArray(row.days)?row.days.join(", "):""} onChange={(e)=>updateRow(row.id,"days",e.target.value)} />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">{row.notes}{daysStr}</span>
                        )}
                      </td>
                      <td className="text-right text-xs text-gray-500">{st.ts ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Trends */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between">
            <div><div className="card-title">Trends</div><h2 className="text-lg font-semibold mt-1">Weight / Sleep / Energy (last 14 days)</h2></div>
            <span className="badge">Auto from History</span>
          </div>
          <div className="grid gap-6 mt-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="weight" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="sleep" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="energy" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.section>

        {/* Notes */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="card-title">Notes</div>
          <p className="mt-2 text-sm text-gray-300">Educational use only — not medical advice. For personal guidance, consult a licensed clinician.</p>
        </motion.section>
      </main>

      {/* Floating buttons (moved up) */}
      <button
        className="fixed bottom-32 right-5 z-20 px-5 py-3 rounded-full shadow-lg
                   bg-gradient-to-r from-fuchsia-600 to-blue-500
                   hover:from-fuchsia-500 hover:to-blue-400
                   text-white font-semibold flex items-center gap-2"
        onClick={openBigBrain}
        title="Copies today’s context & opens ChatGPT"
      >
        🧠 Big Brain
      </button>

      <button
        className="fixed bottom-16 right-5 z-20 px-4 py-3 rounded-2xl shadow-lg
                   bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white flex items-center gap-2"
        onClick={()=>setGptOpen(true)}
        title="Peptide GPT"
      >
        <Brain size={18}/> Peptide GPT
      </button>

      {/* Slide-over Peptide GPT */}
      {gptOpen && (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setGptOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-neutral-950 border-l border-neutral-800 flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2"><Brain className="text-fuchsia-400" size={18}/><div className="font-semibold">Peptide GPT</div></div>
              <div className="flex items-center gap-2">
                {isMutedToday()
                  ? <button className="btn" onClick={clearMute} title="Show cautions again">Unmute Cautions</button>
                  : <button className="btn" onClick={muteForToday} title="Hide caution messages for today">Mute Cautions (Today)</button>}
                <button className="btn" onClick={()=>setGptOpen(false)}><X size={16}/>Close</button>
              </div>
            </div>

            <div className="p-3 border-b border-neutral-900">
              {isMutedToday() || conflictFindings.length === 0 ? (
                <div className="text-xs text-gray-400">{isMutedToday() ? "Cautions are muted for today." : "No stack cautions detected for today’s items."}</div>
              ) : (
                <div className="space-y-2">
                  {conflictFindings.map(c => (
                    <div key={c.id} className={`flex items-center gap-2 p-2 rounded-lg border ${c.level==="warning"?"border-red-500/60":c.level==="caution"?"border-amber-500/60":"border-yellow-500/40"}`}>
                      <AlertTriangle size={14} className={`${c.level==="warning"?"text-red-400":c.level==="caution"?"text-amber-400":"text-yellow-300"}`} />
                      <div className="text-xs"><span className="font-medium mr-1">{c.title}</span><span className="text-gray-300">{c.explain}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chat.map((m,i)=>(
                <div key={i} className={`text-sm ${m.role==="user"?"text-white":"text-gray-300"}`}>
                  {m.role==="user"?<div className="font-semibold mb-1">You</div>:<div className="text-xs text-gray-500 mb-1">Agent</div>}
                  <pre className="whitespace-pre-wrap leading-relaxed">{m.text}</pre>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-neutral-800 flex items-center gap-2">
              <input className="input flex-1" placeholder='Ask e.g., "AOD dosing?" or "What is MOTs?"' value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter") submitChat(); }} />
              <button className="btn" onClick={submitChat}><Send size={16}/>Send</button>
            </div>
            <div className="px-4 pb-4 text-[11px] text-gray-500">
              Try aliases like <span className="text-gray-300">AOD</span>, <span className="text-gray-300">MOTs</span>, <span className="text-gray-300">TB500</span>, or <span className="text-gray-300">CJC IPA</span>. Educational info only.
            </div>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-gray-500">
        <div className="border-t border-neutral-900 pt-6">© {new Date().getFullYear()} Mike Carr — Tactical Peptides</div>
      </footer>
    </div>
  );
}
