import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Sparkles } from "lucide-react";

/* --------------------------- storage helpers --------------------------- */
const KEY_HISTORY = "mpr-history";
const KEY_KPIS = "mpr-kpis";

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

/* --------------------------- reset (this device only) --------------------------- */
function resetAllData() {
  localStorage.removeItem(KEY_HISTORY);
  localStorage.removeItem(KEY_KPIS);
  window.location.reload();
}

/* --------------------------- clock --------------------------- */
function formatClockFull(d = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/* --------------------------- demo seeding --------------------------- */
/** returns { history, kpis } if it seeded on a fresh device; else null */
function seedDemoDataIfEmpty() {
  const hasHistory = !!localStorage.getItem(KEY_HISTORY);
  const hasKpis = !!localStorage.getItem(KEY_KPIS);
  if (hasHistory || hasKpis) return null;

  const baseKpis = { weight: "218", sleep: "6", waist: "34", energy: "7" };

  // ~3 weeks of history with gentle trend + noise
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

    const progress = (days - i) / days; // 0..1
    const weightBase = 219.5 - progress * 2.0; // gentle down ~2 lb
    const waistBase = 34.4 - progress * 0.4;   // gentle down ~0.4 in

    const rec = {
      date: key,
      kpis: {
        weight: String(rng(key === todayKey() ? 218 : weightBase, 0.6, 1)),
        sleep: String(rng(6, 1.5, 1)), // 4.5–7.5
        waist: String(rng(key === todayKey() ? 34 : waistBase, 0.25, 2)),
        energy: String(Math.max(1, Math.min(10, Math.round(rng(7, 2, 0))))),
      },
    };
    out.push(rec);
  }

  save(KEY_HISTORY, out);
  save(KEY_KPIS, baseKpis);
  return { history: out, kpis: baseKpis };
}

/* =================================== APP =================================== */
export default function App() {
  // Seed once (first load on a fresh device) and capture values immediately
  const seeded = seedDemoDataIfEmpty();

  const [clock, setClock] = useState(formatClockFull());
  useEffect(() => {
    const t = setInterval(() => setClock(formatClockFull()), 60_000);
    return () => clearInterval(t);
  }, []);

  // KPIs
  const [kpis, setKpis] = useState(() =>
    load(KEY_KPIS, seeded?.kpis ?? { weight: "", sleep: "", waist: "", energy: "" })
  );
  useEffect(() => save(KEY_KPIS, kpis), [kpis]);

  // History + charts
  const [history, setHistory] = useState(() =>
    load(KEY_HISTORY, seeded?.history ?? [])
  );
  useEffect(() => save(KEY_HISTORY, history), [history]);

  const chartData = useMemo(
    () =>
      history.slice(-14).map((h) => ({
        date: h.date.slice(5), // MM-DD
        weight: h.kpis?.weight ? Number(h.kpis.weight) : null,
        sleep: h.kpis?.sleep ? Number(h.kpis.sleep) : null,
        energy: h.kpis?.energy ? Number(h.kpis.energy) : null,
      })),
    [history]
  );

  // Save today's KPIs into history (upsert)
  const saveToday = () => {
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
                if (
                  window.confirm(
                    "This will clear KPIs, history, and alerts on THIS device only. Are you sure?"
                  )
                ) {
                  resetAllData();
                }
              }}
            >
              Reset Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-7xl px-4 py-6 grid gap-6">
        {/* KPIs */}
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
                  onChange={(e) =>
                    setKpis((v) => ({ ...v, [k.key]: e.target.value }))
                  }
                />
                {k.unit && <span className="text-xs text-gray-500">{k.unit}</span>}
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2">
          <button className="btn min-h-10" onClick={saveToday}>
            Save Today
          </button>
        </div>

        {/* Trends */}
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Trends</div>
              <h2 className="text-lg font-semibold mt-1">
                Weight / Sleep / Energy (last 14 days)
              </h2>
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
                  <Line
                    type="monotone"
                    dataKey="weight"
                    strokeWidth={2}
                    dot={false}
                  />
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
                  <Line
                    type="monotone"
                    dataKey="energy"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Example schedule (lightweight) */}
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
                <tr>
                  <td>Morning (Fast)</td>
                  <td>MOTs-C</td>
                  <td>15</td>
                  <td>2.0</td>
                  <td>Mitochondrial / Energy</td>
                  <td>SubQ</td>
                </tr>
                <tr>
                  <td>Morning (Fast)</td>
                  <td>AOD-9604</td>
                  <td>15</td>
                  <td>0.5</td>
                  <td>Fat Loss</td>
                  <td>SubQ</td>
                </tr>
                <tr>
                  <td>Morning (Fast)</td>
                  <td>NAD+ + L-Carn</td>
                  <td>100</td>
                  <td>—</td>
                  <td>Energy / Mitochondrial</td>
                  <td>SubQ</td>
                </tr>
                <tr>
                  <td>Workout / AM Rest</td>
                  <td>KLOW 80</td>
                  <td>40</td>
                  <td>—</td>
                  <td>Tissue Repair</td>
                  <td>SubQ</td>
                </tr>
                <tr>
                  <td>Night (10 PM)</td>
                  <td>Tesamorelin</td>
                  <td>10</td>
                  <td>1.0</td>
                  <td>GH / Recovery</td>
                  <td>SubQ, 2–3h after last meal</td>
                </tr>
                <tr>
                  <td>Night (10 PM)</td>
                  <td>DSIP</td>
                  <td>10</td>
                  <td>0.1</td>
                  <td>Sleep / Recovery</td>
                  <td>SubQ</td>
                </tr>
                <tr>
                  <td>Night (10 PM)</td>
                  <td>Melatonin – Lights Out</td>
                  <td>—</td>
                  <td>0.5 mL</td>
                  <td>Sleep</td>
                  <td>SubQ</td>
                </tr>
                <tr>
                  <td>Weekly</td>
                  <td>Survodutide</td>
                  <td>40</td>
                  <td>2.4</td>
                  <td>Fat Loss / Metabolic</td>
                  <td>SubQ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Notes</div>
          <p className="mt-2 text-sm text-gray-300">
            Educational use only — not medical advice.
          </p>
        </section>
      </main>
    </div>
  );
}
