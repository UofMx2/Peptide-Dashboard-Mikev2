# Workflow: Supplier Price Watch

**Type:** operator / repeatable
**Trigger:** "run supplier price watch", or whenever a supplier price change lands
in `00-inbox/`.
**Goal:** A supplier price/lead-time change never silently erodes your margin.
Catch it, log it, and surface every product and active quote it touches.

## Steps
1. Read any new supplier emails/notes in `vault/00-inbox/` (or re-scan
   `vault/20-wiki/suppliers/` if triggered manually).
2. For each price or lead-time change:
   - Append a dated line to that supplier's `## Price changes` log.
   - Find every `[[product]]` note where `supplier:` points to them.
   - For each affected product, recompute the margin if a sell price is recorded,
     and flag products now under your target margin with `> MARGIN ALERT`.
3. Cross-check **active quotes**: search `customers/` for `status: quoted`
   referencing an affected product → list customers whose quote is now mispriced.
4. Write a short briefing to `../logs/price-watch-log.md`:
   - What changed, which products, which open quotes are exposed, recommended action.

## Verification
- [ ] Every changed supplier note has a dated price-change entry.
- [ ] All downstream products + open quotes traced and listed.
- [ ] Margin alerts raised where sell price is known.

## Definition of done
The owner sees, in one briefing, exactly what the price change costs them and
which customers to re-quote — without checking each product by hand.
