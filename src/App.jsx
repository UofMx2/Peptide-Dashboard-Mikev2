import { useState } from "react";

export default function App() {
  // demo state — swap with real data later
  const [todayDose, setTodayDose] = useState({
    bpc157: 1.0,
    tb500: 1.0,
    ghkcu: 2.5,
    kpv: 0.5,
  });

  const schedule = [
    { name: "Tesamorelin", dose: "0.5–1.0 mg", time: "10:00 PM", status: "EOD / PM" },
    { name: "CJC-1295/Ipamorelin", dose: "40 units", time: "AM", status: "AM" },
    { name: "KLOW 80 + extras", dose: "see stack", time: "Post-WO", status: "Daily" },
    { name: "DSIP", dose: "0.5 mg", time: "Bed", status: "PM" },
  ];

  const kpis = [
    { label: "Weight", value: "—", hint: "tap to add" },
    { label: "Sleep (hrs)", value: "—", hint: "track nightly" },
    { label: "Waist (in)", value: "—", hint: "weekly" },
    { label: "Energy", value: "—", hint: "1–10" },
  ];

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/50 border-b border-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">
            Mike’s Peptide Ride <span className="text-pink-400">🚀</span>
          </h1>
          <div className="flex items-center gap-3">
            <a className="btn" href="https://researchdosing.com/dosing-information/" target="_blank" rel="noreferrer">
              Dosing Reference
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 grid gap-6">
        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <div key={i} className="card">
              <div className="card-title">{k.label}</div>
              <div className="mt-2 kpi">{k.value}</div>
              <div className="mt-1 text-xs text-gray-500">{k.hint}</div>
            </div>
          ))}
        </section>

        {/* Today’s doses quick editor */}
        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="card-title">Today’s Repair Stack</div>
              <h2 className="text-lg font-semibold mt-1">BPC-157 + TB-500 + GHK-Cu + KPV</h2>
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
                  onChange={(e) =>
                    setTodayDose((t) => ({ ...t, [key]: Number(e.target.value) }))
                  }
                />
                <div className="text-xs text-gray-500 mt-1">mg</div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="btn">Save Today</button>
            <button className="btn">Mark Complete</button>
          </div>
        </section>

        {/* Schedule table */}
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Daily Schedule</div>
              <h2 className="text-lg font-semibold mt-1">Protocol Overview</h2>
            </div>
            <span className="badge">Editable</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Peptide</th>
                  <th>Dose</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.name}>
                    <td className="font-medium">{row.name}</td>
                    <td>{row.dose}</td>
                    <td>{row.time}</td>
                    <td><span className="badge">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notes */}
        <section className="card">
          <div className="card-title">Notes</div>
          <p className="mt-2 text-sm text-gray-300">
            Add reminders like “Tesamorelin PM only if wrists OK”, “KLOW post-workout on training days”, etc.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-gray-500">
        <div className="border-t border-neutral-900 pt-6">
          © {new Date().getFullYear()} Mike Carr — Tactical Peptides
        </div>
      </footer>
    </div>
  );
}
