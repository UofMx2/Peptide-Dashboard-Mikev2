// Browser-side vault access.
//
// Two modes:
//  - With the model server running, loadVault() fetches the live vault from
//    /api/vault, so edits and workflow actions show up without a rebuild.
//  - As a static build (npm run build/preview, no server), it falls back to the
//    markdown bundled at build time via import.meta.glob.
//
// `vault` is a single mutable object; loadVault() Object.assigns into it so the
// components (which read vault.customers etc.) see updated data after a refresh.

import { buildVault, STATUS_ORDER, money } from './parse.js'

// vault.js lives in dashboard/src/lib, so the vault is three levels up.
const globFiles = import.meta.glob('../../../vault/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const fallback = buildVault(
  Object.entries(globFiles).map(([path, raw]) => ({ path, raw })),
)

export const vault = { ...fallback }
export { STATUS_ORDER, money }

let serverAvailable = false
export const isServerAvailable = () => serverAvailable

export async function loadVault() {
  try {
    const r = await fetch('/api/vault', { cache: 'no-store' })
    if (!r.ok) throw new Error('no server')
    const data = await r.json()
    Object.assign(vault, data)
    serverAvailable = true
  } catch {
    Object.assign(vault, fallback)
    serverAvailable = false
  }
  return vault
}

// Trigger a server-side workflow action, then return its JSON result.
export async function runAction(name) {
  const r = await fetch(`/api/actions/${name}`, { method: 'POST' })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(text || `Action ${name} failed (${r.status})`)
  }
  return r.json()
}
