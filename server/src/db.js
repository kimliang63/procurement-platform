const mysql = require('mysql2/promise')

// ── Connection Pool ──────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '10.100.12.119',
  port: parseInt(process.env.MYSQL_PORT || '63307', 10),
  user: process.env.MYSQL_USER || 'dev_hars_ai_user',
  password: process.env.MYSQL_PASSWORD || 'FqVcXcotTk91M18Voz4V',
  database: process.env.MYSQL_DATABASE || 'assc_srm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+08:00',
})

// ── Table Name Mapping ───────────────────────────────────────────────────────
// Same keys as bitable.js TABLE_IDS
const TABLE_NAMES = {
  projects: 'projects',
  nodes: 'nodes',
  issues: 'issues',
  users: 'users',
  groups: '`groups`',      // reserved word
  weekly_config: 'weekly_config',
}

// ── Cache (same as bitable.js) ───────────────────────────────────────────────
const listCache = new Map()
const CACHE_TTL = 60 * 1000

function getCached(key) {
  const entry = listCache.get(key)
  if (entry && Date.now() < entry.expireAt) return entry.data
  listCache.delete(key)
  return null
}

function setCache(key, data) {
  listCache.set(key, { data, expireAt: Date.now() + CACHE_TTL })
}

function invalidateCache(tableKey) {
  for (const k of listCache.keys()) {
    if (k.startsWith(tableKey + ':')) listCache.delete(k)
  }
}

// ── Filter Parser ────────────────────────────────────────────────────────────
// Converts Bitable filter expressions to SQL { where, params }
//
// Supported patterns:
//   CurrentValue.[field]="value"        →  field = ?
//   AND(cond1, cond2)                   →  (cond1 AND cond2)
//   OR(cond1, cond2)                    →  (cond1 OR cond2)

function parseFilter(filterStr) {
  if (!filterStr || !filterStr.trim()) return { where: '', params: [] }

  const params = []

  function parseExpr(expr) {
    expr = expr.trim()

    // AND(cond1, cond2, ...)
    const andMatch = expr.match(/^AND\((.+)\)$/)
    if (andMatch) {
      const parts = splitTopLevel(andMatch[1])
      const clauses = parts.map(p => parseExpr(p)).filter(Boolean)
      if (clauses.length === 0) return ''
      if (clauses.length === 1) return clauses[0]
      return `(${clauses.join(' AND ')})`
    }

    // OR(cond1, cond2, ...)
    const orMatch = expr.match(/^OR\((.+)\)$/)
    if (orMatch) {
      const parts = splitTopLevel(orMatch[1])
      const clauses = parts.map(p => parseExpr(p)).filter(Boolean)
      if (clauses.length === 0) return ''
      if (clauses.length === 1) return clauses[0]
      return `(${clauses.join(' OR ')})`
    }

    // CurrentValue.[field]="value"
    const fieldMatch = expr.match(/CurrentValue\.\[([^\]]+)\]\s*=\s*"([^"]*)"/)
    if (fieldMatch) {
      const [, field, value] = fieldMatch
      // Handle backtick-quoted column names for reserved words
      const col = field === 'order' ? '`order`' : `\`${field}\``
      params.push(value)
      return `${col} = ?`
    }

    return ''
  }

  function splitTopLevel(str) {
    const parts = []
    let depth = 0
    let current = ''
    for (const ch of str) {
      if (ch === '(') { depth++; current += ch }
      else if (ch === ')') { depth--; current += ch }
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    if (current.trim()) parts.push(current.trim())
    return parts
  }

  const where = parseExpr(filterStr)
  return { where, params }
}

// ── Row ↔ Bitable format conversion ──────────────────────────────────────────

function rowToRecord(row) {
  if (!row) return null
  const { id, ...fields } = row
  // Convert date fields to string (YYYY-MM-DD) for compatibility
  for (const key of ['plan_start', 'plan_end', 'actual_date', 'created_at', 'updated_at']) {
    if (fields[key] instanceof Date) {
      fields[key] = fields[key].toISOString().split('T')[0]
    } else if (fields[key] !== null && fields[key] !== undefined) {
      fields[key] = String(fields[key])
    }
  }
  return { record_id: String(id), fields }
}

function rowsToRecords(rows) {
  return (rows || []).map(rowToRecord)
}

// ── CRUD Functions (bitable.js compatible) ───────────────────────────────────

async function listRecords(tableKey, filter = {}) {
  const tableName = TABLE_NAMES[tableKey]
  if (!tableName) throw new Error(`Missing table for: ${tableKey}`)

  // Cache key
  const filterKey = typeof filter === 'string' ? filter : (filter.filter || '')
  const cacheKey = `${tableKey}:${filterKey}`

  const cached = getCached(cacheKey)
  if (cached) return cached

  let sql = `SELECT * FROM ${tableName}`
  const params = []

  const filterStr = typeof filter === 'string' ? filter : filter.filter
  if (filterStr) {
    const { where, params: filterParams } = parseFilter(filterStr)
    if (where) {
      sql += ` WHERE ${where}`
      params.push(...filterParams)
    }
  }

  sql += ' ORDER BY id ASC'

  const [rows] = await pool.execute(sql, params)
  const records = rowsToRecords(rows)

  setCache(cacheKey, records)
  return records
}

async function getRecord(tableKey, recordId) {
  const tableName = TABLE_NAMES[tableKey]
  if (!tableName) throw new Error(`Missing table for: ${tableKey}`)

  const [rows] = await pool.execute(`SELECT * FROM ${tableName} WHERE id = ?`, [recordId])
  return rowToRecord(rows[0] || null)
}

async function createRecord(tableKey, fields) {
  const tableName = TABLE_NAMES[tableKey]
  if (!tableName) throw new Error(`Missing table for: ${tableKey}`)

  // Filter out undefined values, convert nulls
  const data = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) data[k] = v === '' ? null : v
  }

  const columns = Object.keys(data)
  const placeholders = columns.map(() => '?').fill('?')
  const values = Object.values(data)

  const sql = `INSERT INTO ${tableName} (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
  const [result] = await pool.execute(sql, values)

  invalidateCache(tableKey)

  // Fetch the created record
  return await getRecord(tableKey, result.insertId)
}

async function updateRecord(tableKey, recordId, fields) {
  const tableName = TABLE_NAMES[tableKey]
  if (!tableName) throw new Error(`Missing table for: ${tableKey}`)

  const data = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) data[k] = v === '' ? null : v
  }

  if (Object.keys(data).length === 0) {
    return await getRecord(tableKey, recordId)
  }

  const setClauses = Object.keys(data).map(k => `\`${k}\` = ?`)
  const values = [...Object.values(data), recordId]

  await pool.execute(
    `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  )

  invalidateCache(tableKey)
  return await getRecord(tableKey, recordId)
}

async function deleteRecord(tableKey, recordId) {
  const tableName = TABLE_NAMES[tableKey]
  if (!tableName) throw new Error(`Missing table for: ${tableKey}`)

  await pool.execute(`DELETE FROM ${tableName} WHERE id = ?`, [recordId])
  invalidateCache(tableKey)
}

// ── Batch insert (for initProjectNodes) ──────────────────────────────────────

async function batchCreateRecords(tableKey, records) {
  const tableName = TABLE_NAMES[tableKey]
  if (!tableName) throw new Error(`Missing table for: ${tableKey}`)
  if (!records || records.length === 0) return []

  const created = []
  for (const rec of records) {
    const result = await createRecord(tableKey, rec.fields || rec)
    created.push(result)
  }
  return created
}

// ── Query helper (for stats etc.) ────────────────────────────────────────────

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

module.exports = {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  batchCreateRecords,
  query,
  invalidateCache,
  pool,
}
