# Blinds Company — Dashboard

A React/Vite dashboard **layered on top of the vault**. It reads the markdown
notes in `../vault` and the workflow specs in `../agents/workflows` directly —
the vault stays the single source of truth, and this is just a live view of it.

## Run it

```bash
cd blinds-company/dashboard
npm install
npm run dev      # http://localhost:5173
```

Production build:

```bash
npm run build    # outputs to dist/
npm run preview
```

## How it reads the vault

- `src/lib/vault.js` uses Vite's `import.meta.glob('../../../vault/**/*.md')`
  to pull every note in as raw text at build/dev time, parses the YAML
  frontmatter + body (small built-in parser, no extra deps), and shapes it into
  customers / products / suppliers / operations / inbox.
- `src/lib/workflows.js` does the same for `../agents/workflows/*.md`.
- Edit any note in the vault, refresh the dev server, and the dashboard updates.
  Nothing is duplicated — change data by editing the markdown, not the UI.

## Tabs

| Tab | Shows |
|-----|-------|
| **Overview** | KPIs (active customers, open-quote value, catalog, margin alerts), pipeline chart, recent activity, inbox alert |
| **Pipeline** | Customers as columns by status (lead → quoted → won → installed → warranty → lost) |
| **Customers** | Searchable/filterable table; click a row for a timeline drawer |
| **Catalog** | Products (with supplier + margin flags) and suppliers |
| **Operations** | SOP notes rendered from `vault/20-wiki/operations` |
| **System** | Unprocessed inbox items + the agent workflows + how the Trinity fits together |

## What it derives from the notes

- **Status** from each customer's `status:` frontmatter.
- **Quote value** parsed from the latest `quoted $X` line in the customer's `## Timeline`.
- **Open quote value** = sum of quote values for `status: quoted` customers.
- **Margin alerts** from any `> MARGIN ALERT` callout the price-watch workflow adds.
- **Inbox count** = files sitting in `vault/00-inbox` (unprocessed raw material).

So the dashboard's numbers move on their own as you capture into the inbox, run
the processor, and run the agent workflows. It visualizes the Trinity; it
doesn't replace it.
