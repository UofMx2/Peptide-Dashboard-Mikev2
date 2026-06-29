// Loads the blinds-company vault (markdown + YAML frontmatter) into structured
// data the dashboard renders. The vault notes stay the single source of truth;
// this file only reads them. Re-run `npm run dev` picks up changes live.

// Pull every markdown file under the vault as raw text at build/dev time.
// vault.js lives in dashboard/src/lib, so the vault is three levels up.
const files = import.meta.glob('../../../vault/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// --- tiny YAML-ish frontmatter parser (no extra dependency) -----------------
function parseScalar(v) {
  v = v.trim()
  if (v === '') return ''
  // inline array: [a, b]  or  ["a", "b"]
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return v.replace(/^["']|["']$/g, '')
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { fm: {}, body: text }
  const fm = {}
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (mm) fm[mm[1]] = parseScalar(mm[2])
  }
  return { fm, body: m[2] }
}

// --- helpers ----------------------------------------------------------------
const WIKILINK = /\[\[([^\]]+)\]\]/g
function extractLinks(text) {
  const out = []
  let m
  while ((m = WIKILINK.exec(text))) out.push(m[1].split('|')[0].trim())
  return [...new Set(out)]
}

function firstHeading(body, fallback) {
  const m = body.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : fallback
}

// Pull "## Section" ... block out of a body.
function section(body, name) {
  const re = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'mi')
  const m = body.match(re)
  return m ? m[1].trim() : ''
}

// Timeline lines like "- 2026-06-24 — quoted $2,140.00 ..."
function parseTimeline(body) {
  const block = section(body, 'Timeline')
  if (!block) return []
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => {
      const text = l.replace(/^[-*]\s*/, '')
      const date = (text.match(/\d{4}-\d{2}-\d{2}/) || [null])[0]
      return { date, text }
    })
}

const MONEY = /\$[\d,]+(?:\.\d{2})?/
function money(text) {
  const m = text.match(MONEY)
  return m ? Number(m[0].replace(/[$,]/g, '')) : null
}

// --- build the model --------------------------------------------------------
function folderOf(path) {
  // e.g. ../../vault/20-wiki/customers/Maria Garcia.md -> 20-wiki/customers
  const m = path.match(/vault\/(.+)\/[^/]+$/)
  return m ? m[1] : ''
}

const notes = Object.entries(files)
  .filter(([p]) => !p.endsWith('.gitkeep'))
  .map(([path, raw]) => {
    const { fm, body } = parseFrontmatter(raw)
    const filename = path.split('/').pop().replace(/\.md$/, '')
    const folder = folderOf(path)
    return {
      path,
      folder,
      filename,
      name: firstHeading(body, filename),
      fm,
      body,
      links: extractLinks(body),
    }
  })

const byFolder = (f) => notes.filter((n) => n.folder === f)

// Customers — enrich with status, timeline, latest quote.
const customers = byFolder('20-wiki/customers')
  .map((n) => {
    const timeline = parseTimeline(n.body)
    const quoteLine = [...timeline].reverse().find((t) => /quot/i.test(t.text))
    return {
      ...n,
      status: (n.fm.status || 'lead').toLowerCase(),
      aliases: Array.isArray(n.fm.aliases) ? n.fm.aliases : [],
      products: n.links,
      timeline,
      lastActivity: timeline.reduce(
        (acc, t) => (t.date && (!acc || t.date > acc) ? t.date : acc),
        n.fm.created || null,
      ),
      quoteValue: quoteLine ? money(quoteLine.text) : null,
    }
  })
  .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''))

const products = byFolder('20-wiki/products').map((n) => ({
  ...n,
  supplier: (n.body.match(/supplier:\s*\[\[([^\]]+)\]\]/i) || [])[1] || n.fm.supplier || '',
  marginAlert: /MARGIN ALERT/.test(n.body),
}))

const suppliers = byFolder('20-wiki/suppliers')
const operations = byFolder('20-wiki/operations')
const marketing = byFolder('20-wiki/marketing')

// Inbox = unprocessed raw material waiting for the processor.
const inbox = byFolder('00-inbox')

export const STATUS_ORDER = ['lead', 'quoted', 'won', 'installed', 'warranty', 'lost']

export const vault = {
  notes,
  customers,
  products,
  suppliers,
  operations,
  marketing,
  inbox,
  raw: byFolder('10-raw'),
  projects: byFolder('30-projects'),
}

export { money }
