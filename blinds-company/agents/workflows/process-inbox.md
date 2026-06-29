# Workflow: Process Inbox

**Type:** core / run often
**Trigger:** "process the inbox" (manual), or on a schedule once you trust it.
**Goal:** Move everything in `vault/00-inbox/` into clean, linked wiki notes with
zero raw fragments left behind.

## Steps
1. Read `../../CLAUDE.md` in full — it is the contract for filing.
2. List every file/note in `vault/00-inbox/`.
3. For each item, run the §2 processing loop from `CLAUDE.md`:
   classify → create-vs-extend (§3) → write clean note → preserve original in
   `vault/10-raw/` → cross-link.
4. After all items: verify the inbox is empty and every new fact lives in exactly
   one wiki note.
5. Append a run entry to `../logs/processing-log.md` (format in `CLAUDE.md` §7).

## Verification (do not skip)
- [ ] `00-inbox/` is empty.
- [ ] Each processed original sits in `10-raw/` renamed `YYYY-MM-DD--slug.md`, unedited.
- [ ] No duplicate entity notes were created (searched aliases first).
- [ ] Every new note has at least one `[[backlink]]`.
- [ ] `> NEEDS REVIEW` left on anything genuinely ambiguous.

## Definition of done
The owner can open one obvious wiki note and find the answer without reading raw.
