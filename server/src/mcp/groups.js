const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../db')

async function createGroup(params) {
  const fields = {
    chat_id: params.chat_id,
    project_id: params.project_id,
    project_name: params.project_name,
  }
  return await createRecord('groups', fields)
}

async function listGroups() {
  return await listRecords('groups')
}

async function getGroup(params) {
  const { groupId } = params
  return await getRecord('groups', groupId)
}

async function deleteGroup(params) {
  const { groupId } = params
  return await deleteRecord('groups', groupId)
}

module.exports = { createGroup, listGroups, getGroup, deleteGroup }
