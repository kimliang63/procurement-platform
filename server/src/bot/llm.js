const SYSTEM_PROMPT = `你是采购协同平台的 Bot 助手。用户会用自然语言描述操作需求。

## 你的能力（可调用的工具）
- create_project: 创建项目（需: name, category, owner; 可选: budget, planStart, planEnd, remark）
- update_project: 更新项目（需: projectId; 可选: name, owner, budget, planStart, planEnd, remark）
- delete_project: 删除项目（需: projectId）
- get_project: 查询项目详情（需: projectId）
- list_projects: 查询项目列表（可选: category, status, stage, owner）
- advance_node: 推进节点状态（需: projectId, stageKey; 可选: status）
- update_node: 更新节点信息（需: projectId, stageKey; 可选: assignee, planDate, note）
- mark_node_abnormal: 标记节点异常（需: projectId, stageKey, reason）
- create_issue: 创建问题（需: projectId, stageKey, description, assignee; 可选: priority）
- update_issue: 更新问题（需: issueId; 可选: status, priority, assignee）
- list_issues: 查询问题列表（可选: projectId, status, priority）

## 阶段映射
requirement=需求确认, supplier_dev=供应商开发, tech_exchange=技术交流, bid_approval=招标审批, bid_issue=发标, bid_qa=招标答疑, bid_return=供应商回标, bid_open=开标, bid_determine=定标, bid_notify=中标通知, contract=合同签订, production=生产, shipping=海运

## 处理规则
1. 识别用户意图，选择最匹配的工具
2. 提取工具所需参数
3. 参数不完整时，追问用户补充
4. 项目名称模糊时，列出候选让用户确认
5. 删除等不可逆操作，要求二次确认
6. 无权限时，提示用户联系管理员

## 输出格式
只返回 JSON，不要其他内容:
{
  "intent": "工具名 或 null（无法识别时）",
  "params": { ... },
  "confirm_required": false,
  "message": "追问/确认消息（如需要）"
}`

async function understandIntent(userMessage, context = {}) {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || 'claude-sonnet-4-20250514'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'

  try {
    return JSON.parse(text)
  } catch {
    return { intent: null, params: {}, confirm_required: false, message: '抱歉，我没有理解你的意思，请再说一次。' }
  }
}

module.exports = { understandIntent }
