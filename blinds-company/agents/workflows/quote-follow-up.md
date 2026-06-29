# Workflow: Quote Follow-Up

**Type:** operator / repeatable
**Trigger:** "run quote follow-ups" (manual or weekly schedule).
**Goal:** No quoted customer goes cold. Draft the right follow-up for each one,
informed by everything already in their note.

## Steps
1. Search `vault/20-wiki/customers/` for notes with `status: quoted`.
2. For each, read the timeline and find the date of the last contact.
3. Apply the cadence:
   - **3 days** after quote, no reply → friendly check-in.
   - **7 days** → answer the likely objection (price, lead time, fabric choice)
     using that customer's noted concerns + the relevant `[[product]]` note.
   - **14 days** → last-touch with a reason to act (seasonal offer, lead-time
     warning) pulled from `vault/20-wiki/marketing/`.
   - **>30 days, no reply** → set `status: lost`, add a dated timeline line, stop.
4. **Draft** each message (don't send). Personalize from the customer note —
   names, rooms, product, budget signal. Keep it short and human.
5. Append the proposed message to that customer's note under `## Timeline` as a
   `DRAFT — not sent` entry so the owner can approve and send.
6. Log the run in `../logs/follow-up-log.md`: who was due, what stage, what you drafted.

## Verification
- [ ] Every `quoted` customer was evaluated.
- [ ] No message references facts not in that customer's note.
- [ ] Drafts written, nothing auto-sent; lost leads correctly retired.

## Notes
This is the slice that replaces routine VA follow-up. It gets faster and better
the more customer history the vault accumulates.
