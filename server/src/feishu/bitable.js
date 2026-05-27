const client = require('./client')

const APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN

const TABLE_IDS = {
  projects: process.env.BITABLE_PROJECTS_TABLE_ID,
  nodes: process.env.BITABLE_NODES_TABLE_ID,
  issues: process.env.BITABLE_ISSUES_TABLE_ID,
  users: process.env.BITABLE_USERS_TABLE_ID,
}

async function listRecords(tableKey, filter = {}) {
  const tableId = TABLE_IDS[tableKey]
  const params = { page_size: 100 }
  if (filter.filter) params.filter = filter.filter

  const res = await client.bitable.appTableRecord.list({
    path: { app_token: APP_TOKEN, table_id: tableId },
    params,
  })
  return res.data?.items || []
}

async function getRecord(tableKey, recordId) {
  const tableId = TABLE_IDS[tableKey]
  const res = await client.bitable.appTableRecord.get({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  })
  return res.data?.record
}

async function createRecord(tableKey, fields) {
  const tableId = TABLE_IDS[tableKey]
  const res = await client.bitable.appTableRecord.create({
    path: { app_token: APP_TOKEN, table_id: tableId },
    data: { fields },
  })
  return res.data?.record
}

async function updateRecord(tableKey, recordId, fields) {
  const tableId = TABLE_IDS[tableKey]
  const res = await client.bitable.appTableRecord.update({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
    data: { fields },
  })
  return res.data?.record
}

async function deleteRecord(tableKey, recordId) {
  const tableId = TABLE_IDS[tableKey]
  await client.bitable.appTableRecord.delete({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  })
}

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord, TABLE_IDS }
