const projects = require('./projects')
const nodes = require('./nodes')
const issues = require('./issues')
const rules = require('./rules')
const groups = require('./groups')

const TOOLS = {
  create_project: projects.createProject,
  update_project: projects.updateProject,
  delete_project: projects.deleteProject,
  get_project: projects.getProject,
  list_projects: projects.listProjects,
  init_project_nodes: nodes.initProjectNodes,
  advance_node: nodes.advanceNode,
  update_node: nodes.updateNode,
  mark_node_abnormal: nodes.markNodeAbnormal,
  list_project_nodes: nodes.listProjectNodes,
  create_issue: issues.createIssue,
  update_issue: issues.updateIssue,
  delete_issue: issues.deleteIssue,
  list_issues: issues.listIssues,
  create_group: groups.createGroup,
  list_groups: groups.listGroups,
  get_group: groups.getGroup,
  delete_group: groups.deleteGroup,
}

async function callTool(toolName, params) {
  const fn = TOOLS[toolName]
  if (!fn) throw new Error(`Unknown tool: ${toolName}`)
  return await fn(params)
}

const { getMandatoryNodes, isNodeMandatory, getNodeValidation, getNodeRule, getVisibleNodes, getRequiredNodes, NODE_RULES } = rules

module.exports = {
  callTool, TOOLS, STAGE_MAP: nodes.STAGE_MAP, STAGE_KEYS: nodes.STAGE_KEYS,
  getMandatoryNodes, isNodeMandatory, getNodeValidation,
  getNodeRule, getVisibleNodes, getRequiredNodes, NODE_RULES,
}
