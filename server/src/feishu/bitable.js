const client = require('./client')

const APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN

const TABLE_IDS = {
  projects: process.env.BITABLE_PROJECTS_TABLE_ID,
  nodes: process.env.BITABLE_NODES_TABLE_ID,
  issues: process.env.BITABLE_ISSUES_TABLE_ID,
  users: process.env.BITABLE_USERS_TABLE_ID,
  groups: process.env.BITABLE_GROUPS_TABLE_ID,
  weekly_config: process.env.BITABLE_WEEKLY_CONFIG_TABLE_ID,
}

async function listRecords(tableKey, filter = {}) {
  const tableId = TABLE_IDS[tableKey]
  if (!tableId) throw new Error(`Missing table ID for: ${tableKey}`)

  let allItems = []
  let pageToken = undefined

  do {
    const params = { page_size: 100 }
    if (filter.filter) params.filter = filter.filter
    if (pageToken) params.page_token = pageToken

    const res = await client.bitable.appTableRecord.list({
      path: { app_token: APP_TOKEN, table_id: tableId },
      params,
    })
    const items = res.data?.items || []
    allItems = allItems.concat(items)
    pageToken = res.data?.page_token
  } while (pageToken)

  return allItems
}

async function getRecord(tableKey, recordId) {
  const tableId = TABLE_IDS[tableKey]
  if (!tableId) throw new Error(`Missing table ID for: ${tableKey}`)
  const res = await client.bitable.appTableRecord.get({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  })
  return res.data?.record
}

async function createRecord(tableKey, fields) {
  const tableId = TABLE_IDS[tableKey]
  if (!tableId) throw new Error(`Missing table ID for: ${tableKey}`)

  const res = await client.bitable.appTableRecord.create({
    path: { app_token: APP_TOKEN, table_id: tableId },
    data: { fields },
  })

  // Feishu SDK may return record at res.data or res.data.record
  const record = res.data?.record || res.data
  if (!record || !record.record_id) {
    console.error('[Bitable] createRecord unexpected response:', JSON.stringify({ code: res.code, msg: res.msg, dataKeys: res.data ? Object.keys(res.data) : null }))
    throw new Error(`Bitable create failed: ${res.msg || 'no record_id in response'}`)
  }
  return record
}

async function updateRecord(tableKey, recordId, fields) {
  const tableId = TABLE_IDS[tableKey]
  if (!tableId) throw new Error(`Missing table ID for: ${tableKey}`)
  const res = await client.bitable.appTableRecord.update({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
    data: { fields },
  })
  return res.data?.record || res.data
}

async function deleteRecord(tableKey, recordId) {
  const tableId = TABLE_IDS[tableKey]
  if (!tableId) throw new Error(`Missing table ID for: ${tableKey}`)
  await client.bitable.appTableRecord.delete({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  })
}

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord, TABLE_IDS }
