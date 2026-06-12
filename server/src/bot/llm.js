const SYSTEM_PROMPT = `你是采购协同平台的 Bot 助手。

## 核心职责
理解用户意图，基于上下文推断操作，收集必要信息，确认后执行。

## 可用工具
- create_project: 创建项目
- update_project: 更新项目
- delete_project: 删除项目
- get_project: 查询项目详情（需要projectId或name）
- list_projects: 查询项目列表
- list_project_nodes: 查询项目的全部节点（需要projectId或name）
- advance_node: 推进节点状态（需要projectId、stageKey）
- update_node: 更新节点信息（需要projectId、stageKey）
- mark_node_abnormal: 标记节点异常（需要projectId、stageKey、reason）
- create_issue: 创建问题
- update_issue: 更新问题
- delete_issue: 删除问题
- list_issues: 查询问题列表

## 15个阶段（按顺序）
requirement(需求确认) → supplier_dev(供应商开发) → tech_exchange(技术交流) → sampling(打样) → bid_approval(招标方案审批) → bid_issue(发标) → bid_qa(答疑) → bid_return(供应商回标) → bid_open(开标) → bid_determine(定标) → bid_notify(中标/未中标通知) → contract_approval(合同审批) → production(生产) → shipping(运输) → acceptance(验收)

## 创建项目必填字段
name(项目名称)、category(采购品类:设备/材料/服务/其他)、owner(负责人)、department(所属部门:FBU/LBU/ABU)、budget(预算万元，数字)、isSingleSource(是否单一来源:是/否)、procurementMethod(采购方式:框架类/项目类)、planStart(计划开始日期)、planEnd(计划结束日期)

### 字段提取规则
- 用户说"单一来源" → isSingleSource="是"
- 用户没说"单一来源" → isSingleSource="否"
- 用户说"框架" → procurementMethod="框架类"
- 用户说"项目类"或没特别说明 → procurementMethod="项目类"
- 预算金额档位从 budget 数字自动推导（<100万或≥100万），无需用户提供

## 节点操作必填字段
- advance_node: projectId、stageKey、status(可选,默认completed)
- update_node: projectId、stageKey、以及要更新的字段(plan_date/actual_date/note等)
- mark_node_abnormal: projectId、stageKey、reason
- list_project_nodes: projectId或name

## 对话理解规则（极其重要）

### 项目上下文
- 用户提到项目名称时，后续对话默认指该项目，无需重复提供projectId
- 提到项目名称时可同时带 name 参数，系统会自动查找

### 意图识别（按优先级）
1. 创建类："创建/新建/新增" → create_project
2. 查询类："有哪些项目/查看/查询" + 项目名 → get_project 或 list_project_nodes
3. 节点查询："在什么节点/进度/到哪了" → list_project_nodes
4. 节点推进："完成了/完成了/推进/下一步/完成XX节点" → advance_node，从上下文推断stageKey
5. 节点更新："更新日期/修改计划/备注是XX" → update_node
6. 异常标记："异常/出问题/阻塞" → mark_node_abnormal
7. 纯问答：关于平台功能、品类、流程等 → intent为null，直接回答

### 上下文推断示例
- 对话历史中有项目"采购测试项目"，用户说"需求确认完成了" → advance_node + stageKey=requirement
- 用户说"现在在什么节点了" → list_project_nodes
- 用户说"这个节点已经完成了" → advance_node + 从上下文推断当前节点
- 用户说"进度更新了吗" → intent为null，回答查询结果（不执行操作）
- 用户说"供应商开发开始日期是3月1号" → update_node + stageKey=supplier_dev + plan_date
- 用户说"技术交流出问题了" → mark_node_abnormal + stageKey=tech_exchange

### 澄清与确认
- 无法推断projectId时：追问"请问是哪个项目？"
- 无法推断stageKey时：追问"请问是哪个阶段？"
- 信息完整后：向用户确认，等用户说"确认"才执行

## 输出格式（极其重要）
你必须只返回一个合法的JSON对象，不要包含任何其他文字、markdown代码块、或解释。
- 操作意图：{"intent": "advance_node", "params": {"name": "项目名", "stageKey": "requirement"}, "message": "确认将需求确认节点标记为完成？"}
- 查询意图：{"intent": "list_project_nodes", "params": {"name": "项目名"}, "message": "正在查询项目节点"}
- 纯问答：{"intent": null, "params": {}, "message": "回答内容"}
- 追问：{"intent": "create_project", "params": {"name": "测试"}, "message": "好的，请问采购品类是什么？"}`

// 每个用户的对话状态
const userSessions = new Map()
const MAX_HISTORY = 20

// 从 LLM 响应中提取 JSON（处理 markdown 包裹或混在文本中的情况）
function extractJson(text) {
  // 直接解析
  try { return JSON.parse(text) } catch {}
  // 去除 markdown 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) } catch {}
  }
  // 尝试提取第一个 { 到最后一个 }
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]) } catch {}
  }
  return null
}

// 从纯文本 LLM 回复中提取参数（JSON 解析失败时的兜底）
// 只在用户有创建意图时才提取，避免 Q&A 回答被误判为 create_project
function parseFromPlainText(text, pendingParams, userMessage = '') {
  const params = {}
  // 统一去掉 markdown 粗体标记
  const clean = text.replace(/\*\*/g, '')

  // 项目名称
  const nameMatch = clean.match(/项目名称[为是：:]\s*["""]?(.+?)["""]?\s*$/m)
  if (nameMatch) params.name = nameMatch[1].trim()

  // 品类（支持 "品类" / "采购品类"）
  const catMatch = clean.match(/采购品类[为是：:]\s*["""]?(设备|材料|服务|其他)["""]?/)
  if (!catMatch) {
    const catMatch2 = clean.match(/品类[为是：:]\s*["""]?(设备|材料|服务|其他)["""]?/)
    if (catMatch2) params.category = catMatch2[1]
  } else {
    params.category = catMatch[1]
  }

  // 部门（支持 "部门" / "所属部门"）
  const deptMatch = clean.match(/所属部门[为是：:]\s*["""]?(FBU|LBU|ABU)["""]?/i)
  if (!deptMatch) {
    const deptMatch2 = clean.match(/部门[为是：:]\s*["""]?(FBU|LBU|ABU)["""]?/i)
    if (deptMatch2) params.department = deptMatch2[1].toUpperCase()
  } else {
    params.department = deptMatch[1].toUpperCase()
  }

  // 预算（支持 "预算500万" / "预算为500万" / "预算：500万"）
  const budgetMatch = clean.match(/预算[为是：:]*\s*["""]?(\d+(?:\.\d+)?)\s*万/)
  if (budgetMatch) params.budget = parseFloat(budgetMatch[1])

  // 日期（支持 "开始日期为" / "计划开始日期" / "开始日期"）
  const startMatch = clean.match(/(?:计划)?开始(?:日期)?[为是：:]*\s*["""]?(\d{4}-\d{2}-\d{2})/)
  if (startMatch) params.planStart = startMatch[1]
  const endMatch = clean.match(/(?:计划)?结束(?:日期)?[为是：:]*\s*["""]?(\d{4}-\d{2}-\d{2})/)
  if (endMatch) params.planEnd = endMatch[1]

  // 负责人（支持 "负责人是XX" / "负责人XX"）
  const ownerMatch = clean.match(/负责人[为是：:]*\s*["""]?(.+?)["""]?\s*$/m)
  if (ownerMatch) params.owner = ownerMatch[1].trim()

  // 是否单一来源
  if (/单一来源/.test(clean)) {
    params.isSingleSource = '是'
  }

  // 采购方式
  if (/框架/.test(clean)) {
    params.procurementMethod = '框架类'
  } else if (/项目类/.test(clean)) {
    params.procurementMethod = '项目类'
  }

  // 如果没有提取到任何参数，但在创建流程中且文本很短，视为当前追问的回答
  if (Object.keys(params).length === 0) {
    const hasCreateIntent = /创建|新建|新增/.test(userMessage) || pendingParams?.name
    if (hasCreateIntent && clean.length <= 10) {
      // 短文本在创建流程中 → 作为负责人（最常见的追问字段）
      if (!pendingParams?.owner && !pendingParams?.category && !pendingParams?.department) {
        // 还没到负责人步骤，不乱填
      } else if (!pendingParams?.owner) {
        params.owner = clean
      }
    }
  }

  if (Object.keys(params).length === 0) return null

  // 判断用户是否有创建意图：用户消息含创建关键词，或已有 pending 的创建流程
  const hasCreateIntent = /创建|新建|新增/.test(userMessage) || pendingParams?.name
  if (!hasCreateIntent) return null

  return {
    intent: 'create_project',
    params: { ...pendingParams, ...params },
    message: text,
  }
}

async function callLlm(messages, apiKey, model, baseUrl) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 1024,
    }),
  })
  const data = await response.json()
  return data.choices?.[0]?.message?.content || '{}'
}

async function understandIntent(userMessage, senderId = 'default', senderName = null) {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || 'deepseek-chat'
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.deepseek.com'

  // 获取会话
  if (!userSessions.has(senderId)) {
    userSessions.set(senderId, { history: [], pendingAction: null, currentProjectId: null })
  }
  const session = userSessions.get(senderId)

  // 检测新会话开始：用户发送创建类指令且当前没有进行中的操作
  const isNewFlow = /创建|新建|新增/.test(userMessage) && !session.pendingAction
  if (isNewFlow) {
    session.history = []
    session.pendingAction = null
  }

  // 添加用户消息
  session.history.push({ role: 'user', content: userMessage })

  // 保留最近消息
  while (session.history.length > MAX_HISTORY) {
    session.history.shift()
  }

  // 构建消息，包含会话状态提示
  let systemMsg = SYSTEM_PROMPT
  if (senderName) {
    systemMsg += `\n\n## 当前用户\n当前发消息的用户姓名是"${senderName}"。创建项目时负责人默认填此姓名，不要编造或追问。`
  }
  if (session.pendingAction) {
    systemMsg += `\n\n## 当前会话状态\n用户正在${session.pendingAction.intent === 'create_project' ? '创建项目' : '执行操作'}，已收集的参数：${JSON.stringify(session.pendingAction.params)}`
  }

  const messages = [
    { role: 'system', content: systemMsg },
    ...session.history,
  ]

  // 调用 LLM
  let text = await callLlm(messages, apiKey, model, baseUrl)
  console.log('LLM raw response:', text)

  let result = extractJson(text)
  if (!result) {
    // 直接从纯文本提取，不再用 strict prompt 重试（避免编造数据）
    console.log('LLM JSON extraction failed, trying plain text extraction...')
    result = parseFromPlainText(text, session.pendingAction?.params || {}, userMessage)
    if (result) console.log('Extracted from plain text:', JSON.stringify(result))
  }

  if (result) {

    // 添加助手回复到历史
    if (result.message) {
      session.history.push({ role: 'assistant', content: result.message })
    }

    // 如果是创建项目且信息不完整，更新待处理状态
    if (result.intent === 'create_project' && result.params) {
      // 合并之前的参数
      const prevParams = session.pendingAction?.params || {}
      result.params = { ...prevParams, ...result.params }
      session.pendingAction = { intent: result.intent, params: result.params }
    }

    // 如果用户确认，清空会话（严格匹配，避免"是一个好项目"误触发）
    const trimmed = userMessage.trim()
    const confirmWords = ['确认', '确定', '是的', '好的', '可以', '没问题', '行']
    const singleCharConfirm = ['是', '好']
    const isConfirm = confirmWords.includes(trimmed) || (singleCharConfirm.includes(trimmed) && trimmed.length <= 2)
    if (isConfirm) {
      if (session.pendingAction) {
        result.intent = session.pendingAction.intent
        result.params = session.pendingAction.params
        session.pendingAction = null
        session.history = []
      }
    }

    // 如果用户取消
    const cancelWords = ['取消', '不要', '算了', '不做了']
    const singleCharCancel = ['否']
    const isCancel = cancelWords.includes(trimmed) || (singleCharCancel.includes(trimmed) && trimmed.length <= 2)
    if (isCancel) {
      session.pendingAction = null
      session.history = []
      result.intent = null
      result.message = '已取消操作'
    }

    return result
  } else {
    console.log('LLM returned non-JSON, using raw text:', text)
    // 保留 LLM 原文作为回复，而非固定错误文本
    return { intent: null, params: {}, message: text || '抱歉，请再说一次。' }
  }
}

function getSession(senderId) {
  return userSessions.get(senderId)
}

module.exports = { understandIntent, getSession, extractJson, parseFromPlainText }

