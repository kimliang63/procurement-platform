require('dotenv').config()
const client = require('../src/feishu/client')

const DOC_ID = 'KUUGdnpNxoyvROxYcfXcd5gBnNe'

function textEl(content, bold = false) {
  return { text_run: { content, text_element_style: { bold } } }
}

function heading(level, text) {
  const types = { 1: 3, 2: 4, 3: 5 }
  return { block_type: types[level] || 3, heading: { level, elements: [textEl(text)] } }
}

function para(text, bold = false) {
  return { block_type: 2, text: { elements: [textEl(text, bold)] } }
}

function divider() {
  return { block_type: 22, divider: {} }
}

const blocks = [
  heading(1, '采购协同平台 V2 操作指南'),
  divider(),

  // 一
  heading(2, '一、系统访问'),
  para('Web 端：https://procurement-platform-rosy.vercel.app'),
  para('后端 API：https://procurement-server-production-b325.up.railway.app'),
  para(''),
  para('首次使用点击「飞书登录」，通过飞书 OAuth 授权后自动进入系统。第一个登录的用户自动成为管理员。'),
  divider(),

  // 二
  heading(2, '二、Web 端操作'),

  heading(3, '2.1 项目看板（首页）'),
  para('进入系统默认显示项目看板，包含：'),
  para('• 统计卡片：本年累计项目数、进行中项目、已定标项目、100万元以上项目'),
  para('• 各BU执行中项目：柱状图展示 FBU/LBU/ABU 各部门进行中的项目数'),
  para('• 各采购员负责的项目数量：横向柱状图'),
  para('• 年度采购金额：饼图展示各部门金额占比'),
  para('• 任务类型：饼图展示框架招标/单一来源/单次采购的分布'),

  heading(3, '2.2 创建项目'),
  para('1. 进入「项目列表」页面，点击右上角「创建项目」'),
  para('2. 填写以下信息：'),
  para('   • 项目名称（必填）：如"XX设备采购"'),
  para('   • 采购品类（必填）：设备/材料/服务/其他'),
  para('   • 所属部门（必填）：FBU/LBU/ABU'),
  para('   • 负责人（必填）：从用户列表选择'),
  para('   • 采购金额（必填）：单位万元'),
  para('   • 任务类型（必填）：框架招标/单一来源/单次采购＜100万/单次采购≥100万'),
  para('   • 计划开始/结束（必填）'),
  para('   • 备注（选填）'),
  para('3. 点击确定，系统自动编号（CG-2026-XXX）并初始化 15 个阶段节点'),

  heading(3, '2.3 项目列表（时间线视图）'),
  para('• 每个项目卡片展示 15 个阶段的时间线进度条'),
  para('• 颜色含义：绿色=已完成  蓝色=进行中  灰色=待开始  红色=异常/逾期'),
  para('• 点击项目卡片进入详情页'),
  para('• 支持按名称搜索、按负责人筛选'),

  heading(3, '2.4 项目详情'),
  para('基础信息区：负责人、采购金额、任务类型、所属部门、品类、计划周期', true),
  para(''),
  para('节点进度 Tab：', true),
  para('• 顶部时间线进度条，点击节点可编辑'),
  para('• 节点表格：阶段 | 状态 | 计划开始 | 计划结束 | 实际完成 | 问题数 | 操作'),
  para('• 点击「编辑」可修改节点的计划日期、实际完成日期、备注'),
  para('• 点击「创建问题」可为该节点添加问题'),
  para(''),
  para('问题列表 Tab：', true),
  para('• 展示该项目下的所有问题'),
  para('• 可直接修改问题状态（待处理/处理中/已关闭）'),

  heading(3, '2.5 问题追踪'),
  para('独立的问题管理页面，支持：'),
  para('• 按状态筛选（待处理/处理中/已关闭）'),
  para('• 按优先级筛选（高/中/低）'),
  para('• 创建问题时关联项目和阶段'),
  para('• 编辑和删除问题'),

  heading(3, '2.6 用户管理（仅管理员）'),
  para('• 查看所有已注册用户'),
  para('• 修改用户角色：管理员/项目经理/成员'),
  para('• 第一个通过飞书登录的用户自动成为管理员'),
  divider(),

  // 三
  heading(2, '三、飞书 Bot 操作'),

  heading(3, '3.1 添加 Bot'),
  para('在飞书应用管理后台将「采购项目小助手」添加到工作群。'),

  heading(3, '3.2 群聊绑定项目'),
  para('在群聊中发送：@采购项目小助手 绑定 XX设备采购项目'),
  para('一个群只能绑定一个项目。绑定后群内的 Bot 操作都针对该项目。'),

  heading(3, '3.3 自然语言指令'),
  para('Bot 支持自然语言交互，常用指令：'),
  para(''),
  para('创建项目：创建一个新项目，名称是CC服务采购，品类是服务，部门FBU，预算100万，明年全年'),
  para('查看项目：有哪些项目 / 查看XX项目'),
  para('查看节点：XX项目到哪一步了 / 查看项目节点'),
  para('推进节点：定标完成了 / 需求确认这个节点完成了'),
  para('标记异常：定标有问题 / 技术交流出问题了'),
  para('更新信息：XX项目的预算改成200万'),
  para('创建问题：XX设备采购的供应商C报价超预算了'),

  heading(3, '3.4 创建项目流程'),
  para('1. 发送创建指令（如"创建一个新项目"）'),
  para('2. Bot 追问缺少的信息（名称、品类、部门、预算、日期）'),
  para('3. 信息完整后 Bot 发送确认卡片'),
  para('4. 点击卡片「确认创建」按钮或回复"确认"/"好的"/"是"完成创建'),
  para('5. 群聊中创建的项目会自动绑定到当前群'),

  heading(3, '3.5 节点操作'),
  para('Bot 识别到节点操作意图后：'),
  para('• 自动关联当前绑定的项目（群聊）或最后查询的项目（私聊）'),
  para('• 标记完成后显示下一阶段提示'),
  para('• 无计划日期时提示需要先设置日期'),

  heading(3, '3.6 权限说明'),
  para(''),
  para('群聊查询：负责人 ✅  |  非负责人 ✅'),
  para('群聊创建/更新/推进节点：负责人 ✅  |  非负责人 ❌（提示"仅负责人可操作"）'),
  para('私聊操作自己负责的项目：✅'),
  para('私聊操作他人项目：❌'),

  heading(3, '3.7 周报'),
  para('发送"发周报"获取当前绑定项目的本周变化，包括：'),
  para('• 项目基本信息和进度'),
  para('• 本周有日期变动的节点（实际完成、计划开始/结束）'),
  para('管理员发送"管理周报"可查看全局周报。'),
  divider(),

  // 四
  heading(2, '四、节点阶段说明（15个）'),
  para(''),
  para('1. 需求确认 — 项目启动，确认采购需求'),
  para('2. 供应商开发 — 寻找和评估潜在供应商'),
  para('3. 技术交流 — 与供应商进行技术方案沟通'),
  para('4. 打样 — 供应商提供样品测试'),
  para('5. 招标方案审批 — 招标方案内部审批'),
  para('6. 发标 — 发布招标文件'),
  para('7. 答疑 — 回答供应商疑问'),
  para('8. 供应商回标 — 供应商提交投标文件'),
  para('9. 开标 — 开启投标文件'),
  para('10. 定标 — 确定中标供应商'),
  para('11. 中标/未中标通知 — 通知供应商结果'),
  para('12. 合同审批 — 合同签订前审批'),
  para('13. 生产 — 供应商生产制造'),
  para('14. 运输 — 货物运输到指定地点'),
  para('15. 验收 — 最终验收确认'),
  divider(),

  // 五
  heading(2, '五、业务规则'),

  heading(3, '5.1 任务类型与节点必填关系'),
  para(''),
  para('框架招标 / 单次采购≥100万（12个必填）：'),
  para('  需求确认、供应商开发、技术交流、招标方案审批、发标、答疑、供应商回标、开标、定标、中标通知、合同审批、打样'),
  para(''),
  para('单一来源 / 单次采购＜100万（4个必填）：'),
  para('  需求确认、发标、定标、合同审批'),
  para(''),
  para('其余节点显示但可不填写。'),

  heading(3, '5.2 项目编号规则'),
  para('• 纵腾（ZT）：CG-2026-001（流水号按年递增）'),
  para('• GOFO：GFCG-2026-001'),

  heading(3, '5.3 项目自动完成'),
  para('全部 15 个节点都设置了实际完成日期后，项目状态自动变为「项目完成」。'),
  divider(),

  // 六
  heading(2, '六、常见问题'),
  para('Q：登录后看到空白页面？', true),
  para('A：检查浏览器控制台是否有报错，确认后端服务正常运行。'),
  para(''),
  para('Q：创建项目提示"项目名称已存在"？', true),
  para('A：系统不允许同名项目，请更换名称。'),
  para(''),
  para('Q：Bot 不响应群聊消息？', true),
  para('A：确保已@机器人，或在@后的5分钟内发送消息。超过5分钟需要重新@。'),
  para(''),
  para('Q：Bot 提示"仅负责人可操作"？', true),
  para('A：只有项目负责人才能执行创建、更新、推进节点等写操作。非负责人只能查询。'),
  para(''),
  para('Q：节点状态显示不正确？', true),
  para('A：节点状态根据日期自动计算——在计划周期内显示"进行中"，超过计划结束日期未完成显示"逾期"，有实际完成日期显示"已完成"。'),
]

async function main() {
  const BATCH_SIZE = 10
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE)
    try {
      const res = await client.docx.documentBlockChildren.create({
        path: { document_id: DOC_ID, block_id: DOC_ID },
        params: { document_revision_id: -1 },
        data: { children: batch, index: -1 }
      })
      if (res.code !== 0) {
        console.error(`Batch ${i}-${i + batch.length} failed:`, res.msg)
      } else {
        console.log(`Batch ${i}-${i + batch.length} OK`)
      }
    } catch (e) {
      console.error(`Batch ${i}-${i + batch.length} error:`, e.response?.data?.msg || e.message)
    }
  }
  console.log('Done!')
}

main()
