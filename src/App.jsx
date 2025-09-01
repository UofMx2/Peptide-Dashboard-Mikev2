import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Sparkles, Brain, X } from "lucide-react";

/* ============================== storage helpers ============================== */
const KEY_HISTORY = "mpr-history";
const KEY_KPIS = "mpr-kpis";
const KEY_ALERTS = "mpr-alerts";
const KEY_DONE_PREFIX = "mpr-done-"; // + YYYY-MM-DD

const todayKey = () => new Date().toISOString().slice(0, 10);
const load = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const loadDoneFor = (dateKey) => load(KEY_DONE_PREFIX + dateKey, []);
const saveDoneFor = (dateKey, ids) => save(KEY_DONE_PREFIX + dateKey, ids);

/* ================================= utilities ================================= */
function resetAllData() {
  localStorage.removeItem(KEY_HISTORY);
  localStorage.removeItem(KEY_KPIS);
  localStorage.removeItem(KEY_ALERTS);
  // clear all done-* keys
  Object.keys(localStorage)
    .filter((k) => k.startsWith(KEY_DONE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  window.location.reload();
}

function formatClockFull(d = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/* ============================== demo KPI seeding ============================= */
function seedDemoDataIfEmpty() {
  const hasH = !!localStorage.getItem(KEY_HISTORY);
  const hasK = !!localStorage.getItem(KEY_KPIS);
  if (hasH || hasK) return null;

  const baseKpis = { weight: "218", sleep: "6", waist: "34", energy: "7" };

  const days = 21;
  const out = [];
  const rng = (base, spread = 1, decimals = 1) => {
    const v = base + (Math.random() * 2 - 1) * spread;
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  };

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const progress = (days - i) / days;
    const weightBase = 219.5 - progress * 2.0;
    const waistBase = 34.4 - progress * 0.4;

    out.push({
      date: key,
      kpis: {
        weight: String(rng(key === todayKey() ? 218 : weightBase, 0.6, 1)),
        sleep: String(rng(6, 1.5, 1)),
        waist: String(rng(key === todayKey() ? 34 : waistBase, 0.25, 2)),
        energy: String(Math.max(1, Math.min(10, Math.round(rng(7, 2, 0))))),
      },
    });
  }

  save(KEY_HISTORY, out);
  save(KEY_KPIS, baseKpis);
  return { history: out, kpis: baseKpis };
}

/* ========================= Daily Alerts helpers & UI ========================= */
// Patterns we support in editor: Daily, EOD, MWF, TuThSa, MTWThF, Sat, Sun, etc.
// Internally we store:
// { id, name, dose, note, pattern: "MWF"|"TuThSa"|"Daily"|"EOD", start:string(YYYY-MM-DD) }
const DEFAULT_ALERTS = [
  { id: "shb", name: "Super Human Blend", dose: "50 IU", note: "post-WO", pattern: "MWF", start: todayKey() },
  { id: "ss",  name: "Super Shredded",   dose: "50 IU", note: "AM",      pattern: "TuThSa", start: todayKey() },
  { id: "fb",  name: "Fat Blaster",       dose: "50 IU", note: "AM",      pattern: "MTWThF", start: todayKey() },
];

const dayCode = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
const patternToDays = (pattern) => {
  if (!pattern || pattern === "Daily") return [0,1,2,3,4,5,6];
  if (pattern === "MTWThF") return [1,2,3,4,5];
  if (pattern === "MWF") return [1,3,5];
  if (pattern === "TuThSa") return [2,4,6];
  if (pattern === "Sa") return [6];
  if (pattern === "Sun") return [0];
  // fall back: parse tokens "M W F"
  const tokens = pattern.split(/[^\w]+/).filter(Boolean);
  const map = { Su:0, Sun:0, M:1, Mon:1, Tu:2, Tue:2, W:3, Wed:3, Th:4, Thu:4, F:5, Fri:5, Sa:6, Sat:6 };
  const days = tokens.map((t)=>map[t]).filter((n)=>n>=0);
  return days.length?days:[0,1,2,3,4,5,6];
};

function isEODDue(startIso, date = new Date()) {
  const start = new Date(startIso ?? todayKey());
  const diffDays = Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()) -
    Date.UTC(start.getFullYear(),start.getMonth(),start.getDate())) / 86400000);
  return diffDays % 2 === 0;
}

function isAlertDueToday(alert, date = new Date()) {
  if (alert.pattern === "EOD") return isEODDue(alert.start, date);
  const dow = date.getDay(); // 0=Sun
  const days = patternToDays(alert.pattern);
  return days.includes(dow);
}

/* ============================== on-device mini KB ============================ */
const MINI_KB = {
  "aod-9604": {
    what: "Fragment of GH thought to affect fat metabolism.",
    cautions: "Limited evidence; watch expectations and overlap with other fat-loss stimulatory protocols.",
  },
  "tesamorelin": {
    what: "GHRH analog that increases GH; used for GH/IGF pulse support.",
    cautions: "Can increase water retention; space from other GH secretagogues to avoid overloading pulses.",
  },
  "cjc-1295": {
    what: "GHRH analog; often paired with Ipamorelin.",
    cautions: "Stacking multiple secretagogues may over-stimulate GH/IGF pulses. Consider AM/PM split or alternating days.",
  },
  "ipamorelin": {
    what: "Ghrelin receptor agonist; secretagogue supporting GH release.",
    cautions: "Avoid over-stacking with other pulse drivers; watch edema/CTS risk.",
  },
  "survodutide": {
    what: "GLP-1/GCG co-agonist; appetite & weight control.",
    cautions: "Overlap with other GLP-1s can increase GI sides; hydrate and monitor nutrition.",
  },
};

function answerMiniKB(q) {
  const text = q.toLowerCase();
  const keys = Object.keys(MINI_KB);
  const keyHit = keys.find((k) => text.includes(k) || text.replace(/[^a-z0-9]/g,"").includes(k.replace(/[^a-z0-9]/g,"")));
  let res = keyHit
    ? `**${keyHit.toUpperCase()}**\nWhat: ${MINI_KB[keyHit].what}\nCautions: ${MINI_KB[keyHit].cautions}`
    : "I didn’t recognize a specific peptide. Try asking about “Tesamorelin”, “CJC-1295”, “AOD-9604”, etc.";
  // Simple caution if stacking multiple secretagogues
  if (/(tesamorelin|cjc|ipamorelin).*(tesamorelin|cjc|ipamorelin)/i.test(q)) {
    res += `\n\n⚠️ *Stack cautions:* Multiple GH secretagogues together can over-load GH/IGF pulses. Consider AM/PM split or alternating days to reduce edema/CTS risk.`;
  }
  return res;
}

/* =================================== APP =================================== */
export default function App() {
  // Seed demo KPIs on first load
  const seeded = seedDemoDataIfEmpty();

  const [clock, setClock] = useState(formatClockFull());
  useEffect(() => {
    const t = setInterval(() => setClock(formatClockFull()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ------------ KPIs & history (shown at bottom; seeded with demo) ----------- */
  const [kpis, setKpis] = useState(() =>
    load(KEY_KPIS, seeded?.kpis ?? { weight: "", sleep: "", waist: "", energy: "" })
  );
  useEffect(() => save(KEY_KPIS, kpis), [kpis]);

  const [history, setHistory] = useState(() =>
    load(KEY_HISTORY, seeded?.history ?? [])
  );
  useEffect(() => save(KEY_HISTORY, history), [history]);

  const chartData = useMemo(
    () =>
      history.slice(-14).map((h) => ({
        date: h.date.slice(5),
        weight: h.kpis?.weight ? Number(h.kpis.weight) : null,
        sleep: h.kpis?.sleep ? Number(h.kpis.sleep) : null,
        energy: h.kpis?.energy ? Number(h.kpis.energy) : null,
      })),
    [history]
  );

  const saveTodayKPIs = () => {
    setHistory((prev) => {
      const key = todayKey();
      const idx = prev.findIndex((r) => r.date === key);
      const record = { date: key, kpis: { ...kpis } };
      const next = [...prev];
      if (idx >= 0) next[idx] = { ...next[idx], ...record };
      else next.push(record);
      return next;
    });
  };

  /* --------------------------- Daily Alerts state/UI -------------------------- */
  const [alerts, setAlerts] = useState(() => load(KEY_ALERTS, DEFAULT_ALERTS));
  useEffect(() => save(KEY_ALERTS, alerts), [alerts]);

  const [doneToday, setDoneToday] = useState(() => loadDoneFor(todayKey()));
  useEffect(() => saveDoneFor(todayKey(), doneToday), [doneToday]);

  const dueAlerts = useMemo(
    () => alerts.filter((a) => isAlertDueToday(a, new Date())),
    [alerts]
  );

  const toggleDone = (id) =>
    setDoneToday((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const markAllComplete = () =>
    setDoneToday((prev) => Array.from(new Set([...prev, ...dueAlerts.map((a) => a.id)])));

  // Edit drawer
  const [showEdit, setShowEdit] = useState(false);
  const updateAlertField = (id, field, value) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const addAlert = () =>
    setAlerts((prev) =>
      prev.length >= 8
        ? prev
        : [...prev, { id: Math.random().toString(36).slice(2, 7), name: "", dose: "", note: "", pattern: "Daily", start: todayKey() }]
    );
  const removeAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  /* ---------------------------- Peptide GPT drawer --------------------------- */
  const [showGPT, setShowGPT] = useState(false);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const ask = () => setA(answerMiniKB(q));
  const openBigBrain = () =>
    window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer");

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* HEADER */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/50 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-3 items-center">
          {/* Left: title */}
          <div className="justify-self-start">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              Mike’s Peptide Ride <span className="text-pink-400">🚀</span>
              <motion.span
                className="inline-flex"
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ repeat: Infinity, repeatType: "mirror", duration: 2 }}
              >
                <Sparkles size={18} className="text-fuchsia-400" />
              </motion.span>
            </h1>
          </div>

          {/* Middle: clock */}
          <div className="justify-self-center text-xs sm:text-sm font-medium text-gray-200">
            {clock}
          </div>

          {/* Right: slim buttons */}
          <div className="justify-self-end flex items-center space-x-2 pr-1">
            <a
              className="px-2.5 py-1 rounded-md text-xs sm:text-sm bg-neutral-800/80 hover:bg-neutral-700 text-gray-200 shadow"
              href="https://researchdosing.com/dosing-information/"
              target="_blank"
              rel="noreferrer"
            >
              Pep Research
            </a>
            <button
              className="px-2.5 py-1 rounded-md text-xs sm:text-sm bg-neutral-800/80 hover:bg-neutral-700 text-gray-200 shadow"
              onClick={() => {
                if (window.confirm("This will clear KPIs, alerts and history on THIS device only. Proceed?")) {
                  resetAllData();
                }
              }}
            >
              Reset Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING ACTIONS (bottom-right) */}
      <button
        onClick={() => setShowGPT(true)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 px-4 py-3 rounded-2xl shadow-lg bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white flex items-center gap-2"
      >
        <Brain size={18} /> Peptide GPT
      </button>
      <button
        onClick={openBigBrain}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-20 px-5 py-3 rounded-full shadow-lg bg-gradient-to-r from-fuchsia-600 to-blue-500 text-white font-semibold"
      >
        🧠 Big Brain
      </button>

      {/* MAIN */}
      <main className="mx-auto max-w-7xl px-4 py-6 grid gap-6">
        {/* DAILY ALERTS */}
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Daily Alerts</div>
              <p className="text-sm text-gray-400">
                Recurring blends & EOD reminders (only shows items due today)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setShowEdit(true)}>Edit</button>
              <button className="btn" onClick={markAllComplete}>Mark All Complete</button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {dueAlerts.length === 0 ? (
              <div className="badge">No Alerts Today 🎉</div>
            ) : (
              dueAlerts.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-fuchsia-500"
                      checked={doneToday.includes(a.id)}
                      onChange={() => toggleDone(a.id)}
                    />
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-gray-400">
                        {a.dose || "—"} · {a.pattern} {a.note ? `· ${a.note}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.pattern === "EOD" ? "Every other day" : patternToDays(a.pattern).map(d=>dayCode[d]).join(" ")}
                  </div>
                </label>
              ))
            )}
          </div>
        </section>

        {/* DAILY SCHEDULE (example table you can edit later) */}
        <section className="card">
          <div className="card-title">Daily Schedule</div>
          <div className="overflow-x-auto mt-3">
            <table className="table text-sm sm:text-base">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Compound</th>
                  <th>Dose (IU)</th>
                  <th>Dose (mg)</th>
                  <th>Category</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Morning (Fast)</td><td>MOTs-C</td><td>15</td><td>2.0</td><td>Mito / Energy</td><td>SubQ</td></tr>
                <tr><td>Morning (Fast)</td><td>AOD-9604</td><td>15</td><td>0.5</td><td>Fat Loss</td><td>SubQ</td></tr>
                <tr><td>Workout</td><td>KLOW 80</td><td>40</td><td>—</td><td>Tissue Repair</td><td>SubQ</td></tr>
                <tr><td>Night</td><td>Tesamorelin</td><td>10</td><td>1.0</td><td>GH / Recovery</td><td>SubQ, 2–3h after last meal</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* NOTES */}
        <section className="card">
          <div className="card-title">Notes</div>
          <p className="mt-2 text-sm text-gray-300">
            Educational use only — not medical advice.
          </p>
        </section>

        {/* ====== KPIs + TRENDS (moved to bottom) ====== */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "weight", label: "WEIGHT", hint: "tap to add", unit: "lb" },
            { key: "sleep", label: "SLEEP (hrs)", hint: "track nightly", unit: "h" },
            { key: "waist", label: "WAIST (in)", hint: "weekly", unit: "in" },
            { key: "energy", label: "ENERGY", hint: "1–10", unit: "" },
          ].map((k) => (
            <div key={k.key} className="card">
              <div className="card-title">{k.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <input
                  className="input min-h-10"
                  placeholder={k.hint}
                  value={kpis[k.key]}
                  onChange={(e) => setKpis((v) => ({ ...v, [k.key]: e.target.value }))}
                />
                {k.unit && <span className="text-xs text-gray-500">{k.unit}</span>}
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2">
          <button className="btn min-h-10" onClick={saveTodayKPIs}>Save Today</button>
        </div>

        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Trends</div>
              <h2 className="text-lg font-semibold mt-1">Weight / Sleep / Energy (last 14 days)</h2>
            </div>
            <span className="badge">Auto from History</span>
          </div>

          <div className="grid gap-6 mt-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sleep" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="energy" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </main>

      {/* ====================== EDIT ALERTS DRAWER ====================== */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur"
          >
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Daily Alerts (max 8)</h3>
                <button className="icon-btn" onClick={() => setShowEdit(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                {alerts.map((a) => (
                  <div key={a.id} className="rounded-xl border border-neutral-800 p-3 grid gap-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        className="input"
                        placeholder="Name (e.g., Super Human Blend)"
                        value={a.name}
                        onChange={(e) => updateAlertField(a.id, "name", e.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Dose (e.g., 50 IU)"
                        value={a.dose}
                        onChange={(e) => updateAlertField(a.id, "dose", e.target.value)}
                      />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <input
                        className="input"
                        placeholder="Pattern (Daily, EOD, MWF, TuThSa, MTWThF, Sat, Sun)"
                        value={a.pattern}
                        onChange={(e) => updateAlertField(a.id, "pattern", e.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Note (e.g., AM, post-WO)"
                        value={a.note}
                        onChange={(e) => updateAlertField(a.id, "note", e.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Start date (YYYY-MM-DD for EOD)"
                        value={a.start || ""}
                        onChange={(e) => updateAlertField(a.id, "start", e.target.value)}
                      />
                    </div>
                    <div className="text-right">
                      <button className="badge hover:bg-red-600/80" onClick={() => removeAlert(a.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button className="btn" onClick={addAlert}>Add Alert</button>
                <button className="btn" onClick={() => setShowEdit(false)}>Done</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================== PEPTIDE GPT DRAWER ====================== */}
      <AnimatePresence>
        {showGPT && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur"
          >
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain size={18} /> Peptide GPT (on-device mini helper)
                </h3>
                <button className="icon-btn" onClick={() => setShowGPT(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                <textarea
                  className="input h-28"
                  placeholder="Ask about AOD-9604, Tesamorelin, CJC-1295 + Ipamorelin, etc."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button className="btn" onClick={ask}>Ask</button>
                  <button className="btn" onClick={() => { setQ(""); setA(""); }}>Clear</button>
                </div>
                {a && (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 whitespace-pre-wrap text-sm">
                    {a}
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  Tip: I’m offline by design — safe for quick lookups. For deep dive, use <span className="underline cursor-pointer" onClick={openBigBrain}>Big Brain</span>.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================== minimal utility CSS via Tailwind =============================

Assumes you have your Tailwind layer with these small utility classes (from earlier):
.card, .card-title, .btn, .badge, .input, .icon-btn, .table etc.
If not, keep your existing index.css as we set before.

*/
