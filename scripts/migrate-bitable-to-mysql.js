const lark = require('@larksuiteoapi/node-sdk');
const mysql = require('mysql2/promise');

const client = new lark.Client({
  appId: 'cli_aa9c0ff0f8b99cc0',
  appSecret: 'pozBMDCCISwXZBUg5gebegFt6OwLE3Y1',
  domain: lark.Domain.Feishu,
});

const APP_TOKEN = 'X5vibxFpRaEeZZswzBXcDyicn11';
const BITABLE_TABLES = {
  projects: 'tblcMKSp0KMOMPtF',
  users: 'tblQg4lgNVP4QAus',
  nodes: 'tbliBMYiYEIBa90a',
  issues: 'tblPiwDuixcJTQdP',
};

const pool = mysql.createPool({
  host: '10.100.12.119',
  port: 63307,
  user: 'dev_hars_ai_user',
  password: 'FqVcXcotTk91M18Voz4V',
  database: 'assc_srm',
  charset: 'utf8mb4',
  timezone: '+08:00',
});

async function fetchAll(tableId) {
  const items = [];
  let pageToken;
  do {
    const res = await client.bitable.appTableRecord.list({
      path: { app_token: APP_TOKEN, table_id: tableId },
      params: { page_size: 500, ...(pageToken ? { page_token: pageToken } : {}) },
    });
    if (res.data?.items) items.push(...res.data.items);
    pageToken = res.data?.has_more ? res.data.page_token : null;
  } while (pageToken);
  return items;
}

async function main() {
  console.log('=== 开始数据迁移 ===\n');

  // 1. Fetch all Bitable data
  console.log('读取 Bitable...');
  const [bitProjects, bitUsers, bitNodes, bitIssues] = await Promise.all([
    fetchAll(BITABLE_TABLES.projects),
    fetchAll(BITABLE_TABLES.users),
    fetchAll(BITABLE_TABLES.nodes),
    fetchAll(BITABLE_TABLES.issues),
  ]);
  console.log(`  projects: ${bitProjects.length}`);
  console.log(`  users: ${bitUsers.length}`);
  console.log(`  nodes: ${bitNodes.length}`);
  console.log(`  issues: ${bitIssues.length}\n`);

  // 2. Migrate users (skip duplicates by feishu_open_id)
  console.log('迁移 users...');
  let usersInserted = 0, usersSkipped = 0;
  const [existingUsers] = await pool.execute('SELECT feishu_open_id FROM users');
  const existingOpenIds = new Set(existingUsers.map(u => u.feishu_open_id));

  for (const rec of bitUsers) {
    const f = rec.fields;
    const openId = f.feishu_open_id || '';
    if (!openId || existingOpenIds.has(openId)) {
      usersSkipped++;
      continue;
    }
    await pool.execute(
      'INSERT INTO users (feishu_open_id, feishu_user_id, name, avatar, role) VALUES (?, ?, ?, ?, ?)',
      [String(openId), String(f.feishu_user_id || ''), String(f.name || ''), String(f.avatar || ''), String(f.role || 'pm')]
    );
    existingOpenIds.add(openId);
    usersInserted++;
  }
  console.log(`  新增: ${usersInserted}, 跳过: ${usersSkipped}\n`);

  // 3. Migrate projects
  console.log('迁移 projects...');
  const idMap = {}; // old_rec_id → new_mysql_id
  let projectsInserted = 0;

  for (const rec of bitProjects) {
    const f = rec.fields;
    const fields = {
      name: String(f.name || ''),
      no: String(f.no || ''),
      owner: String(f.owner || ''),
      budget: parseFloat(f.budget) || 0,
      category: String(f.category || ''),
      department: String(f.department || ''),
      task_type: String(f.task_type || ''),
      is_single_source: String(f.is_single_source || ''),
      procurement_method: String(f.procurement_method || ''),
      plan_start: f.plan_start || null,
      plan_end: f.plan_end || null,
      current_stage: String(f.current_stage || 'requirement'),
      status: String(f.status || '进行中'),
      remark: String(f.remark || ''),
      company: 'ZT',
    };

    const columns = Object.keys(fields);
    const placeholders = columns.map(() => '?');
    const values = columns.map(k => fields[k]);

    const [result] = await pool.execute(
      `INSERT INTO projects (${columns.map(c => '`' + c + '`').join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    idMap[rec.record_id] = result.insertId;
    projectsInserted++;
  }
  console.log(`  新增: ${projectsInserted}\n`);

  // 4. Migrate nodes
  console.log('迁移 nodes...');
  let nodesInserted = 0, nodesSkipped = 0;

  for (const rec of bitNodes) {
    const f = rec.fields;
    const oldProjectId = f.project_id || '';
    const newProjectId = idMap[oldProjectId];
    if (!newProjectId) {
      nodesSkipped++;
      continue;
    }

    const fields = {
      project_id: newProjectId,
      stage_key: String(f.stage_key || ''),
      stage_label: String(f.stage_label || ''),
      '`order`': parseInt(f.order) || 0,
      status: String(f.status || 'pending'),
      plan_start: f.plan_start || null,
      plan_end: f.plan_end || null,
      actual_date: f.actual_date || null,
      note: String(f.note || ''),
      abnormal_reason: String(f.abnormal_reason || ''),
      assignee: String(f.assignee || ''),
    };

    const columns = Object.keys(fields);
    const values = columns.map(k => fields[k]);
    const colNames = columns.map(c => c === '`order`' ? '`order`' : '`' + c + '`');

    try {
      await pool.execute(
        `INSERT INTO nodes (${colNames.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values
      );
      nodesInserted++;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        // Update existing node instead
        const setClauses = columns
          .filter(c => c !== 'project_id' && c !== 'stage_key')
          .map(c => (c === '`order`' ? '`order`' : '`' + c + '`') + ' = ?');
        const updateValues = columns
          .filter(c => c !== 'project_id' && c !== 'stage_key')
          .map(k => fields[k]);
        await pool.execute(
          `UPDATE nodes SET ${setClauses.join(', ')} WHERE project_id = ? AND stage_key = ?`,
          [...updateValues, newProjectId, fields.stage_key]
        );
        nodesSkipped++;
      } else {
        throw e;
      }
    }
  }
  console.log(`  新增: ${nodesInserted}, 跳过（无匹配项目）: ${nodesSkipped}\n`);

  // 5. Migrate issues
  console.log('迁移 issues...');
  let issuesInserted = 0, issuesSkipped = 0;

  for (const rec of bitIssues) {
    const f = rec.fields;
    const oldProjectId = f.project_id || '';
    const newProjectId = idMap[oldProjectId];
    if (!newProjectId) {
      issuesSkipped++;
      continue;
    }

    await pool.execute(
      'INSERT INTO issues (project_id, stage_key, description, assignee, priority, status) VALUES (?, ?, ?, ?, ?, ?)',
      [newProjectId, String(f.stage_key || ''), String(f.description || ''), String(f.assignee || ''), String(f.priority || '中'), String(f.status || 'open')]
    );
    issuesInserted++;
  }
  console.log(`  新增: ${issuesInserted}, 跳过（无匹配项目）: ${issuesSkipped}\n`);

  // 6. Verify
  console.log('=== 迁移完成，验证 ===');
  const [p] = await pool.execute('SELECT COUNT(*) as cnt FROM projects');
  const [u] = await pool.execute('SELECT COUNT(*) as cnt FROM users');
  const [n] = await pool.execute('SELECT COUNT(*) as cnt FROM nodes');
  const [i] = await pool.execute('SELECT COUNT(*) as cnt FROM issues');
  console.log(`projects: ${p[0].cnt}`);
  console.log(`users: ${u[0].cnt}`);
  console.log(`nodes: ${n[0].cnt}`);
  console.log(`issues: ${i[0].cnt}`);

  await pool.end();
  console.log('\nDone.');
}

main().catch(e => {
  console.error('Migration failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
