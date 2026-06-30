// Pure, isomorphic vault parsing — no fs, no import.meta.glob. Shared by the
// browser loader (src/lib/vault.js) and the Node server (server.mjs) so both
// produce an identical vault model from the same markdown.

export const STATUS_ORDER = ['lead', 'quoted', 'won', 'installed', 'warranty', 'lost']

/* ----------------------------- frontmatter -------------------------------- */
function parseScalar(v) {
  v = v.trim()
  if (v === '') return ''
  // a [[wikilink]] is a string value, not a YAML array
  if (v.startsWith('[[')) return v
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

export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { fm: {}, body: text }
  const fm = {}
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (mm) fm[mm[1]] = parseScalar(mm[2])
  }
  return { fm, body: m[2] }
}

/* -------------------------------- helpers --------------------------------- */
const WIKILINK = /\[\[([^\]]+)\]\]/g
export function extractLinks(text) {
  const out = []
  let m
  while ((m = WIKILINK.exec(text))) out.push(m[1].split('|')[0].trim())
  return [...new Set(out)]
}

export function firstHeading(body, fallback) {
  const m = body.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : fallback
}

export function section(body, name) {
  const re = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'mi')
  const m = body.match(re)
  return m ? m[1].trim() : ''
}

export function parseTimeline(body) {
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
export function money(text) {
  const m = text.match(MONEY)
  return m ? Number(m[0].replace(/[$,]/g, '')) : null
}

function folderOf(path) {
  const m = path.replace(/\\/g, '/').match(/vault\/(.+)\/[^/]+$/)
  return m ? m[1] : ''
}

function basename(path) {
  return path.replace(/\\/g, '/').split('/').pop().replace(/\.md$/, '')
}

/* ------------------------------ cost / margin ----------------------------- */
const COST_SELL = /\*\*Price \(our cost \/ sell\):\*\*\s*\$([\d.,]+)\s*\/\s*\$([\d.,]+)/
export function parseCostSell(body) {
  const m = body.match(COST_SELL)
  if (!m) return { cost: null, sell: null, margin: null }
  const cost = Number(m[1].replace(/,/g, ''))
  const sell = Number(m[2].replace(/,/g, ''))
  const margin = sell ? (sell - cost) / sell : null
  return { cost, sell, margin }
}

/* ------------------------------- build model ------------------------------ */
// items: [{ path, raw }]
export function buildVault(items) {
  const notes = items
    .filter((it) => !it.path.endsWith('.gitkeep'))
    .map(({ path, raw }) => {
      const { fm, body } = parseFrontmatter(raw)
      const filename = basename(path)
      return {
        path,
        folder: folderOf(path),
        filename,
        name: firstHeading(body, filename),
        fm,
        body,
        links: extractLinks(body),
      }
    })

  const byFolder = (f) => notes.filter((n) => n.folder === f)

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

  const stripLink = (s) => (String(s || '').match(/\[\[([^\]]+)\]\]/) || [, String(s || '')])[1]
  const products = byFolder('20-wiki/products').map((n) => ({
    ...n,
    supplier: stripLink(n.fm.supplier) || (n.body.match(/supplier:\s*\[\[([^\]]+)\]\]/i) || [])[1] || '',
    ...parseCostSell(n.body),
    marginAlert: /MARGIN ALERT/.test(n.body),
  }))

  return {
    notes,
    customers,
    products,
    suppliers: byFolder('20-wiki/suppliers'),
    operations: byFolder('20-wiki/operations'),
    marketing: byFolder('20-wiki/marketing'),
    inbox: byFolder('00-inbox'),
    raw: byFolder('10-raw'),
    projects: byFolder('30-projects'),
  }
}
