import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  Wrench,
  Inbox,
  Bot,
  X,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Layers,
  Link2,
  Megaphone,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react'
import { vault, STATUS_ORDER, loadVault, runAction, isServerAvailable } from './lib/vault.js'
import { workflows } from './lib/workflows.js'

/* ------------------------------- constants -------------------------------- */
const STATUS_META = {
  lead: { label: 'Lead', color: '#64748b' },
  quoted: { label: 'Quoted', color: '#f59e0b' },
  won: { label: 'Won', color: '#22c55e' },
  installed: { label: 'Installed', color: '#3b82f6' },
  warranty: { label: 'Warranty', color: '#a855f7' },
  lost: { label: 'Lost', color: '#475569' },
}
const fmtMoney = (n) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/* --------------------------------- shells --------------------------------- */
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-edge bg-panel ${className}`}>{children}</div>
  )
}

function Kpi({ icon: Icon, label, value, sub, tone = 'text-sky-400' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <Icon size={14} className={tone} /> {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  )
}

function Pill({ status }) {
  const m = STATUS_META[status] || STATUS_META.lead
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `${m.color}22`, color: m.color }}
    >
      {m.label}
    </span>
  )
}

/* -------------------------------- overview -------------------------------- */
function Overview({ onGoto }) {
  const { customers, products, suppliers, inbox } = vault
  const openQuotes = customers.filter((c) => c.status === 'quoted')
  const pipelineValue = openQuotes.reduce((s, c) => s + (c.quoteValue || 0), 0)
  const won = customers.filter((c) => c.status === 'won' || c.status === 'installed')
  const marginAlerts = products.filter((p) => p.marginAlert)

  const funnel = STATUS_ORDER.filter((s) => s !== 'lost').map((s) => ({
    status: STATUS_META[s].label,
    count: customers.filter((c) => c.status === s).length,
    color: STATUS_META[s].color,
  }))

  const recent = [...customers]
    .filter((c) => c.lastActivity)
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .slice(0, 6)

  return (
    <div className="space-y-5">
      {inbox.length > 0 && (
        <Card className="flex items-center justify-between border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <Inbox className="text-amber-400" size={20} />
            <div>
              <div className="font-medium text-amber-200">
                {inbox.length} item{inbox.length > 1 ? 's' : ''} waiting in the inbox
              </div>
              <div className="text-xs text-amber-300/70">
                Run “process the inbox” in Claude Code to file them into the wiki.
              </div>
            </div>
          </div>
          <button
            onClick={() => onGoto('system')}
            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-500/10"
          >
            View
          </button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label="Active customers" value={customers.filter((c) => c.status !== 'lost').length} sub={`${customers.length} total in vault`} />
        <Kpi icon={DollarSign} label="Open quote value" value={fmtMoney(pipelineValue)} sub={`${openQuotes.length} open quote${openQuotes.length === 1 ? '' : 's'}`} tone="text-amber-400" />
        <Kpi icon={Package} label="Catalog" value={products.length} sub={`${suppliers.length} suppliers`} tone="text-emerald-400" />
        <Kpi icon={AlertTriangle} label="Margin alerts" value={marginAlerts.length} sub={marginAlerts.length ? 'check catalog' : 'all healthy'} tone={marginAlerts.length ? 'text-rose-400' : 'text-emerald-400'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          <div className="mb-3 text-sm font-medium text-slate-200">Pipeline</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2630" vertical={false} />
                <XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#ffffff08' }}
                  contentStyle={{ background: '#11161d', border: '1px solid #1e2630', borderRadius: 12, color: '#e6edf3' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {funnel.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-medium text-slate-200">Recent activity</div>
          <ul className="space-y-2">
            {recent.map((c) => (
              <li key={c.path} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-slate-200">{c.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill status={c.status} />
                  <span className="text-xs text-slate-500">{c.lastActivity}</span>
                </span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-sm text-slate-500">No customer activity yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* -------------------------------- pipeline -------------------------------- */
function Pipeline({ onSelect }) {
  const cols = STATUS_ORDER.map((s) => ({
    status: s,
    items: vault.customers.filter((c) => c.status === s),
  }))
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cols.map((col) => (
        <div key={col.status} className="rounded-2xl border border-edge bg-panel/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Pill status={col.status} />
            <span className="text-xs text-slate-500">{col.items.length}</span>
          </div>
          <div className="space-y-2">
            {col.items.map((c) => (
              <button
                key={c.path}
                onClick={() => onSelect(c)}
                className="w-full rounded-xl border border-edge bg-ink/60 p-2.5 text-left hover:border-slate-500"
              >
                <div className="truncate text-sm font-medium text-slate-100">{c.name}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{c.quoteValue ? fmtMoney(c.quoteValue) : '—'}</span>
                  <span>{c.lastActivity}</span>
                </div>
              </button>
            ))}
            {col.items.length === 0 && <div className="py-2 text-center text-xs text-slate-600">empty</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------- customers ------------------------------- */
function CustomerDrawer({ customer, onClose }) {
  return (
    <AnimatePresence>
      {customer && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-edge bg-panel p-6"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">{customer.name}</h2>
                <div className="mt-2"><Pill status={customer.status} /></div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-edge hover:text-slate-100">
                <X size={20} />
              </button>
            </div>

            {customer.quoteValue != null && (
              <div className="mt-4 rounded-xl border border-edge bg-ink/60 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Latest quote</div>
                <div className="text-2xl font-semibold text-amber-300">{fmtMoney(customer.quoteValue)}</div>
              </div>
            )}

            {customer.products.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
                  <Link2 size={12} /> Linked notes
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customer.products.map((p) => (
                    <span key={p} className="rounded-lg border border-edge bg-ink/60 px-2 py-1 text-xs text-sky-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {customer.timeline.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Timeline</div>
                <ol className="space-y-3 border-l border-edge pl-4">
                  {customer.timeline.map((t, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-sky-500" />
                      <div className="text-xs text-slate-500">{t.date}</div>
                      <div className="text-sm text-slate-200">{t.text.replace(/^\d{4}-\d{2}-\d{2}\s*[—-]\s*/, '')}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-6 text-xs text-slate-500">
              Source note: <code className="text-slate-400">vault/{customer.folder}/{customer.filename}.md</code>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Customers({ onSelect }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const list = vault.customers.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false
    if (!q) return true
    const hay = (c.name + ' ' + c.aliases.join(' ')).toLowerCase()
    return hay.includes(q.toLowerCase())
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers…"
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{list.length} shown</span>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Quote</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr
                key={c.path}
                onClick={() => onSelect(c)}
                className="cursor-pointer border-b border-edge/50 last:border-0 hover:bg-ink/40"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">{c.name}</div>
                  {c.aliases.length > 0 && (
                    <div className="text-xs text-slate-500">aka {c.aliases.join(', ')}</div>
                  )}
                </td>
                <td className="px-4 py-3"><Pill status={c.status} /></td>
                <td className="px-4 py-3 text-slate-300">{c.quoteValue ? fmtMoney(c.quoteValue) : '—'}</td>
                <td className="px-4 py-3 text-slate-400">{c.lastActivity || '—'}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No customers match.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* --------------------------------- catalog -------------------------------- */
function Catalog() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Package size={16} className="text-emerald-400" /> Products
        </div>
        <div className="space-y-2">
          {vault.products.map((p) => (
            <Card key={p.path} className="p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-100">{p.name}</div>
                {p.marginAlert && (
                  <span className="flex items-center gap-1 text-xs text-rose-400">
                    <AlertTriangle size={12} /> margin
                  </span>
                )}
              </div>
              {p.supplier && (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <Truck size={12} /> {p.supplier}
                </div>
              )}
            </Card>
          ))}
          {vault.products.length === 0 && <Card className="p-4 text-sm text-slate-500">No products yet.</Card>}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Truck size={16} className="text-sky-400" /> Suppliers
        </div>
        <div className="space-y-2">
          {vault.suppliers.map((s) => (
            <Card key={s.path} className="p-3">
              <div className="font-medium text-slate-100">{s.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {(s.body.match(/\*\*Lead times:\*\*\s*(.+)/) || [, ''])[1] || ''}
              </div>
            </Card>
          ))}
          {vault.suppliers.length === 0 && <Card className="p-4 text-sm text-slate-500">No suppliers yet.</Card>}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- operations ------------------------------- */
function Operations() {
  return (
    <div className="space-y-3">
      {vault.operations.map((o) => (
        <Card key={o.path} className="p-4">
          <div className="flex items-center gap-2 text-slate-100">
            <Wrench size={16} className="text-amber-400" />
            <span className="font-medium">{o.name}</span>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
            {o.body.replace(/^#\s+.+\n/, '').trim()}
          </pre>
        </Card>
      ))}
      {vault.operations.length === 0 && <Card className="p-4 text-sm text-slate-500">No SOPs yet.</Card>}
    </div>
  )
}

/* ------------------------------- marketing -------------------------------- */
function Marketing() {
  if (vault.marketing.length === 0)
    return <Card className="p-4 text-sm text-slate-500">No marketing notes yet.</Card>
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {vault.marketing.map((m) => (
        <Card key={m.path} className="p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-100">
            <Megaphone size={16} className="text-pink-400" />
            <span className="font-medium">{m.name}</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
            {m.body.replace(/^#\s+.+\n/, '').trim()}
          </pre>
        </Card>
      ))}
    </div>
  )
}

/* ----------------------------- action runner ------------------------------ */
const ACTIONS = [
  { name: 'process-inbox', label: 'Process inbox', icon: Inbox, desc: 'Hand the inbox to Claude Code to file into the wiki.' },
  { name: 'price-watch', label: 'Run price watch', icon: AlertTriangle, desc: 'Apply supplier price changes, re-flag margins, find exposed quotes.' },
  { name: 'follow-ups', label: 'Run follow-ups', icon: ArrowRight, desc: 'Draft the next follow-up for every quoted customer.' },
]

function ActionsPanel({ onRefresh }) {
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)
  const online = isServerAvailable()

  async function run(name) {
    setBusy(name)
    setResult(null)
    try {
      const res = await runAction(name)
      setResult({ name, res })
      await onRefresh()
    } catch (e) {
      setResult({ name, error: String(e.message || e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Play size={16} className="text-emerald-400" /> Run a workflow
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${online ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {online ? 'model server connected' : 'static mode — start the server to run actions'}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {ACTIONS.map((a) => (
          <button
            key={a.name}
            disabled={!online || busy}
            onClick={() => run(a.name)}
            className="rounded-xl border border-edge bg-ink/60 p-3 text-left transition hover:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center gap-2 font-medium text-slate-100">
              {busy === a.name ? <Loader2 size={15} className="animate-spin text-emerald-400" /> : <a.icon size={15} className="text-emerald-400" />}
              {a.label}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{a.desc}</p>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <ActionResult {...result} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function ActionResult({ name, res, error }) {
  if (error)
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
        <CircleAlert size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
      </div>
    )
  const ok = res.ok !== false
  return (
    <div className={`rounded-xl border p-3 text-sm ${ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="mb-2 flex items-center gap-2 font-medium text-slate-100">
        {ok ? <CheckCircle2 size={16} className="text-emerald-400" /> : <CircleAlert size={16} className="text-amber-400" />}
        {name} · {res.ranAt || ''}
      </div>

      {name === 'follow-ups' && (
        <div className="space-y-2">
          <div className="text-slate-300">{res.count} draft{res.count === 1 ? '' : 's'} written into customer notes.</div>
          {res.drafts?.map((d, i) => (
            <div key={i} className="rounded-lg border border-edge bg-ink/60 p-2">
              <div className="text-xs text-slate-400">{d.customer} · {d.stage} · {d.days}d {d.skipped ? `· ${d.skipped}` : ''}</div>
              <div className="mt-1 text-slate-200">{d.msg}</div>
            </div>
          ))}
        </div>
      )}

      {name === 'price-watch' && (
        res.briefing ? (
          <pre className="whitespace-pre-wrap font-sans text-slate-200">{res.briefing}</pre>
        ) : (
          <div className="text-slate-300">{res.message}</div>
        )
      )}

      {name === 'process-inbox' && (
        <div className="space-y-2">
          <div className="text-slate-300">{res.message || (res.ok ? 'Inbox processed by Claude Code.' : '')}</div>
          {res.command && (
            <code className="block rounded-lg bg-ink/80 p-2 text-xs text-sky-300">{res.command}</code>
          )}
          {res.output && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-ink/80 p-2 text-xs text-slate-300">{res.output}</pre>
          )}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- system --------------------------------- */
function System({ onRefresh }) {
  return (
    <div className="space-y-5">
      <ActionsPanel onRefresh={onRefresh} />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Inbox size={16} className="text-amber-400" /> Inbox — unprocessed raw material
        </div>
        {vault.inbox.length === 0 ? (
          <div className="text-sm text-emerald-400">Inbox empty — fully processed. ✓</div>
        ) : (
          <ul className="space-y-2">
            {vault.inbox.map((n) => (
              <li key={n.path} className="rounded-xl border border-edge bg-ink/60 p-3">
                <div className="text-sm font-medium text-slate-200">{n.filename}</div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">{n.body.slice(0, 160)}…</div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-xs text-slate-500">
          The processor (Claude Code, guided by <code className="text-slate-400">CLAUDE.md</code>) files these into the wiki.
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Bot size={16} className="text-sky-400" /> Agent workflows (the operator)
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {workflows.map((w) => (
            <div key={w.slug} className="rounded-xl border border-edge bg-ink/60 p-3">
              <div className="font-medium text-slate-100">{w.name}</div>
              {w.type && <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{w.type}</div>}
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{w.goal}</p>
              {w.trigger && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-edge px-2 py-1 text-xs text-slate-300">
                  <ArrowRight size={11} /> {w.trigger}
                </div>
              )}
            </div>
          ))}
          {workflows.length === 0 && <div className="text-sm text-slate-500">No workflows defined.</div>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Layers size={16} className="text-purple-400" /> How this fits together
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          This dashboard is a live view layered on the <strong className="text-slate-300">vault</strong>. Obsidian holds the
          memory, Claude Code (guided by <code className="text-slate-300">CLAUDE.md</code>) processes raw drops into linked
          wiki notes, and the agent workflows run the repeatable work. Everything above is read straight from the markdown —
          edit a note, refresh, and it updates here.
        </p>
      </Card>
    </div>
  )
}

/* ----------------------------------- app ---------------------------------- */
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', icon: Layers },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'catalog', label: 'Catalog', icon: Package },
  { id: 'operations', label: 'Operations', icon: Wrench },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'system', label: 'System', icon: Bot },
]

export default function App() {
  const [tab, setTab] = useState('overview')
  const [selected, setSelected] = useState(null)
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    loadVault().then(() => setReady(true))
  }, [])

  // Re-load the live vault after an action mutates the notes.
  const refresh = async () => {
    await loadVault()
    setVersion((v) => v + 1)
  }

  const inboxCount = vault.inbox.length

  const body = useMemo(() => {
    switch (tab) {
      case 'pipeline':
        return <Pipeline onSelect={setSelected} />
      case 'customers':
        return <Customers onSelect={setSelected} />
      case 'catalog':
        return <Catalog />
      case 'operations':
        return <Operations />
      case 'marketing':
        return <Marketing />
      case 'system':
        return <System onRefresh={refresh} />
      default:
        return <Overview onGoto={setTab} />
    }
    // version is included so the view re-renders with freshly loaded data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, version])

  if (!ready) {
    return (
      <div className="grid min-h-full place-items-center text-slate-400">
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading vault…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-edge bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/20 text-sky-300">
              <Layers size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">Blinds Company</div>
              <div className="text-xs text-slate-500">Operations dashboard · layered on the vault</div>
            </div>
          </div>
          <nav className="hidden gap-1 md:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  tab === t.id ? 'bg-edge text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <t.icon size={15} /> {t.label}
                {t.id === 'system' && inboxCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">
                    {inboxCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        {/* mobile tabs */}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                tab === t.id ? 'bg-edge text-slate-100' : 'text-slate-400'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{body}</main>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
