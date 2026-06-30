# Blinds Company — Trinity Knowledge System

A one-person operation that runs like a real company, without adding headcount.
This is the "Trinity" setup from the article, assembled for a window-coverings
business:

| Layer | Tool | Role | Lives in |
|-------|------|------|----------|
| **Memory** | Obsidian | Holds everything you've ever captured | `vault/` |
| **Processor** | Claude Code | Turns raw dumps into clean, linked knowledge | `CLAUDE.md` |
| **Operator** | Agent (Hermes-style) | Runs repeatable workflows on its own | `agents/` |

A **web dashboard + model server** (`dashboard/`) is layered on top: a React/Vite
app that reads the vault notes directly and visualizes the pipeline, quotes,
catalog, operations, marketing, inbox, and workflows — plus a Node server so you
can **run the workflows from the UI** and watch them edit the vault. The vault
stays the source of truth. Quick start:

```bash
cd dashboard && npm install && npm run model   # http://localhost:8787
```

Then open the **System** tab and click **Run price watch** or **Run follow-ups**.
See `dashboard/README.md` for details.

The idea: **a real system doesn't make you dig — it already knows.** You capture
raw material wherever you are, Claude Code files it into a clean wiki using the
rules in `CLAUDE.md`, and the agent workflows handle the repeatable slices of
work (quote follow-ups, inbox triage, supplier-price watch) and get faster the
longer they run.

## How to use it

1. **Open `vault/` as an Obsidian vault** (point Obsidian at that folder).
2. **Capture into `vault/00-inbox/`** — paste a customer text, a measurement, a
   supplier email, an idea. Don't organize it. Raw is messy by design.
3. **Run the processor.** From `blinds-company/`, open Claude Code and say
   *"process the inbox."* It reads `CLAUDE.md` and files everything into
   `vault/20-wiki/`, preserving the originals in `vault/10-raw/`.
4. **Run an operator workflow** when you want a repeatable task done — see
   `agents/workflows/`. Each is a markdown spec Claude executes end to end.

## Folder map

```
blinds-company/
  CLAUDE.md            The processor contract — how the vault works. Read it.
  vault/
    00-inbox/          Drop raw material here. Empty = fully processed.
    10-raw/            Processed originals, kept for provenance (append-only).
    20-wiki/           The clean answer: customers, products, suppliers,
                       operations, marketing.
    30-projects/       Active multi-step efforts.
    90-archive/        Superseded notes (never deleted).
  agents/
    workflows/         Repeatable task specs the operator runs.
    logs/              Append-only run logs.
  dashboard/           React/Vite web app — a live view layered on the vault.
```

## The compounding bet

Month one the vault is thin and the connections are obvious. Month six there are
hundreds of linked notes and the system starts surfacing connections you'd have
missed — the supplier whose price just rose feeds the three products your top
leads want. None of this needs a team. It needs three tools that talk to each
other, built in the right order, given a few months to accumulate history.

See `GETTING-STARTED.md` for the first-week setup checklist.
