# V2 Bot 群聊/私聊项目管理设计

## 概述

为飞书 Bot 增强群聊和私聊场景下的项目管理能力，支持群聊绑定项目、权限控制、项目看板卡片。

## 需求

1. **群聊绑定项目**：一个群聊只能关联一个项目，通过 @bot 绑定
2. **私聊管理**：个人可管理自己负责的所有项目
3. **权限控制**：项目负责人可读写，其他成员只读
4. **看板卡片**：查询类操作统一返回项目看板卡片（13 阶段进度条 + 问题统计）
5. **私聊建群**：私聊创建项目后可选择创建群聊并自动绑定

## 数据模型

### 新增 Bitable 表：chat_bindings

| 字段 | 类型 | 说明 |
|------|------|------|
| chat_id | 文本 | 飞书群聊 ID（唯一） |
| project_id | 文本 | 关联项目 ID |
| chat_name | 文本 | 群聊名称（冗余） |
| project_name | 文本 | 项目名称（冗余） |
| operator_id | 文本 | 绑定人 open_id |
| operator_name | 文本 | 绑定人姓名 |
| bind_time | 日期 | 绑定时间 |

约束：一个 `chat_id` 只能有一条活跃绑定记录。

## Bot 交互流程

### 群聊绑定流程

```
用户 @bot: "绑定 kim演示项目001"
    ↓
Bot 查询项目，校验用户是否为负责人
    ↓
负责人 → 发送确认卡片（项目信息 + 确认/取消按钮）
    ↓
用户点击确认 → 写入 chat_bindings 表
    ↓
Bot 回复：已绑定成功
```

### 群聊操作流程

```
用户 @bot: "查询进度"
    ↓
Bot 查 chat_bindings 表获取绑定的 projectId
    ↓
无绑定 → 提示"请先绑定项目"
    ↓
有绑定 → 校验权限（是否为负责人）
    ↓
负责人 → 执行操作（读写）
    ↓
非负责人 → 只允许查询，写操作提示"仅负责人可操作"
    ↓
返回项目看板卡片
```

### 私聊流程

```
用户私聊: "查询进度"
    ↓
Bot 查询该用户负责的所有项目
    ↓
无项目 → 提示"暂无负责的项目"
    ↓
1 个项目 → 直接显示看板卡片
    ↓
多个项目 → 列出项目列表，用户选择
    ↓
用户: "创建一个新项目"
    ↓
创建成功后 → 提示"是否创建群聊并绑定此项目？"
    ↓
用户确认 → 调用飞书 API 创建群聊 + 自动绑定
```

## 项目看板卡片

```
┌─────────────────────────────────────────┐
│  📋 项目看板                             │
├─────────────────────────────────────────┤
│  kim演示项目001 · CG-2026-685162        │
│  负责人: 梁景悦 | 部门: FBU | 品类: 材料 │
├─────────────────────────────────────────┤
│  进度: ████████████░░░░░░░ 53%          │
│                                         │
│  ✅ 需求确认 (06/04)    ✅ 供应商开发    │
│  🔄 技术交流 (进行中)   ○ 招标审批       │
│  ○ 发标                ○ 招标答疑       │
│  ○ 供应商回标           ○ 开标           │
│  ○ 定标                ○ 中标通知       │
│  ○ 合同签订             ○ 生产           │
│  ○ 海运                                  │
├─────────────────────────────────────────┤
│  💰 预算: 100万                         │
│  📅 计划: 2026-06-01 ~ 2026-07-31      │
│  ⚠️ 待处理问题: 1 | 处理中: 0           │
├─────────────────────────────────────────┤
│  [查看Web端] [更新节点] [创建问题]       │
└─────────────────────────────────────────┘
```

按钮权限：
- `查看Web端` → 所有人可点
- `更新节点` → 仅负责人可点
- `创建问题` → 仅负责人可点

## 权限模型

### 权限中间件 resolveContext

```javascript
async function resolveContext(event) {
  const chatType = event.message?.chat_type
  const chatId = event.message?.chat_id
  const senderId = event.sender?.sender_id?.open_id

  if (chatType === 'group') {
    const binding = await getBindingByChatId(chatId)
    if (!binding) return { error: '请先绑定项目，发送"绑定 项目名"' }
    return {
      projectId: binding.project_id,
      isOwner: await checkIsOwner(senderId, binding.project_id),
    }
  }

  // 私聊：按负责人过滤
  return {
    projectId: null,
    isOwner: true,
    isPrivate: true,
  }
}
```

### 权限校验规则

| 场景 | 查询操作 | 写操作 |
|------|---------|--------|
| 群聊 + 负责人 | ✅ | ✅ |
| 群聊 + 非负责人 | ✅ | ❌ |
| 私聊 | ✅（仅自己的项目） | ✅（仅自己的项目） |

## 实现计划

| 阶段 | 内容 | 文件 |
|------|------|------|
| P1 | 新增 chat_bindings Bitable 表 | `server/src/feishu/bitable.js` |
| P1 | 绑定/解绑 MCP 工具 | `server/src/mcp/bindings.js` |
| P1 | 权限中间件 resolveContext | `server/src/bot/auth.js` |
| P1 | 看板卡片模板 | `server/src/bot/cards.js` |
| P2 | 私聊创建群聊流程 | `server/src/bot/index.js` |
| P2 | LLM prompt 更新 | `server/src/bot/llm.js` |
| P2 | 消息处理流程重构 | `server/src/bot/index.js` |
| P3 | 卡片按钮权限控制 | `server/src/bot/cards.js` |
| P3 | 解绑/换绑功能 | `server/src/mcp/bindings.js` |

## 飞书 API 依赖

- 创建群聊：`POST /open-apis/im/v1/chats`
- 群聊信息：`GET /open-apis/im/v1/chats/{chat_id}`
- 已有能力：消息收发、卡片交互、用户信息

## 技术约束

- 飞书免费层：群聊绑定表 page_size 100，需考虑分页
- LLM 意图识别：新增 `bind_project`、`unbind_project`、`create_chat` 意图
- 卡片回调：复用现有 `card.action.trigger` 事件
