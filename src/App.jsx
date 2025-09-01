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

/* --------------------------- storage helpers --------------------------- */
const KEY_HISTORY = "mpr-history";
const KEY_KPIS = "mpr-kpis";
const KEY_ALERTS = "mpr-alerts";
const KEY_STACK = "mpr-stack";
const KEY_DONE_PREFIX = "mpr-done-"; // + YYYY-MM-DD
const KEY_NOTES = "mpr-notes";

const todayKey = () => new Date().toISOString().slice(0, 10);
const load = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const loadDoneFor = (dateKey) => load(KEY_DONE_PREFIX + dateKey, []);
const saveDoneFor = (dateKey, ids) => save(KEY_DONE_PREFIX + dateKey, ids);

/* --------------------------- reset --------------------------- */
function resetAllData() {
  localStorage.clear();
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

/* --------------------------- demo KPI seeding --------------------------- */
function seedDemoDataIfEmpty() {
  if (localStorage.getItem(KEY_HISTORY) || localStorage.getItem(KEY_KPIS)) return null;
  const baseKpis = { weight: "218", sleep: "6", waist: "34", energy: "7" };
  const days = 21, out = [];
  const rng = (base, spread = 1, dec = 1) => {
    const v = base + (Math.random() * 2 - 1) * spread;
    const f = Math.pow(10, dec);
    return Math.round(v * f) / f;
  };
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const p = (days - i) / days;
    const weightBase = 219.5 - p * 2.0;
    const waistBase = 34.4 - p * 0.4;
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
  save(KEY_HISTORY, out); save(KEY_KPIS, baseKpis);
  return { history: out, kpis: baseKpis };
}

/* --------------------------- Daily Alerts --------------------------- */
const DEFAULT_ALERTS = [
  { id: "shb", name: "Super Human Blend", dose: "50 IU", note: "post-WO", pattern: "MWF", start: todayKey() },
  { id: "ss",  name: "Super Shredded",   dose: "50 IU", note: "AM",      pattern: "TuThSa", start: todayKey() },
  { id: "fb",  name: "Fat Blaster",      dose: "50 IU", note: "AM",      pattern: "MTWThF", start: todayKey() },
];
const dayCode = ["Su","M","Tu","W","Th","F","Sa"];
const patternToDays = (p) => {
  if (!p || p === "Daily") return [0,1,2,3,4,5,6];
  if (p === "MTWThF") return [1,2,3,4,5];
  if (p === "MWF") return [1,3,5];
  if (p === "TuThSa") return [2,4,6];
  if (p === "Sat") return [6];
  if (p === "Sun") return [0];
  const tokens = p.split(/[^\w]+/).filter(Boolean);
  const map = {Su:0,Sun:0,M:1,Mon:1,Tu:2,Tue:2,W:3,Wed:3,Th:4,Thu:4,F:5,Fri:5,Sa:6,Sat:6};
  return tokens.map(t=>map[t]).filter(n=>n>=0);
};
const isEODDue = (startIso, date=new Date()) => {
  const s = new Date(startIso??todayKey());
  const diff = Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()) -
    Date.UTC(s.getFullYear(),s.getMonth(),s.getDate()))/86400000);
  return diff % 2 === 0;
};
const isAlertDueToday = (a, d=new Date()) =>
  a.pattern==="EOD" ? isEODDue(a.start,d) : patternToDays(a.pattern).includes(d.getDay());

/* --------------------------- Stack --------------------------- */
const DEFAULT_STACK_ROWS = [
  { id:"motsc",time:"Morning (Fast)",compound:"MOTs-C",doseIU:"15",doseMg:"2.0",category:"Mito / Energy",notes:"SubQ" },
  { id:"aod9604",time:"Morning (Fast)",compound:"AOD-9604",doseIU:"15",doseMg:"0.5",category:"Fat Loss",notes:"SubQ" },
  { id:"nadlcarn",time:"Morning (Fast)",compound:"NAD+ + L-Carn",doseIU:"100",doseMg:"—",category:"Energy",notes:"SubQ" },
  { id:"klow80",time:"Workout",compound:"KLOW 80",doseIU:"40",doseMg:"—",category:"Tissue Repair",notes:"SubQ" },
  { id:"tesa",time:"Night",compound:"Tesamorelin",doseIU:"10",doseMg:"1.0",category:"GH / Recovery",notes:"SubQ 2–3h post meal" },
  { id:"dsip",time:"Night",compound:"DSIP",doseIU:"10",doseMg:"0.1",category:"Sleep",notes:"SubQ" },
  { id:"mel_lo",time:"Night",compound:"Melatonin – Lights Out",doseIU:"—",doseMg:"0.5 mL",category:"Sleep",notes:"SubQ" },
  { id:"survo",time:"Weekly",compound:"Survodutide",doseIU:"40",doseMg:"2.4",category:"Fat Loss",notes:"SubQ",days:["Sat"] },
  { id:"testc",time:"Weekly",compound:"Testosterone Cypionate",doseIU:"—",doseMg:"200 mg Mon + 200 mg Fri",category:"Hormone",notes:"IM",days:["Mon","Fri"] },
  { id:"trenE",time:"Weekly",compound:"Trenbolone Enanthate",doseIU:"—",doseMg:"100 mg Wed + 100 mg Sun",category:"Hormone",notes:"IM",days:["Wed","Sun"] },
];
const dowShort=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const todayDowShort=()=>dowShort[new Date().getDay()];

/* --------------------------- Peptide GPT mini KB --------------------------- */
const MINI_KB = {
  "aod-9604": {what:"Fragment of GH thought to affect fat metabolism.",cautions:"Limited evidence; overlap with fat-loss drivers."},
  "tesamorelin":{what:"GHRH analog boosting GH pulses.",cautions:"Watch water retention; don’t stack too many secretagogues."},
  "cjc-1295":{what:"GHRH analog; often paired with Ipamorelin.",cautions:"Stacking secretagogues risks edema/CTS."},
  "ipamorelin":{what:"Ghrelin mimetic; GH secretagogue.",cautions:"Overlap with others may overload pulses."},
};
function answerMiniKB(q){
  const t=q.toLowerCase();const k=Object.keys(MINI_KB).find(k=>t.includes(k));
  let res=k?`**${k.toUpperCase()}**\nWhat: ${MINI_KB[k].what}\nCautions: ${MINI_KB[k].cautions}`:"Not recognized. Try Tesamorelin, CJC, AOD-9604…";
  if(/(tesamorelin|cjc|ipamorelin).*(tesamorelin|cjc|ipamorelin)/i.test(q)){
    res+=`\n\n⚠️ *Caution:* stacking multiple GH secretagogues can overload pulses. Consider spacing or alt days.`;
  }
  return res;
}

/* --------------------------- App --------------------------- */
export default function App() {
  const seeded = seedDemoDataIfEmpty();
  const [clock,setClock]=useState(formatClockFull());
  useEffect(()=>{const t=setInterval(()=>setClock(formatClockFull()),60000);return()=>clearInterval(t);},[]);

  /* KPIs */
  const [kpis,setKpis]=useState(()=>load(KEY_KPIS,seeded?.kpis??{weight:"",sleep:"",waist:"",energy:""}));
  useEffect(()=>save(KEY_KPIS,kpis),[kpis]);
  const [history,setHistory]=useState(()=>load(KEY_HISTORY,seeded?.history??[]));
  useEffect(()=>save(KEY_HISTORY,history),[history]);
  const chartData=useMemo(()=>history.slice(-14).map(h=>({date:h.date.slice(5),weight:+h.kpis?.weight,sleep:+h.kpis?.sleep,energy:+h.kpis?.energy})),[history]);
  const saveTodayKPIs=()=>setHistory(prev=>{const k=todayKey();const i=prev.findIndex(r=>r.date===k);const rec={date:k,kpis:{...kpis}};const n=[...prev];i>=0?n[i]=rec:n.push(rec);return n;});

  /* Alerts */
  const [alerts,setAlerts]=useState(()=>load(KEY_ALERTS,DEFAULT_ALERTS));
  useEffect(()=>save(KEY_ALERTS,alerts),[alerts]);
  const [doneToday,setDoneToday]=useState(()=>loadDoneFor(todayKey()));
  useEffect(()=>saveDoneFor(todayKey(),doneToday),[doneToday]);
  const dueAlerts=useMemo(()=>alerts.filter(a=>isAlertDueToday(a)),[alerts]);
  const toggleDone=id=>setDoneToday(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const markAllComplete=()=>setDoneToday([...new Set([...doneToday,...dueAlerts.map(a=>a.id)])]);
  const [showEdit,setShowEdit]=useState(false);
  const updateAlertField=(id,f,v)=>setAlerts(p=>p.map(a=>a.id===id?{...a,[f]:v}:a));
  const addAlert=()=>setAlerts(p=>p.length>=8?p:[...p,{id:Math.random().toString(36).slice(2,7),name:"",dose:"",note:"",pattern:"Daily",start:todayKey()}]);
  const removeAlert=id=>setAlerts(p=>p.filter(a=>a.id!==id));

  /* Stack */
  const [rows,setRows]=useState(()=>load(KEY_STACK,DEFAULT_STACK_ROWS));
  useEffect(()=>save(KEY_STACK,rows),[rows]);
  const [checklist,setChecklist]=useState(Object.fromEntries(rows.map(r=>[r.id,{done:false,ts:null}])));
  const [editMode,setEditMode]=useState(false);
  const toggleRow=id=>setChecklist(p=>({...p,[id]:{done:!p[id]?.done,ts:!p[id]?.done?new Date().toLocaleTimeString():null}}));
  const updateRow=(id,f,v)=>setRows(p=>p.map(r=>r.id===id?{...r,[f]:v}:r));
  const resetRows=()=>setRows(DEFAULT_STACK_ROWS);
  const visibleRows=useMemo(()=>{const dow=todayDowShort();return rows.filter(r=>r.time!=="Weekly"||!r.days||r.days.includes(dow));},[rows]);

  /* Peptide GPT */
  const [showGPT,setShowGPT]=useState(false),[q,setQ]=useState(""),[a,setA]=useState("");
  const ask=()=>setA(answerMiniKB(q));
  const openBigBrain=()=>window.open("https://chat.openai.com/","_blank","noopener,noreferrer");

  /* Notes (Option 3: compact trigger + drawer editor) */
  const [notesText,setNotesText]=useState(()=>load(KEY_NOTES,""));
  useEffect(()=>save(KEY_NOTES,notesText),[notesText]);
  const [notesOpen,setNotesOpen]=useState(false);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* HEADER */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/50 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-3 items-center">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            Mike’s Peptide Ride <span className="text-pink-400">🚀</span>
            <motion.span initial={{scale:.9,opacity:.6}} animate={{scale:1,opacity:1}} transition={{repeat:Infinity,repeatType:"mirror",duration:2}}>
              <Sparkles size={18} className="text-fuchsia-400"/>
            </motion.span>
          </h1>
          <div className="justify-self-center text-xs sm:text-sm">{clock}</div>
          <div className="justify-self-end flex gap-2 pr-1">
            <a className="px-2.5 py-1 rounded-md text-xs sm:text-sm bg-neutral-800/80 hover:bg-neutral-700" href="https://researchdosing.com/dosing-information/" target="_blank" rel="noreferrer">Pep Research</a>
            <button className="px-2.5 py-1 rounded-md text-xs sm:text-sm bg-neutral-800/80 hover:bg-neutral-700" onClick={resetAllData}>Reset Dashboard</button>
          </div>
        </div>
      </header>

      {/* FLOATING BUTTONS (nudged up) */}
      <button onClick={()=>setShowGPT(true)} className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+7rem)] z-20 px-4 py-3 rounded-2xl shadow-lg bg-fuchsia-600/90 text-white flex items-center gap-2"><Brain size={18}/> Peptide GPT</button>
      <button onClick={openBigBrain} className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-20 px-5 py-3 rounded-full shadow-lg bg-gradient-to-r from-fuchsia-600 to-blue-500 text-white font-semibold">🧠 Big Brain</button>

      <main className="mx-auto max-w-7xl px-4 py-6 grid gap-6">
        {/* Alerts */}
        <section className="card">
          <div className="flex justify-between items-center">
            <div>
              <div className="card-title">Daily Alerts</div>
              <p className="text-sm text-gray-400">Shows only what’s due today</p>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={()=>setShowEdit(true)}>Edit</button>
              <button className="btn" onClick={markAllComplete}>Mark All Complete</button>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {dueAlerts.length===0 ? <div className="badge">No Alerts Today 🎉</div> :
              dueAlerts.map(a=>(
                <label key={a.id} className="flex justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-3">
                  <div className="flex gap-3">
                    <input type="checkbox" className="h-5 w-5 accent-fuchsia-500" checked={loadDoneFor(todayKey()).includes(a.id) || (Array.isArray(doneToday) && doneToday.includes(a.id))} onChange={()=>toggleDone(a.id)} />
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-gray-400">{a.dose || "—"} · {a.pattern} {a.note ? `· ${a.note}` : ""}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{a.pattern==="EOD"?"Every other day":patternToDays(a.pattern).map(d=>dayCode[d]).join(" ")}</div>
                </label>
              ))
            }
          </div>
        </section>

        {/* Stack */}
        <section className="card">
          <div className="flex justify-between items-center">
            <div>
              <div className="card-title">Daily Schedule</div>
              <p className="text-sm text-gray-400">Tap checkboxes to log. Weeklies show only on due days.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={()=>setEditMode(!editMode)}>{editMode?"Done":"Edit"}</button>
              {editMode && <button className="btn" onClick={resetRows}>Reset to Default</button>}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="table text-sm sm:text-base">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Time</th>
                  <th>Compound</th>
                  <th>IU</th>
                  <th>mg</th>
                  <th>Category</th>
                  <th>Notes / Days</th>
                  <th className="text-right">Done @</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r=>{
                  const st = checklist[r.id] || { done:false, ts:null };
                  return (
                    <tr key={r.id}>
                      <td><input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={!!st.done} onChange={()=>toggleRow(r.id)} /></td>
                      <td className="whitespace-nowrap">{r.time}</td>
                      <td className="font-medium">{r.compound}</td>
                      <td>{editMode ? <input className="input min-h-10" value={r.doseIU??""} onChange={e=>updateRow(r.id,"doseIU",e.target.value)} /> : r.doseIU}</td>
                      <td>{editMode ? <input className="input min-h-10" value={r.doseMg??""} onChange={e=>updateRow(r.id,"doseMg",e.target.value)} /> : r.doseMg}</td>
                      <td><span className="badge">{r.category}</span></td>
                      <td>
                        {editMode ? (
                          <div className="grid gap-2">
                            <input className="input min-h-10" value={r.notes??""} onChange={e=>updateRow(r.id,"notes",e.target.value)} />
                            {r.time==="Weekly" && (
                              <input className="input min-h-10" placeholder="Days (e.g., Mon,Fri)" value={Array.isArray(r.days)?r.days.join(", "):""} onChange={e=>updateRow(r.id,"days",e.target.value)} />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">{r.notes}{Array.isArray(r.days)&&r.days.length?` (Days: ${r.days.join(", ")})`:""}</span>
                        )}
                      </td>
                      <td className="text-right text-xs text-gray-500">{st.ts ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notes (compact trigger) */}
        <section className="card">
          <div className="flex items-center justify-between">
            <div className="card-title">Notes</div>
            <button className="badge" onClick={()=>setNotesOpen(true)}>Open</button>
          </div>
          <p className="mt-2 text-sm text-gray-400 line-clamp-2">
            {notesText?.trim() ? notesText : "Tap Open to write notes… (auto-saves on this device)"}
          </p>
        </section>

        {/* KPIs + Trends (bottom) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key:"weight", label:"WEIGHT", hint:"tap to add", unit:"lb" },
            { key:"sleep",  label:"SLEEP (hrs)", hint:"track nightly", unit:"h" },
            { key:"waist",  label:"WAIST (in)", hint:"weekly", unit:"in" },
            { key:"energy", label:"ENERGY", hint:"1–10", unit:"" },
          ].map(k=>(
            <div key={k.key} className="card">
              <div className="card-title">{k.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <input className="input min-h-10" placeholder={k.hint} value={kpis[k.key]} onChange={e=>setKpis(v=>({...v,[k.key]:e.target.value}))} />
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
        </section>
      </main>

      {/* EDIT ALERTS DRAWER */}
      <AnimatePresence>
        {showEdit && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Daily Alerts (max 8)</h3>
                <button className="icon-btn" onClick={()=>setShowEdit(false)}><X size={20}/></button>
              </div>
              <div className="mt-3 grid gap-3">
                {alerts.map(a=>(
                  <div key={a.id} className="rounded-xl border border-neutral-800 p-3 grid gap-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input className="input" placeholder="Name" value={a.name} onChange={e=>updateAlertField(a.id,"name",e.target.value)} />
                      <input className="input" placeholder="Dose (e.g., 50 IU)" value={a.dose} onChange={e=>updateAlertField(a.id,"dose",e.target.value)} />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <input className="input" placeholder="Pattern (Daily, EOD, MWF, TuThSa, MTWThF, Sat, Sun)" value={a.pattern} onChange={e=>updateAlertField(a.id,"pattern",e.target.value)} />
                      <input className="input" placeholder="Note (e.g., AM, post-WO)" value={a.note} onChange={e=>updateAlertField(a.id,"note",e.target.value)} />
                      <input className="input" placeholder="Start (YYYY-MM-DD for EOD)" value={a.start||""} onChange={e=>updateAlertField(a.id,"start",e.target.value)} />
                    </div>
                    <div className="text-right"><button className="badge hover:bg-red-600/80" onClick={()=>removeAlert(a.id)}>Remove</button></div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button className="btn" onClick={addAlert}>Add Alert</button>
                <button className="btn" onClick={()=>setShowEdit(false)}>Done</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PEPTIDE GPT DRAWER */}
      <AnimatePresence>
        {showGPT && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Brain size={18}/> Peptide GPT (on-device mini helper)</h3>
                <button className="icon-btn" onClick={()=>setShowGPT(false)}><X size={20}/></button>
              </div>
              <div className="mt-3 grid gap-3">
                <textarea className="input h-28" placeholder="Ask about AOD-9604, Tesamorelin, CJC-1295 + Ipamorelin…" value={q} onChange={e=>setQ(e.target.value)} />
                <div className="flex items-center gap-2">
                  <button className="btn" onClick={ask}>Ask</button>
                  <button className="btn" onClick={()=>{setQ("");setA("");}}>Clear</button>
                </div>
                {a && <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 whitespace-pre-wrap text-sm">{a}</div>}
                <div className="text-xs text-gray-400">Tip: For deeper help, tap <span className="underline cursor-pointer" onClick={openBigBrain}>Big Brain</span>.</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTES DRAWER */}
      <AnimatePresence>
        {notesOpen && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notes</h3>
                <button className="icon-btn" onClick={()=>setNotesOpen(false)}><X size={20}/></button>
              </div>
              <textarea
                className="input mt-3 h-60"
                placeholder="Write anything about today’s protocol, side notes, reminders…"
                value={notesText}
                onChange={(e)=>setNotesText(e.target.value)}
              />
              <div className="mt-2 text-xs text-gray-400">Auto-saved on this device.</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
