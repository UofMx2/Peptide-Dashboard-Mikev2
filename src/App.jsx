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
          </h1
