# CLAUDE.md — Blinds Company Operating Brain

This file is the contract between you (Claude Code) and this vault. Read it
fully before touching anything. It tells you **exactly** how this knowledge
base is structured, what to do with anything dropped into it, and how to decide
between creating a new note and extending an existing one.

This is "Layer Two" of the Trinity: Obsidian holds the memory, **you** are the
processor, and the agent workflows in `/agents` are the operator. Your job is to
move messy raw material into clean, linked, permanent knowledge — predictably,
the same way every time.

---

## 0. What this business is

A window-coverings company: sells, measures, and installs blinds, shades,
shutters, and motorized window treatments for residential and light-commercial
customers. Mostly run lean. The whole point of this system is that nothing the
owner learns — a customer preference, a supplier price change, a competitor's
new product, an install gotcha — ever gets lost or has to be re-figured-out.

---

## 1. The folder structure (do not invent new top-level folders)

```
vault/
  00-inbox/      RAW DROP ZONE. Unprocessed. Anything pasted/dumped lands here.
  10-raw/        Processed raw material, kept for provenance. Append-only.
  20-wiki/       The clean, permanent knowledge. The "answer" lives here.
    customers/   One note per customer or account.
    products/    Blind/shade types, fabrics, motors, SKUs, specs.
    suppliers/   Vendor notes: pricing, lead times, contacts, terms.
    operations/  How-we-do-it: measuring, install, scheduling, warranty.
    marketing/   Offers, competitor intel, content ideas, channels.
  30-projects/   Active multi-step efforts with a start and end (one file each).
  90-archive/    Dead/superseded notes. Never delete — move here.
agents/
  workflows/     Hermes-style repeatable task definitions (markdown specs).
  logs/          Append-only run logs the agent writes after each run.
```

**Raw is messy by design. Wiki is clean by design.** The boundary between
`00-inbox`/`10-raw` and `20-wiki` is sacred. Never let raw fragments leak into
the wiki, and never overwrite a processed raw record.

---

## 2. The processing loop (what to do with anything in 00-inbox)

For every file or note in `00-inbox/`:

1. **Read it and classify** the dominant topic → which `20-wiki` subfolder it
   belongs to (customers / products / suppliers / operations / marketing). If it
   spans several, pick the primary home and `[[backlink]]` the others.
2. **Decide create vs. extend** using the rule in §3.
3. **Write the clean version** into the right `20-wiki` note: summarize,
   structure, and link. Use the note templates in §5. Add `[[wikilinks]]` to
   every related entity (customer, product, supplier) you mention.
4. **Preserve provenance**: move the original raw file from `00-inbox/` to
   `10-raw/` unchanged, renamed `YYYY-MM-DD--short-slug.md`. Never edit it after.
5. **Cross-link**: update any existing notes that should now point to the new or
   updated note (e.g. a customer note linking to the product they bought).
6. **Leave inbox empty** when done. An empty inbox means "fully processed."

Never make the owner dig. After processing, the answer should be retrievable by
opening one obvious wiki note — not by re-reading raw dumps.

---

## 3. Create vs. extend — the decision rule

- **Extend** an existing note when the new material is about the *same entity*
  (same customer, same product line, same supplier) or the *same procedure*.
  Add a dated entry under the relevant section; do not duplicate the note.
- **Create** a new note only when the entity or topic does not yet exist. Check
  for near-duplicates first (search `20-wiki` for the name and obvious aliases —
  "Mrs. Garcia" vs "Garcia, Maria"). If a near-duplicate exists, extend it and
  add the alias to the note's `aliases:` frontmatter.
- **One entity = one note.** Two notes for the same customer is a bug. If you
  find duplicates, merge into the older note, leave a `> merged from [[...]]`
  line, and move the loser to `90-archive/`.

When genuinely unsure whether two things are the same entity, extend the more
established note and add a `> NEEDS REVIEW: possible duplicate of X` callout
rather than silently creating a second note.

---

## 4. Naming conventions

- Customer notes: `Firstname Lastname.md` (or business name). Add `aliases:`.
- Product notes: `Product Line - Variant.md` (e.g. `Roller Shades - Blackout.md`).
- Supplier notes: `Supplier Name.md`.
- Raw files: `YYYY-MM-DD--slug.md`.
- Projects: `YYYY-MM-DD Project Name.md`.
- Dates always `YYYY-MM-DD`. Money always like `$1,240.00`. Measurements in the
  unit the customer gave, but note the unit explicitly (in / cm).

---

## 5. Note templates

### Customer (`20-wiki/customers/`)
```markdown
---
type: customer
aliases: []
status: lead | quoted | won | installed | warranty | lost
created: YYYY-MM-DD
tags: [customer]
---
# {{Name}}

- **Contact:** phone / email / address
- **Source:** how they found us
- **Rooms / openings:** count + locations
- **Products of interest:** [[Roller Shades - Blackout]] ...
- **Budget signal:**

## Timeline
- YYYY-MM-DD — first contact: ...
- YYYY-MM-DD — measured: ...
- YYYY-MM-DD — quoted $X: ...

## Notes
(preferences, gotchas, pets, access instructions)
```

### Product (`20-wiki/products/`)
```markdown
---
type: product
aliases: []
supplier: [[Supplier Name]]
created: YYYY-MM-DD
tags: [product]
---
# {{Product Line - Variant}}

- **Use case:**
- **Fabrics / finishes:**
- **Price (our cost / sell):**
- **Lead time:**
- **Install notes:** [[Operations - Install]]
- **Common objections / FAQs:**
```

### Supplier (`20-wiki/suppliers/`)
```markdown
---
type: supplier
created: YYYY-MM-DD
tags: [supplier]
---
# {{Supplier}}

- **Contact / rep:**
- **Terms:** payment, minimums, freight
- **Lead times:**
- **Price changes (dated log):**
  - YYYY-MM-DD — ...
- **Products we buy:** [[...]]
```

### Operations / SOP (`20-wiki/operations/`)
```markdown
---
type: sop
created: YYYY-MM-DD
tags: [operations, sop]
---
# {{Procedure}}

**When:** ...
**Steps:**
1. ...
**Gotchas / lessons learned (dated):**
- YYYY-MM-DD — ...
```

---

## 6. Working rules for you (Claude Code)

- **Be predictable, not clever.** Follow this file literally. Consistent filing
  beats smart-but-surprising filing.
- **Always link.** A note with no `[[backlinks]]` is a dead end. Connect it.
- **Never delete.** Supersede by moving to `90-archive/` with a pointer.
- **Verify before you finish.** After processing, confirm: inbox empty, every new
  fact lives in exactly one wiki note, provenance preserved in `10-raw/`, and you
  logged what you did (see §7).
- **Surface connections.** If new material relates to something already in the
  vault (a repeat customer, a supplier whose price just changed and who supplies
  a product three customers want), say so explicitly in your summary.
- **Ask only when it matters.** If filing is ambiguous in a way that affects a
  customer or money, leave a `> NEEDS REVIEW` callout instead of guessing.

---

## 7. After every processing run

Append one entry to `agents/logs/processing-log.md`:

```
## YYYY-MM-DD HH:MM — <what triggered this>
- Processed: <files from inbox>
- Created: [[...]]
- Extended: [[...]]
- Archived/merged: [[...]]
- Needs review: <anything flagged>
```

This log is how the system proves it did the work and how the owner skims what
changed without re-reading the whole vault.
