// Blinds Company — model server.
//
// Reads the vault live from disk and serves the dashboard plus working
// workflow actions. The vault stays the source of truth: actions edit the
// markdown notes and append to the logs, exactly like the spec'd workflows.
//
//   npm run build      # build the dashboard once
//   npm run serve      # start this server  ->  http://localhost:8787
//
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { buildVault } from './src/lib/parse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.join(__dirname, '..') // blinds-company/
const VAULT = path.join(PROJECT, 'vault')
const AGENTS = path.join(PROJECT, 'agents')
const PORT = process.env.PORT || 8787

const today = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

/* ------------------------------- vault I/O -------------------------------- */
function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

function readVault() {
  const items = walk(VAULT).map((p) => ({
    path: p.slice(PROJECT.length + 1).replace(/\\/g, '/'), // e.g. vault/20-wiki/...
    raw: fs.readFileSync(p, 'utf8'),
  }))
  return buildVault(items)
}

const abs = (relPath) => path.join(PROJECT, relPath)
const append = (relPath, text) => fs.appendFileSync(abs(relPath), text)

/* ----------------------------- markdown edits ----------------------------- */
// Append a line at the end of a "## Section" block.
function insertIntoSection(body, name, line) {
  const re = new RegExp(`(^##\\s+${name}\\s*$)([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'mi')
  if (!re.test(body)) return body.trimEnd() + `\n\n## ${name}\n${line}\n`
  return body.replace(re, (_, head, block) => `${head}${block.trimEnd()}\n${line}\n\n`)
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

/* -------------------------------- the app --------------------------------- */
const app = express()
app.use(express.json())

app.get('/api/status', (_req, res) => {
  res.json({ server: true, claude: hasClaude(), ranAt: now() })
})

app.get('/api/vault', (_req, res) => {
  res.json(readVault())
})

/* ---- action: quote follow-ups (deterministic) ---------------------------- */
app.post('/api/actions/follow-ups', (_req, res) => {
  const v = readVault()
  const t = today()
  const drafts = []

  for (const c of v.customers) {
    if (c.status !== 'quoted') continue
    const quoteT = [...c.timeline].reverse().find((x) => /quot/i.test(x.text))
    const quoteDate = quoteT?.date || c.lastActivity
    const days = quoteDate ? daysBetween(quoteDate, t) : 0
    if (days < 3) continue

    const first = c.name.split(' ')[0]
    const product = c.products[0] || 'your window treatments'
    let stage, msg
    if (days >= 14) {
      stage = 'last touch'
      msg = `Hi ${first} — last note from me on the ${product} quote. Lead times are creeping up heading into summer, so if you'd like to lock today's pricing I can hold your spot. Otherwise I'll close the file. No pressure either way.`
    } else if (days >= 7) {
      stage = 'objection handler'
      msg = `Hi ${first}, following up on your ${c.quoteValue ? '$' + c.quoteValue.toLocaleString() : ''} quote. A lot of folks weigh cost vs. the daily annoyance it fixes — ${product} pays back fast in comfort and light control. Happy to tweak the scope if budget's the sticking point. Want me to pencil in a measure-confirm date?`
    } else {
      stage = 'friendly check-in'
      msg = `Hi ${first}, just checking in on the ${product} quote I sent ${quoteDate}. Any questions I can answer? Glad to walk you through the options whenever works.`
    }

    // idempotent: skip if we already drafted today for this customer
    const file = c.path
    const body = fs.readFileSync(abs(file), 'utf8')
    if (body.includes(`${t} — DRAFT (not sent)`)) {
      drafts.push({ customer: c.name, stage, days, msg, skipped: 'already drafted today' })
      continue
    }
    const line = `- ${t} — DRAFT (not sent), ${stage}: "${msg}"`
    fs.writeFileSync(abs(file), insertIntoSection(body, 'Timeline', line))
    drafts.push({ customer: c.name, stage, days, msg })
  }

  const logged = drafts.filter((d) => !d.skipped)
  append(
    'agents/logs/follow-up-log.md',
    `\n## ${now()} — quote follow-up run\n` +
      (logged.length
        ? logged.map((d) => `- ${d.customer} (${d.days}d, ${d.stage}) — draft added to note`).join('\n')
        : '- nothing due') +
      '\n',
  )

  res.json({ action: 'follow-ups', ranAt: now(), count: logged.length, drafts })
})

/* ---- action: supplier price watch (deterministic) ------------------------ */
app.post('/api/actions/price-watch', (_req, res) => {
  const v = readVault()
  const t = today()
  const supplierNames = v.suppliers.map((s) => s.name)

  // Find a price-change email sitting in the inbox.
  const email = v.inbox.find((n) => {
    const hit = supplierNames.find((s) => n.body.includes(s) || n.body.includes(s.split(' ')[0]))
    return hit && /(\d+(?:\.\d+)?)\s*%/.test(n.body)
  })

  if (!email) {
    return res.json({
      action: 'price-watch',
      ranAt: now(),
      message: 'No supplier price change found in the inbox. Nothing to do.',
      affectedProducts: [],
      exposedQuotes: [],
    })
  }

  const pct = Number(email.body.match(/(\d+(?:\.\d+)?)\s*%/)[1])
  const supplier = v.suppliers.find(
    (s) => email.body.includes(s.name) || email.body.includes(s.name.split(' ')[0]),
  )

  // 1) log the change on the supplier note
  {
    const file = supplier.path
    let body = fs.readFileSync(abs(file), 'utf8')
    const line = `  - ${t} — +${pct}% on fabric pricing (per supplier email)`
    // append after the price-changes header and any existing indented sub-bullets
    body = body.replace(
      /(- \*\*Price changes[^\n]*\n(?:\s+-[^\n]*\n)*)/,
      (m) => `${m}${line}\n`,
    )
    if (!body.includes(line)) body = body.trimEnd() + `\n\n- **Price changes:**\n${line}\n`
    fs.writeFileSync(abs(file), body)
  }

  // 2) bump cost on each affected product, recompute margin, flag if < 50%
  const TARGET = 0.5
  const affectedProducts = []
  for (const p of v.products) {
    if (p.supplier !== supplier.name || p.cost == null) continue
    const newCost = Math.round(p.cost * (1 + pct / 100) * 100) / 100
    const margin = p.sell ? (p.sell - newCost) / p.sell : null
    const file = p.path
    let body = fs.readFileSync(abs(file), 'utf8')
    body = body.replace(
      /(\*\*Price \(our cost \/ sell\):\*\*\s*)\$[\d.,]+(\s*\/\s*\$[\d.,]+)/,
      (_, head, tail) => `${head}$${newCost}${tail}`,
    )
    // refresh margin-alert callout right after the H1
    body = body.replace(/\n> MARGIN ALERT:[^\n]*\n/g, '\n')
    const alert = margin != null && margin < TARGET
    if (alert) {
      body = body.replace(
        /^(#\s+.+\n)/m,
        `$1\n> MARGIN ALERT: cost +${pct}% on ${t} → margin now ${(margin * 100).toFixed(0)}% (below ${TARGET * 100}% target). Re-quote open deals.\n`,
      )
    }
    fs.writeFileSync(abs(file), body)
    affectedProducts.push({
      name: p.name,
      oldCost: p.cost,
      newCost,
      sell: p.sell,
      margin: margin != null ? +(margin * 100).toFixed(1) : null,
      alert,
    })
  }

  // 3) open quotes exposed to the change
  const affectedNames = affectedProducts.map((a) => a.name)
  const exposedQuotes = v.customers
    .filter((c) => c.status === 'quoted' && c.products.some((pr) => affectedNames.includes(pr)))
    .map((c) => ({ customer: c.name, quote: c.quoteValue, products: c.products.filter((pr) => affectedNames.includes(pr)) }))

  // 4) move the email out of the inbox into raw provenance
  const slug = email.filename.replace(/^\d{4}-\d{2}-\d{2}[-]?/, '').replace(/\.md$/, '')
  const rawRel = `vault/10-raw/${t}--${slug || 'supplier-price-change'}.md`
  fs.renameSync(abs(email.path), abs(rawRel))

  // 5) briefings + logs
  const briefing =
    `**${supplier.name} raised fabric pricing +${pct}% (effective per email).**\n\n` +
    `Affected products:\n` +
    affectedProducts
      .map((a) => `- ${a.name}: cost $${a.oldCost} → $${a.newCost}, margin ${a.margin}%${a.alert ? '  ⚠️ below target' : ''}`)
      .join('\n') +
    `\n\nOpen quotes exposed:\n` +
    (exposedQuotes.length
      ? exposedQuotes.map((q) => `- ${q.customer} ($${q.quote}) — ${q.products.join(', ')}`).join('\n')
      : '- none') +
    `\n\nRecommended: re-quote the exposed deals before they're accepted at old margin.`

  append('agents/logs/price-watch-log.md', `\n## ${now()} — price watch run\n\n${briefing}\n`)
  append(
    'agents/logs/processing-log.md',
    `\n## ${now()} — supplier price watch\n- Processed: ${supplier.name} +${pct}% email from inbox\n- Updated: ${affectedProducts.map((a) => a.name).join(', ') || 'none'}\n- Exposed quotes: ${exposedQuotes.map((q) => q.customer).join(', ') || 'none'}\n- Provenance: ${rawRel}\n`,
  )

  res.json({ action: 'price-watch', ranAt: now(), supplier: supplier.name, pct, affectedProducts, exposedQuotes, briefing })
})

/* ---- action: process inbox (shells out to Claude Code) ------------------- */
function hasClaude() {
  try {
    const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 8000 })
    return r.status === 0
  } catch {
    return false
  }
}

app.post('/api/actions/process-inbox', (_req, res) => {
  const v = readVault()
  if (v.inbox.length === 0) {
    return res.json({ ok: true, claude: hasClaude(), message: 'Inbox already empty — nothing to process.' })
  }
  if (!hasClaude()) {
    return res.json({
      ok: false,
      claude: false,
      message:
        'Claude Code CLI not found on PATH. Install it, then from the blinds-company/ folder run the command below (or use the deterministic Price Watch action for the pending price email).',
      command: 'cd blinds-company && claude -p "Process the inbox per CLAUDE.md"',
      inbox: v.inbox.map((n) => n.filename),
    })
  }
  const r = spawnSync('claude', ['-p', 'Process the inbox per CLAUDE.md. File each item, preserve provenance, and append to the processing log.'], {
    cwd: PROJECT,
    encoding: 'utf8',
    timeout: 1000 * 60 * 5,
  })
  res.json({ ok: r.status === 0, claude: true, output: (r.stdout || '') + (r.stderr || ''), exit: r.status })
})

/* ------------------------------ static site ------------------------------- */
const DIST = path.join(__dirname, 'dist')
if (fs.existsSync(DIST)) app.use(express.static(DIST))
app.get('*', (_req, res) => {
  if (fs.existsSync(path.join(DIST, 'index.html'))) res.sendFile(path.join(DIST, 'index.html'))
  else res.status(404).send('Run `npm run build` first to generate dist/.')
})

app.listen(PORT, () => {
  console.log(`Blinds Company model server → http://localhost:${PORT}`)
  console.log(`Vault: ${VAULT}`)
  console.log(`Claude Code CLI available: ${hasClaude()}`)
})
