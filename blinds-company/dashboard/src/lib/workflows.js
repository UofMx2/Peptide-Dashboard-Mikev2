// Reads the Hermes-style agent workflow specs so the dashboard can list them.
const files = import.meta.glob('../../../agents/workflows/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const workflows = Object.entries(files).map(([path, raw]) => {
  const name = (raw.match(/^#\s*Workflow:\s*(.+)$/m) || [, path.split('/').pop()])[1]
  const type = (raw.match(/\*\*Type:\*\*\s*(.+)$/m) || [, ''])[1].trim()
  const trigger = (raw.match(/\*\*Trigger:\*\*\s*(.+)$/m) || [, ''])[1].trim()
  const goal = (raw.match(/\*\*Goal:\*\*\s*([\s\S]*?)(?:\n\n|\n##)/m) || [, ''])[1]
    .replace(/\s+/g, ' ')
    .trim()
  return { name: name.trim(), type, trigger, goal, slug: path.split('/').pop() }
})
