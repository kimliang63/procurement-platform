// Backfill nodes for projects that are missing them
require('dotenv').config()
const { listRecords } = require('../src/feishu/bitable')
const { initProjectNodes, STAGE_MAP } = require('../src/mcp/nodes')

async function main() {
  const [projects, allNodes] = await Promise.all([
    listRecords('projects'),
    listRecords('nodes'),
  ])

  // Build set of projectIds that already have nodes
  const projectsWithNodes = new Set(allNodes.map(n => n.fields?.project_id).filter(Boolean))

  const missing = projects.filter(p => !projectsWithNodes.has(p.record_id))
  console.log(`Total projects: ${projects.length}`)
  console.log(`Projects with nodes: ${projectsWithNodes.size}`)
  console.log(`Projects missing nodes: ${missing.length}`)

  for (const p of missing) {
    const name = p.fields?.name || p.record_id
    try {
      const records = await initProjectNodes({ projectId: p.record_id })
      console.log(`✅ ${name} — created ${records.length} nodes`)
    } catch (e) {
      console.error(`❌ ${name} — ${e.message}`)
    }
  }

  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })
