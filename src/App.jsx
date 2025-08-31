import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { CheckCircle2, Clock3, Plus, Save, Sparkles } from "lucide-react";

const KEY_HISTORY = "mpr-history";
const KEY_KPIS = "mpr-kpis";

// ---- helpers ----
const todayKey = () => new Date().toISOString().slice(0,10);
const load = (k, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export default function App() {
 // ---- 4-Week protocol (edit anytime) ----
// Meaning of fields:
// - freq: "daily", "eod" (every other day), "am", "pm", "bed", "post-wo", "rest" (skip)
// - weeks[x].days[y] holds extra per-day on/off switches for cycle work
const PROTOCOL_4W = {
  compounds: [
    { id: "tesa",   name: "Tesamorelin",           dose: "0.5–1.0 mg", time: "10:00 PM", tag: "EOD / PM",   freq: "eod" },
    { id: "cjcipa", name: "CJC-1295 / Ipamorelin", dose: "40 units",   time: "AM",       tag: "AM",         freq: "am"  },
    { id: "klow",   name: "KLOW 80 + extras",      dose: "BPC+TB500+GHK+KPV", time: "Post-WO", tag: "Daily", freq: "post-wo" },
    { id: "dsip",   name: "DSIP",                  dose: "0.5 mg",     time: "Bed",      tag: "PM",         freq: "bed" },
    // Daily tissue-repair (already editable in Today’s Stack inputs)
    { id: "bpc",    name: "BPC-157",               dose: "1.0 mg",     time: "Daily",    tag: "Daily",      freq: "daily-helper", hiddenInSchedule: true },
    { id: "tb500",  name: "TB-500",                dose: "1.0 mg",     time: "Daily",    tag: "Daily",      freq: "daily-helper", hiddenInSchedule: true },
    { id: "ghkcu",  name: "GHK-Cu",                dose: "2.5 mg",     time: "Daily",    tag: "Topical/IM", freq: "daily-helper", hiddenInSchedule: true },
    { id: "kpv",    name: "KPV",                   dose: "0.5 mg",     time: "Daily",    tag: "Daily",      freq: "daily-helper", hiddenInSchedule: true },
  ],
  // Week-by-week switches for compounds that cycle (example: Tesamorelin EOD)
  // true = active that day, false = rest
  weeks: [
    // WEEK 1
    { days: [ true,false,true,false,true,false,true ] },
    // WEEK 2
    { days: [ false,true,false,true,false,true,false ] },
    // WEEK 3
    { days: [ true,false,true,false,true,false,true ] },
    // WEEK 4
    { days: [ false,true,false,true,false,true,false ] },
  ],
};

// Helpers for protocol
const dow = new Date().getDay(); // 0=Sun..6=Sat
const weekIndexInCycle = Math.floor(
  // rotate a 28-day cycle starting on the date you began; default starts today
  ((Date.now() - new Date().setHours(0,0,0,0)) / (1000*60*60*24)) % 28 / 7
); // 0..3

// Build "today" schedule from protocol:
const buildTodaySchedule = () => {
  const week = PROTOCOL_4W.weeks[weekIndexInCycle]?.days ?? [true,true,true,true,true,true,true];
  return PROTOCOL_4W.compounds
    .filter(c => !c.hiddenInSchedule)
    .filter(c => {
      if (c.freq === "eod") return !!week[dow];    // only if today is ON in the EOD pattern
      if (c.freq === "post-wo") return true;       // leave on; you can toggle via checklist
      return true;                                 // am/pm/bed/daily always shown
    })
    .map(c => ({
      id: c.id, name: c.name, dose: c.dose, time: c.time, status: c.tag
    }));
};

const defaultSchedule = buildTodaySchedule();
const [schedule, setSchedule] = useState(defaultSchedule);


  const [schedule, setSchedule] = useState(defaultSchedule);

  // --- Today’s repair stack quick editor ---
  const [todayDose, setTodayDose] = useState({
    bpc157: 1.0, tb500: 1.0, ghkcu: 2.5, kpv: 0.5,
  });

  // --- KPI state (weight, sleep, waist, energy) ---
  const [kpis, setKpis] = useState(() => load(KEY_KPIS, {
    weight: "", sleep: "", waist: "", energy: ""
  }));

  // --- Checklist for today ---
  const [checklist, setChecklist] = useState(() =>
    Object.fromEntries(defaultSchedule.map(s => [s.id, { done:false, ts:null }]))
  );

  // --- History (persisted) ---
  const [history, setHistory] = useState(() => load(KEY_HISTORY, []));
  useEffect(() => save(KEY_HISTORY, history), [history]);
  useEffect(() => save(KEY_KPIS, kpis), [kpis]);

  // sample data for charts from history
  const chartData = useMemo(() => {
    // keep last 14 days
    return history.slice(-14).map(h => ({
      date: h.date.slice(5), // MM-DD
      weight: h.kpis?.weight ? Number(h.kpis.weight) : null,
      sleep: h.kpis?.sleep ? Number(h.kpis.sleep) : null,
      energy: h.kpis?.energy ? Number(h.kpis.energy) : null
    }));
  }, [history]);

  const markItem = (id) => {
    setChecklist(prev => {
      const next = { ...prev, [id]: { done: !prev[id].done, ts: !prev[id].done ? new Date().toLocaleTimeString() : null } };
      return next;
    });
  };

  const saveToday = () => {
    setHistory(prev => {
      // upsert by date
      const idx = prev.findIndex(r => r.date === todayKey());
      const record = {
        date: todayKey(),
        doses: { ...todayDose },
        checklist: { ...checklist },
        kpis: { ...kpis }
      };
      const next = [...prev];
      if (idx >= 0) next[idx] = record; else next.push(record);
      return next;
    });
  };

  const markComplete = () => {
    // mark all as done (if you want that behavior), then save
    const allDone = Object.fromEntries(schedule.map(s => [s.id, { done:true, ts:new Date().toLocaleTimeString() }]));
    setChecklist(allDone);
    setTimeout(saveToday, 50);
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/50 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            Mike’s Peptide Ride <span className="text-pink-400">🚀</span>
            <motion.span
              className="inline-flex"
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ repeat: Infinity, repeatType: "mirror", duration: 2 }}
              title="boost mode"
            >
              <Sparkles size={18} className="text-fuchsia-400" />
            </motion.span>
          </h1>
          <a className="btn" href="https://researchdosing.com/dosing-information/" target="_blank" rel="noreferrer">
            Dosing Reference
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 grid gap-6">
        {/* KPIs */}
        <motion.section
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
        >
          {[
            { key:"weight", label:"Weight", hint:"tap to add", unit:"lb" },
            { key:"sleep", label:"Sleep (hrs)", hint:"track nightly", unit:"h" },
            { key:"waist", label:"Waist (in)", hint:"weekly", unit:"in" },
            { key:"energy", label:"Energy", hint:"1–10", unit:"" },
          ].map((k) => (
            <div key={k.key} className="card">
              <div className="card-title">{k.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <input
                  className="input"
                  placeholder={k.hint}
                  value={kpis[k.key]}
                  onChange={(e) => setKpis(v => ({ ...v, [k.key]: e.target.value }))}
                />
                {k.unit && <span className="text-xs text-gray-500">{k.unit}</span>}
              </div>
            </div>
          ))}
        </motion.section>

        {/* Today’s doses quick editor */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="card-title">Today’s Repair Stack</div>
              <h2 className="text-lg font-semibold mt-1">
                BPC-157 + TB-500 + GHK-Cu + KPV
              </h2>
            </div>
            <span className="badge">Daily</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {Object.entries(todayDose).map(([key, val]) => (
              <label key={key} className="block">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{key}</div>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={val}
                  onChange={(e) => setTodayDose((t) => ({ ...t, [key]: Number(e.target.value) }))}
                />
                <div className="text-xs text-gray-500 mt-1">mg</div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="btn" onClick={saveToday}><Save size={16}/> Save Today</button>
            <button className="btn" onClick={markComplete}><CheckCircle2 size={16}/> Mark Complete</button>
          </div>
        </motion.section>

        {/* Checklist */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Today’s Checklist</div>
              <h2 className="text-lg font-semibold mt-1">Tap to toggle</h2>
            </div>
            <span className="badge">Auto-timestamp</span>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {schedule.map((row) => {
              const st = checklist[row.id] || { done:false, ts:null };
              return (
                <button
                  key={row.id}
                  className={`btn justify-between ${st.done ? "border-green-500/70" : ""}`}
                  onClick={() => markItem(row.id)}
                  title={`${row.time} • ${row.dose}`}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className={st.done ? "text-green-400" : "text-gray-500"} size={18}/>
                    <span className="font-medium">{row.name}</span>
                    <span className="badge">{row.status}</span>
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock3 size={14}/>{st.ts ?? row.time}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Schedule table */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Daily Schedule</div>
              <h2 className="text-lg font-semibold mt-1">Protocol Overview</h2>
            </div>
            <span className="badge">Editable (soon)</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Peptide</th><th>Dose</th><th>Time</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.name}</td>
                    <td>{row.dose}</td>
                    <td>{row.time}</td>
                    <td><span className="badge">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Charts from history */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
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
        </motion.section>
{/* 4-Week Planner */}
<motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
  <div className="flex items-center justify-between">
    <div>
      <div className="card-title">4-Week Planner</div>
      <h2 className="text-lg font-semibold mt-1">Cycle Map (EOD compounds highlighted)</h2>
    </div>
    <span className="badge">Auto</span>
  </div>

  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
    {Array.from({ length: 4 }).map((_, w) => {
      const days = PROTOCOL_4W.weeks[w].days;
      return (
        <div key={w} className="border border-neutral-800 rounded-xl p-3">
          <div className="text-sm font-medium text-gray-300 mb-2">Week {w+1}</div>
          <div className="grid grid-cols-7 gap-2">
            {["S","M","T","W","T","F","S"].map((dLabel, d) => {
              const on = !!days[d];
              const isToday = (w === weekIndexInCycle) && (d === dow);
              return (
                <div
                  key={d}
                  className={`text-center text-xs px-2 py-1 rounded-lg border
                    ${on ? "bg-emerald-900/30 border-emerald-600/40 text-emerald-300" : "bg-neutral-900/60 border-neutral-700 text-gray-400"}
                    ${isToday ? "ring-2 ring-fuchsia-500/50" : ""}`}
                  title={on ? "Tesamorelin ON" : "Tesamorelin Rest"}
                >
                  {dLabel}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-gray-500 mt-2">Green = Tesamorelin day (EOD). Others (CJC/IPA, DSIP, KLOW) are shown daily or by time.</div>
        </div>
      );
    })}
  </div>
</motion.section>

        {/* Notes */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="card-title">Notes</div>
          <p className="mt-2 text-sm text-gray-300">
            Examples: “Tesamorelin PM only if wrists OK”, “KLOW post-workout”, “Hydrate + electrolytes pre-bed”.
          </p>
        </motion.section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-gray-500">
        <div className="border-t border-neutral-900 pt-6">
          © {new Date().getFullYear()} Mike Carr — Tactical Peptides
        </div>
      </footer>
    </div>
  );
}
