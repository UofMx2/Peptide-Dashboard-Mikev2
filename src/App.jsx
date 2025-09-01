import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { Save, Sparkles, Plus, Trash2 } from "lucide-react";

// ----- persistence keys -----
const KEY_HISTORY = "mpr-history";
const KEY_KPIS    = "mpr-kpis";

// ----- helpers -----
const todayKey = () => new Date().toISOString().slice(0, 10);
const load = (k, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// === Daily Schedule rows ===
// Weekly items include a `days` array and only show on those days.
const DEFAULT_STACK_ROWS = [
  // Morning (Fast)
  { id: "motsc",   time: "Morning (Fast)", compound: "MOTs-C",                        doseIU: "15",  doseMg: "2.0",       category: "Mitochondrial / Energy", notes: "SubQ" },
  { id: "aod9604", time: "Morning (Fast)", compound: "AOD-9604",                      doseIU: "15",  doseMg: "0.5",       category: "Fat Loss",               notes: "SubQ" },
  { id: "nadlcarn",time: "Morning (Fast)", compound: "NAD+ + L-Carn",                 doseIU: "100", doseMg: "—",         category: "Energy / Mitochondrial", notes: "SubQ" },

  // GH / Recovery (AM)
  { id: "cjcipa",  time: "AM",              compound: "CJC-1295 (no DAC) + Ipamorelin", doseIU: "10", doseMg: "1.0",       category: "GH / Recovery",          notes: "SubQ, empty stomach" },

  // Workout / AM Rest
  { id: "klow80",  time: "Workout / AM Rest", compound: "KLOW 80",                   doseIU: "40",  doseMg: "—",          category: "Tissue Repair",          notes: "SubQ" },
  { id: "bpc_tb",  time: "Workout / AM Rest", compound: "BPC-157 + TB-500 combo",    doseIU: "10",  doseMg: "0.2 each",   category: "Tissue Repair",          notes: "SubQ" },

  // Night
  { id: "tesa",    time: "Night (10 PM)",   compound: "Tesamorelin",                 doseIU: "10",  doseMg: "1.0",        category: "GH / Recovery",          notes: "SubQ, 2–3h after last meal" },
  { id: "dsip",    time: "Night (10 PM)",   compound: "DSIP",                        doseIU: "10",  doseMg: "0.1",        category: "Sleep / Recovery",       notes: "SubQ" },
  { id: "mel_lo",  time: "Night (10 PM)",   compound: "Melatonin – Lights Out",      doseIU: "—",   doseMg: "0.5 mL",     category: "Sleep",                  notes: "SubQ" },

  // Weekly (shown only on listed days)
  { id: "survo",   time: "Weekly",          compound: "Survodutide",                 doseIU: "40",  doseMg: "2.4",        category: "Fat Loss / Metabolic",   notes: "SubQ", days: ["Sat"] },
  { id: "testc",   time: "Weekly",          compound: "Testosterone Cypionate",      doseIU: "—",   doseMg: "200 mg Mon PM + 200 mg Fri AM", category: "Hormone", notes: "IM", days: ["Mon","Fri"] },
  { id: "trenE",   time: "Weekly",          compound: "Trenbolone Enanthate",        doseIU: "—",   doseMg: "100 mg Wed PM + 100 mg Sun AM", category: "Hormone", notes: "IM", days: ["Wed","Sun"] },
];

// === Daily Alerts (editable cards with a checkbox each) ===
const DEFAULT_ALERTS = [
  { id: "alrt1", title: "Super Human Blend (SHB)", plan: "M-W-F after workout — 50 IU" },
  { id: "alrt2", title: "Super Shredded (SS)",     plan: "Tu-Th-Sat morning — 50 IU" },
  { id: "alrt3", title: "Fat Blaster",             plan: "Mon-Thu-Sat — 50 IU" },
];

export default function App() {
  // --- Live clock ---
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const clockFmt = useMemo(() => {
    const parts = new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "2-digit", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short"
    }).formatToParts(now);
    const get = (type) => parts.find(p => p.type === type)?.value || "";
    return `${get("weekday")} • ${get("month")} ${get("day")}, ${get("year")} — ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod")} ${get("timeZoneName")}`.replace(/\s+/g," ").trim();
  }, [now]);
  const todayDowShort = DOW_SHORT[now.getDay()];

  // --- KPI state (persisted) ---
  const [kpis, setKpis] = useState(() =>
    load(KEY_KPIS, { weight: "", sleep: "", waist: "", energy: "" })
  );
  useEffect(() => save(KEY_KPIS, kpis), [kpis]);

  // --- Daily Alerts (editable + checkbox per alert) ---
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
  const updateAlert = (id, field, value) =>
    setAlerts(a => a.map(x => x.id === id ? { ...x, [field]: value } : x));
  const deleteAlert = (id) => {
    setAlerts(a => a.filter(x => x.id !== id));
    setAlertsCheck(({ [id]: _remove, ...rest }) => rest);
  };
  const toggleAlert = (id) => {
    setAlertsCheck(prev => {
      const nextDone = !prev[id]?.done;
      return {
        ...prev,
        [id]: { done: nextDone, ts: nextDone ? new Date().toLocaleTimeString() : null }
      };
    });
  };

  // --- Editable daily schedule rows ---
  const [rows, setRows] = useState(DEFAULT_STACK_ROWS);
  const resetRows = () => setRows(DEFAULT_STACK_ROWS);

  // --- Checklist for schedule table ---
  const [checklist, setChecklist] = useState(() =>
    Object.fromEntries(DEFAULT_STACK_ROWS.map(r => [r.id, { done:false, ts:null }]))
  );

  // Pulse the most recently toggled schedule row
  const [lastPulsedId, setLastPulsedId] = useState(null);
  const toggleRow = (rowId, current) => {
    const next = !current;
    setChecklist(prev => ({
      ...prev,
      [rowId]: { done: next, ts: next ? new Date().toLocaleTimeString() : null }
    }));
    setLastPulsedId(rowId);
    setTimeout(() => setLastPulsedId(null), 700);
  };

  // --- Inline edit mode for table ---
  const [editMode, setEditMode] = useState(false);
  const updateRow = (id, field, value) => {
    if (field === "days") {
      const arr = value.split(",").map(s => s.trim()).filter(Boolean).map(s => {
        const t = s.slice(0,3).toLowerCase();
        return t === "sun" ? "Sun" :
               t === "mon" ? "Mon" :
               t === "tue" ? "Tue" :
               t === "wed" ? "Wed" :
               t === "thu" ? "Thu" :
               t === "fri" ? "Fri" :
               t === "sat" ? "Sat" : s;
      });
      setRows(prev => prev.map(r => (r.id === id ? { ...r, days: arr } : r)));
      return;
    }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // --- History (persisted) ---
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
      const record = {
        date: todayKey(),
        kpis: { ...kpis },
        rows: rows,                 // snapshot of edited schedule rows
        checklist: { ...checklist },// schedule check states
        alerts: alerts,             // snapshot of alert cards
        alertsCheck: { ...alertsCheck }, // alert check states
      };
      const next = [...prev];
      if (idx >= 0) next[idx] = record; else next.push(record);
      return next;
    });
  };

  const markAllComplete = () => {
    const allRows = Object.fromEntries(rows.map(r => [r.id, { done:true, ts:new Date().toLocaleTimeString() }]));
    const allAlerts = Object.fromEntries(alerts.map(a => [a.id, { done:true, ts:new Date().toLocaleTimeString() }]));
    setChecklist(allRows);
    setAlertsCheck(allAlerts);
    setTimeout(saveToday, 50);
  };

  // --- Filter Weekly rows to today's day ---
  const visibleRows = useMemo(() => {
    return rows.filter(r => {
      if (r.time !== "Weekly") return true;
      if (!Array.isArray(r.days) || r.days.length === 0) return true;
      return r.days.includes(todayDowShort);
    });
  }, [rows, todayDowShort]);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/50 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-3 items-center">
          {/* Left: Title */}
          <div className="justify-self-start">
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
          </div>

          {/* Center: Live Clock */}
          <div className="justify-self-center text-sm sm:text-base font-medium text-gray-200">
            {clockFmt}
          </div>

          {/* Right: Link */}
          <div className="justify-self-end">
            <a className="btn" href="https://researchdosing.com/dosing-information/" target="_blank" rel="noreferrer">
              Dosing Reference
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 grid gap-6">
        {/* KPIs w/ pulse */}
        <motion.section
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
        >
          {[
            { key:"weight", label:"Weight", hint:"tap to add", unit:"lb" },
            { key:"sleep",  label:"Sleep (hrs)", hint:"track nightly", unit:"h" },
            { key:"waist",  label:"Waist (in)", hint:"weekly", unit:"in" },
            { key:"energy", label:"Energy", hint:"1–10", unit:"" },
          ].map(k => (
            <div key={k.key} className={`card transition ${kpis[k.key] !== "" ? "kpi-pulse" : ""}`}>
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

        {/* DAILY ALERTS (editable cards + checkbox per card) */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="card-title">Daily Alerts</div>
              <h2 className="text-lg font-semibold mt-1">Recurring blends & EOD reminders</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setAlertsEdit(e => !e)}>
                {alertsEdit ? "Done" : "Edit"}
              </button>
              {alertsEdit && alerts.length < 8 && (
                <button className="btn" onClick={addAlert}><Plus size={16}/>Add</button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts.map(a => {
              const st = alertsCheck[a.id] || { done:false, ts:null };
              return (
                <div key={a.id} className="card">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-1 accent-emerald-500"
                      checked={!!st.done}
                      onChange={() => toggleAlert(a.id)}
                      title="Mark alert complete"
                    />
                    <div className="flex-1">
                      {alertsEdit ? (
                        <div className="space-y-2">
                          <input
                            className="input"
                            placeholder="Title (e.g., SHB)"
                            value={a.title}
                            onChange={(e)=>updateAlert(a.id, "title", e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Schedule (e.g., M-W-F after workout — 50 IU)"
                            value={a.plan}
                            onChange={(e)=>updateAlert(a.id, "plan", e.target.value)}
                          />
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

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={saveToday}><Save size={16}/> Save Today</button>
            <button className="btn" onClick={markAllComplete}>Mark All Complete</button>
          </div>
        </motion.section>

        {/* DAILY SCHEDULE — table with checkbox column + inline edit */}
        <motion.section className="card" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Daily Schedule</div>
              <h2 className="text-lg font-semibold mt-1">Protocol Overview</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setEditMode(e => !e)}>
                {editMode ? "Done" : "Edit"}
              </button>
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
                      <td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-500"
                          checked={!!st.done}
                          onChange={() => toggleRow(row.id, st.done)}
                        />
                      </td>
                      <td className="whitespace-nowrap">{row.time}</td>
                      <td className="font-medium">{row.compound}</td>

                      {/* Editable cells */}
                      <td>
                        {editMode
                          ? <input className="input" value={row.doseIU ?? ""} onChange={(e)=>updateRow(row.id, "doseIU", e.target.value)} />
                          : row.doseIU}
                      </td>
                      <td>
                        {editMode
                          ? <input className="input" value={row.doseMg ?? ""} onChange={(e)=>updateRow(row.id, "doseMg", e.target.value)} />
                          : row.doseMg}
                      </td>
                      <td><span className="badge">{row.category}</span></td>
                      <td>
                        {editMode ? (
                          <div className="grid gap-2">
                            <input className="input" value={row.notes ?? ""} onChange={(e)=>updateRow(row.id, "notes", e.target.value)} />
                            {row.time === "Weekly" && (
                              <input
                                className="input"
                                placeholder="Days (e.g., Mon,Fri)"
                                value={Array.isArray(row.days) ? row.days.join(", ") : ""}
                                onChange={(e)=>updateRow(row.id, "days", e.target.value)}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">
                            {row.notes}{daysStr}
                          </span>
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

        {/* Trends from history */}
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
