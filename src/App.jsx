import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { CheckCircle2, Clock3, Save, Sparkles } from "lucide-react";

const KEY_HISTORY = "mpr-history";
const KEY_KPIS = "mpr-kpis";

// helpers
const todayKey = () => new Date().toISOString().slice(0, 10);
const load = (k, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export default function App() {
  // ---- Prefilled schedule (tweak anytime) ----
  const defaultSchedule = [
    { id: "tesa",   name: "Tesamorelin",           dose: "0.5–1.0 mg", time: "10:00 PM", status: "EOD / PM" },
    { id: "cjcipa", name: "CJC-1295 / Ipamorelin", dose: "40 units",   time: "AM",       status: "AM" },
    { id: "klow",   name: "KLOW 80 + extras",      dose: "BPC+TB500+GHK+KPV", time: "Post-WO", status: "Daily" },
    { id: "dsip",   name: "DSIP",                  dose: "0.5 mg",     time: "Bed",     status: "PM" },
  ];
  const [schedule] = useState(defaultSchedule);

  // ---- Today’s repair stack quick editor ----
  const [todayDose, setTodayDose] = useState({
    bpc157: 1.0, tb500: 1.0, ghkcu: 2.5, kpv: 0.5,
  });

  // ---- KPI state (with localStorage) ----
  const [kpis, setKpis] = useState(() =>
    load(KEY_KPIS, { weight: "", sleep: "", waist: "", energy: "" })
  );
  useEffect(() => save(KEY_KPIS, kpis), [kpis]);

  // ---- Checklist for today ----
  const [checklist, setChecklist] = useState(() =>
    Object.fromEntries(defaultSchedule.map(s => [s.id, { done: false, ts: null }]))
  );

  // ---- History (persisted) ----
  const [history, setHistory] = useState(() => load(KEY_HISTORY, []));
  useEffect(() => save(KEY_HISTORY, history), [history]);

  const chartData = useMemo(() =>
    history.slice(-14).map(h => ({
      date: h.date.slice(5), // MM-DD
      weight: h.kpis?.weight ? Number(h.kpis.weight) : null,
      sleep:  h.kpis?.sleep  ? Number(h.kpis.sleep)  : null,
      energy: h.kpis?.energy ? Number(h.kpis.energy) : null
    }))
  , [history]);

  const markItem = (id) => {
    setChecklist(prev => {
      const next = {
        ...prev,
        [id]: { done: !prev[id].done, ts: !prev[id].done ? new Date().toLocaleTimeString() : null }
      };
      return next;
    });
  };

  const saveToday = () => {
    setHistory(prev => {
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
    const allDone = Object.fromEntries(schedule.map(s => [s.id, { done: true, ts: new Date().toLocaleTimeString() }]));
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
        {/* KPIs (NOW WITH PULSE) */}
        <motion.section
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          {[
            { key: "weight", label: "Weight", hint: "tap to add", unit: "lb" },
            { key: "sleep",  label: "Sleep (hrs)", hint: "track nightly", unit: "h" },
            { key: "waist",  label: "Waist (in)", hint: "weekly", unit: "in" },
            { key: "energy", label: "Energy", hint: "1–10", unit: "" },
          ].map((k) => (
            <div
              key={k.key}
              className={`card transition ${kpis[k.key] !== "" ? "kpi-pulse" : ""}`}
            >
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
        <motion.section className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
        <motion.section className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Today’s Checklist</div>
              <h2 className="text-lg font-semibold mt-1">Tap to toggle</h2>
            </div>
            <span className="badge">Auto-timestamp</span>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {schedule.map((row) => {
              const st = checklist[row.id] || { done: false, ts: null };
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
        <motion.section className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
                <tr><th>Peptide</th><th>Dose</th><th>Time</th><th>Status</th></tr>
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

        {/* Charts */}
        <motion.section className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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

        {/* Notes */}
        <motion.section className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
